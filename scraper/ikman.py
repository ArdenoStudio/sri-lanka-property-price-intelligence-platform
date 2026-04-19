import asyncio
import random
import re
import os
from datetime import datetime
from playwright.async_api import async_playwright
import structlog
from db.models import RawListing, ListingSnapshot
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from scraper.utils import build_snapshot_fingerprint

log = structlog.get_logger()

BLOCK_STATUSES = {403, 429, 503, 520, 521, 522, 524}
BLOCK_KEYWORDS = [
    "access denied",
    "captcha",
    "unusual traffic",
    "verify you are human",
    "enable javascript and cookies",
    "sorry, you have been blocked",
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15"
]

# Thin districts that need targeted scraping (< 30 listings each)
THIN_DISTRICTS = [
    # Northern / Eastern — very low absolute counts
    "jaffna", "vavuniya", "batticaloa", "trincomalee",
    "ampara", "mannar", "kilinochchi",
    "mullativu",           # Ikman slug is "mullativu" not "mullaitivu"
    # Southern / Central — low % coverage despite decent Ikman volume
    "hambantota", "kegalle", "anuradhapura",
    "matara", "kurunegala", "polonnaruwa", "monaragala",
    "ratnapura", "puttalam", "matale", "nuwara-eliya",
]

# All 25 Sri Lanka districts — used for mega scrape mode
ALL_DISTRICTS = THIN_DISTRICTS + [
    "colombo", "gampaha", "kalutara", "kandy", "galle", "badulla",
]

# Extra category URLs for data gaps
# Rentals are mixed into the main /property feed — ikman has no separate rental category URL.
# Only add URLs here that are verified to exist on ikman.lk.
EXTRA_TARGETS = [
    {"url": "https://ikman.lk/en/ads/sri-lanka/commercial-property?sort=date&order=desc&buy_now=0&urgent=0&page=", "listing_type": "sale", "property_type": "commercial"},
]

class IkmanScraper:
    SOURCE = "ikman"
    BASE_URL = "https://ikman.lk/en/ads/sri-lanka/property?sort=date&order=desc&buy_now=0&urgent=0&page="

    def __init__(self, db: Session):
        self.db = db
        self.max_retries = int(os.getenv("SCRAPER_MAX_RETRIES", "3"))
        self.backoff_base = float(os.getenv("SCRAPER_BACKOFF_BASE_SECONDS", "5"))
        self.backoff_max = float(os.getenv("SCRAPER_BACKOFF_MAX_SECONDS", "60"))
        self.stop_after_blocks = int(os.getenv("SCRAPER_STOP_AFTER_BLOCKS", "3"))

    async def _is_blocked(self, page, response) -> bool:
        try:
            if response is not None and response.status in BLOCK_STATUSES:
                return True
        except Exception:
            pass
        try:
            content = await page.content()
            lowered = content.lower()
            return any(token in lowered for token in BLOCK_KEYWORDS)
        except Exception:
            return False

    async def _safe_goto(self, page, url: str) -> bool:
        for attempt in range(self.max_retries):
            try:
                response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                if await self._is_blocked(page, response):
                    raise RuntimeError("blocked")
                if response is not None and response.status >= 400:
                    raise RuntimeError(f"http_{response.status}")
                return True
            except RuntimeError as e:
                if str(e) == "http_404":
                    # 404 is definitive — the URL doesn't exist, no point retrying
                    log.warning("url_not_found", source=self.SOURCE, url=url)
                    return False
                delay = min(self.backoff_base * (2 ** attempt), self.backoff_max)
                delay += random.uniform(0, self.backoff_base * 0.2)
                log.warning("page_retry", source=self.SOURCE, url=url, attempt=attempt + 1, delay=round(delay, 2), error=str(e))
                await asyncio.sleep(delay)
            except Exception as e:
                delay = min(self.backoff_base * (2 ** attempt), self.backoff_max)
                delay += random.uniform(0, self.backoff_base * 0.2)
                log.warning("page_retry", source=self.SOURCE, url=url, attempt=attempt + 1, delay=round(delay, 2), error=str(e))
                await asyncio.sleep(delay)
        return False

    async def scrape(self, max_pages: int = 50, location: str = "sri-lanka", storage_state: str = None):
        import os
        from urllib.parse import urlparse

        consecutive_blocks = 0
        proxy_url = os.getenv("PROXY_URL")
        # Ikman URL pattern: https://ikman.lk/en/ads/{location}/property
        location_slug = location.lower().replace(" ", "-")
        base_url = f"https://ikman.lk/en/ads/{location_slug}/property?sort=date&order=desc&buy_now=0&urgent=0&page="
        proxy_settings = None
        if proxy_url:
            parsed = urlparse(proxy_url)
            proxy_settings = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"}
            if parsed.username:
                proxy_settings["username"] = parsed.username
            if parsed.password:
                proxy_settings["password"] = parsed.password

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, proxy=proxy_settings)
            ctx_kwargs = {"user_agent": random.choice(USER_AGENTS)}
            if storage_state and os.path.exists(storage_state):
                ctx_kwargs["storage_state"] = storage_state
            ctx_kwargs["ignore_https_errors"] = True
            context = await browser.new_context(**ctx_kwargs)
            page = await context.new_page()

            # Extreme performance boost: Block all images, videos, fonts, and CSS from loading
            await page.route("**/*", lambda route: route.abort() if route.request.resource_type in ["image", "media", "stylesheet", "font"] else route.continue_())

            total_found = 0
            total_new = 0

            for page_num in range(1, max_pages + 1):
                url = f"{base_url}{page_num}"
                log.info("scraping_page", source=self.SOURCE, page=page_num, url=url)

                try:
                    ok = await self._safe_goto(page, url)
                    if not ok:
                        consecutive_blocks += 1
                        log.error("page_blocked", source=self.SOURCE, page=page_num, url=url, blocks=consecutive_blocks)
                        if consecutive_blocks >= self.stop_after_blocks:
                            raise RuntimeError("blocked_by_site")
                        continue
                    consecutive_blocks = 0

                    # Close any overlay/ad popup if present
                    try:
                        close_btn = page.locator("button[aria-label='Close'], .close-button, [data-testid='close-button']")
                        if await close_btn.count() > 0:
                            await close_btn.first.click(timeout=3000)
                    except Exception:
                        pass

                    # Wait for listing links (current Ikman selector)
                    await page.wait_for_selector("a.gtm-ad-item", timeout=15000)

                    # Get all listing anchors
                    listings = await page.query_selector_all("a.gtm-ad-item")
                    if not listings:
                        log.warning("no_listings_found", source=self.SOURCE, page=page_num)
                        break

                    page_listings_count = 0
                    page_new_count = 0

                    for listing in listings:
                        try:
                            listing_url = await listing.get_attribute("href") or ""
                            if not listing_url.startswith("http"):
                                listing_url = f"https://ikman.lk{listing_url}"

                            # Extract ID from URL path e.g. "/en/ad/land-nugegoda-4523123"
                            id_match = re.search(r"-(\d+)$", listing_url.rstrip("/"))
                            source_id = id_match.group(1) if id_match else listing_url.split("/")[-1]

                            # Title from h2 inside the link
                            title_elem = await listing.query_selector("h2")
                            title = (await title_elem.inner_text()).strip() if title_elem else ""

                            # Price: find span/div containing "Rs" text
                            price_elem = await listing.query_selector("[class*='price'], [class*='Price']")
                            raw_price = (await price_elem.inner_text()).strip() if price_elem else ""

                            # Location + Category combined in one div typically
                            loc_elems = await listing.query_selector_all("[class*='location'], [class*='Location']")
                            raw_location = ""
                            if loc_elems:
                                raw_location = (await loc_elems[0].inner_text()).strip()

                            # Category / meta info
                            cat_elems = await listing.query_selector_all("[class*='category'], [class*='Category'], [class*='tag'], [class*='Tag']")
                            raw_meta = ""
                            if cat_elems:
                                raw_meta = (await cat_elems[0].inner_text()).strip()

                            # Property type inference
                            combined = (title + " " + raw_meta).lower()
                            property_type = 'land'
                            if any(w in combined for w in ('house', 'bungalow', 'villa', 'cottage', 'annexe', 'annex', 'townhouse', 'holiday home')):
                                property_type = 'house'
                            elif 'apartment' in combined or 'flat' in combined:
                                property_type = 'apartment'
                            elif 'commercial' in combined:
                                property_type = 'commercial'

                            listing_type = 'sale'
                            if 'rent' in combined or 'lease' in combined:
                                listing_type = 'rent'

                            if not title and not raw_price:
                                continue  # Skip empty cards

                            stmt = insert(RawListing).values(
                                source=self.SOURCE,
                                source_id=source_id,
                                url=listing_url,
                                title=title,
                                raw_price=raw_price,
                                raw_location=raw_location,
                                raw_size=raw_meta,
                                property_type=property_type,
                                listing_type=listing_type,
                                raw_json={"full_meta": raw_meta},
                                scraped_at=datetime.utcnow()
                            ).on_conflict_do_nothing()

                            res = self.db.execute(stmt)
                            if res.rowcount > 0:
                                page_new_count += 1
                                total_new += 1

                            fingerprint = build_snapshot_fingerprint(
                                title=title,
                                raw_price=raw_price,
                                raw_location=raw_location,
                                raw_size=raw_meta,
                                property_type=property_type,
                                listing_type=listing_type,
                                url=listing_url,
                            )
                            snap_stmt = insert(ListingSnapshot).values(
                                source=self.SOURCE,
                                source_id=source_id,
                                url=listing_url,
                                title=title,
                                raw_price=raw_price,
                                raw_location=raw_location,
                                raw_size=raw_meta,
                                property_type=property_type,
                                listing_type=listing_type,
                                raw_json={"full_meta": raw_meta},
                                fingerprint=fingerprint,
                                scraped_at=datetime.utcnow(),
                            ).on_conflict_do_nothing(
                                index_elements=['source', 'source_id', 'fingerprint']
                            )
                            self.db.execute(snap_stmt)

                            page_listings_count += 1
                            total_found += 1

                        except Exception as e:
                            log.error("listing_parse_error", source=self.SOURCE, error=str(e))
                            self.db.rollback()
                            self.db.expire_all()

                    # Batch commit all 25 rows together to completely remove DB lag!
                    self.db.commit()

                    log.info("page_complete", source=self.SOURCE, page=page_num, found=page_listings_count, new=page_new_count)

                    if page_listings_count == 0:
                        log.info("no_new_listings_stopping", source=self.SOURCE)
                        break

                    # Random delay to be polite
                    await asyncio.sleep(random.uniform(1, 2.5))

                except Exception as e:
                    if str(e) == "blocked_by_site":
                        raise
                    log.error("page_load_error", source=self.SOURCE, page=page_num, error=str(e))
                    await asyncio.sleep(1)  # brief pause before next page

            from db.models import ScrapeRun
            try:
                self.db.rollback()
                self.db.expire_all()
                new_run = ScrapeRun(
                    source=self.SOURCE,
                    started_at=datetime.utcnow(),
                    finished_at=datetime.utcnow(),
                    listings_found=total_found,
                    listings_new=total_new
                )
                self.db.add(new_run)
                self.db.commit()
            except Exception as e:
                log.error("scrape_run_write_error", source=self.SOURCE, error=str(e))
                self.db.rollback()

            return total_found, total_new

async def scrape_ikman(db: Session, max_pages: int = 20, location: str = "sri-lanka"):
    scraper = IkmanScraper(db)
    return await scraper.scrape(max_pages=max_pages, location=location)

async def scrape_ikman_full(db: Session, main_pages: int = 50, district_pages: int = 50, extra_pages: int = 10, headless: bool = False, use_all_districts: bool = False):
    """
    Full scrape: main feed + thin districts + rent/commercial categories.
    Runs sequentially to avoid hammering the site.
    """
    import os
    from urllib.parse import urlparse
    from playwright.async_api import async_playwright

    proxy_url = os.getenv("PROXY_URL")
    proxy_settings = None
    if proxy_url:
        parsed = urlparse(proxy_url)
        proxy_settings = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"}
        if parsed.username: proxy_settings["username"] = parsed.username
        if parsed.password: proxy_settings["password"] = parsed.password

    scraper = IkmanScraper(db)
    grand_total_found = 0
    grand_total_new = 0

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless, proxy=proxy_settings)
        context = await browser.new_context(user_agent=random.choice(USER_AGENTS), ignore_https_errors=True)
        page = await context.new_page()
        await page.route("**/*", lambda route: route.abort()
            if route.request.resource_type in ["image", "media", "stylesheet", "font"]
            else route.continue_())

        async def _scrape_url(base_url, max_p, override_type=None, override_listing=None, required=True):
            nonlocal grand_total_found, grand_total_new
            total_found = 0
            total_new = 0
            consecutive_blocks = 0
            for page_num in range(1, max_p + 1):
                url = f"{base_url}{page_num}"
                log.info("scraping_ikman_full", url=url)
                try:
                    ok = await scraper._safe_goto(page, url)
                    if not ok:
                        consecutive_blocks += 1
                        log.error("page_blocked", source="ikman", page=page_num, url=url, blocks=consecutive_blocks)
                        if consecutive_blocks >= scraper.stop_after_blocks:
                            if required:
                                raise RuntimeError("blocked_by_site")
                            else:
                                log.warning("extra_target_skipped", source="ikman", url=base_url, reason="too_many_blocks")
                                return
                        continue
                    consecutive_blocks = 0
                    try:
                        close_btn = page.locator("button[aria-label='Close'], .close-button, [data-testid='close-button']")
                        if await close_btn.count() > 0:
                            await close_btn.first.click(timeout=3000)
                    except Exception:
                        pass
                    await page.wait_for_selector("a.gtm-ad-item", timeout=15000)
                    listings = await page.query_selector_all("a.gtm-ad-item")
                    if not listings:
                        break
                    page_new = 0
                    for listing in listings:
                        try:
                            listing_url = await listing.get_attribute("href") or ""
                            if not listing_url.startswith("http"):
                                listing_url = f"https://ikman.lk{listing_url}"
                            id_match = re.search(r"-(\d+)$", listing_url.rstrip("/"))
                            source_id = id_match.group(1) if id_match else listing_url.split("/")[-1]
                            title_elem = await listing.query_selector("h2")
                            title = (await title_elem.inner_text()).strip() if title_elem else ""
                            price_elem = await listing.query_selector("[class*='price'], [class*='Price']")
                            raw_price = (await price_elem.inner_text()).strip() if price_elem else ""
                            loc_elems = await listing.query_selector_all("[class*='location'], [class*='Location']")
                            raw_location = (await loc_elems[0].inner_text()).strip() if loc_elems else ""
                            cat_elems = await listing.query_selector_all("[class*='category'], [class*='Category'], [class*='tag'], [class*='Tag']")
                            raw_meta = (await cat_elems[0].inner_text()).strip() if cat_elems else ""
                            combined = (title + " " + raw_meta).lower()
                            if override_type:
                                property_type = override_type
                            else:
                                property_type = 'land'
                                if any(w in combined for w in ('house', 'bungalow', 'villa', 'cottage', 'annexe', 'annex', 'townhouse', 'holiday home')):
                                    property_type = 'house'
                                elif 'apartment' in combined or 'flat' in combined: property_type = 'apartment'
                                elif 'commercial' in combined: property_type = 'commercial'
                            if override_listing:
                                listing_type = override_listing
                            else:
                                listing_type = 'rent' if ('rent' in combined or 'lease' in combined) else 'sale'
                            if not title and not raw_price:
                                continue
                            stmt = insert(RawListing).values(
                                source="ikman", source_id=source_id, url=listing_url,
                                title=title, raw_price=raw_price, raw_location=raw_location,
                                raw_size=raw_meta, property_type=property_type,
                                listing_type=listing_type, raw_json={"full_meta": raw_meta},
                                scraped_at=datetime.utcnow()
                            ).on_conflict_do_nothing()
                            res = db.execute(stmt)
                            if res.rowcount > 0:
                                page_new += 1
                                total_new += 1
                            total_found += 1

                            fingerprint = build_snapshot_fingerprint(
                                title=title,
                                raw_price=raw_price,
                                raw_location=raw_location,
                                raw_size=raw_meta,
                                property_type=property_type,
                                listing_type=listing_type,
                                url=listing_url,
                            )
                            snap_stmt = insert(ListingSnapshot).values(
                                source="ikman",
                                source_id=source_id,
                                url=listing_url,
                                title=title,
                                raw_price=raw_price,
                                raw_location=raw_location,
                                raw_size=raw_meta,
                                property_type=property_type,
                                listing_type=listing_type,
                                raw_json={"full_meta": raw_meta},
                                fingerprint=fingerprint,
                                scraped_at=datetime.utcnow(),
                            ).on_conflict_do_nothing(
                                index_elements=['source', 'source_id', 'fingerprint']
                            )
                            db.execute(snap_stmt)
                        except Exception as e:
                            log.error("ikman_full_card_error", error=str(e))
                    db.commit()
                    log.info("ikman_full_page_done", url=url[:60], found=total_found, new=total_new)
                    if page_new == 0:
                        break
                    await asyncio.sleep(random.uniform(1, 2.5))
                except Exception as e:
                    if str(e) == "blocked_by_site":
                        raise
                    log.error("ikman_full_page_error", url=url, error=str(e))
                    await asyncio.sleep(1)
            grand_total_found += total_found
            grand_total_new += total_new

        # 1. Main feed
        main_base = f"https://ikman.lk/en/ads/sri-lanka/property?sort=date&order=desc&buy_now=0&urgent=0&page="
        await _scrape_url(main_base, main_pages)

        # 2. Districts (all 25 in mega mode, thin districts only otherwise)
        districts = ALL_DISTRICTS if use_all_districts else THIN_DISTRICTS
        for district in districts:
            district_base = f"https://ikman.lk/en/ads/{district}/property?sort=date&order=desc&buy_now=0&urgent=0&page="
            await _scrape_url(district_base, district_pages)

        # 3. Extra categories (rent, commercial) — optional, skip on dead/blocked URLs
        for target in EXTRA_TARGETS:
            await _scrape_url(target["url"], extra_pages,
                              override_type=target["property_type"],
                              override_listing=target["listing_type"],
                              required=False)

        from db.models import ScrapeRun
        db.add(ScrapeRun(source="ikman", started_at=datetime.utcnow(),
                         finished_at=datetime.utcnow(),
                         listings_found=grand_total_found, listings_new=grand_total_new))
        db.commit()
        await browser.close()

    return grand_total_found, grand_total_new
