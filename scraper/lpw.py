import asyncio
import random
import re
import os
from datetime import datetime
import structlog
from db.models import RawListing, ListingSnapshot
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from scraper.utils import build_snapshot_fingerprint

log = structlog.get_logger()

BLOCK_STATUSES = {403, 429, 503, 520, 521, 522, 524}
BLOCK_KEYWORDS = [
    "access denied",
    "unusual traffic",
    "verify you are human",
    "sorry, you have been blocked",
    "please complete the security check",
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
]

BASE = "https://www.lankapropertyweb.com"

# Updated URL structure after LPW site redesign (Apr 2026)
# Old: /property-for-sale/?page=N  →  New: /sale/index.php?page=N
BASE_URLS = [
    {"url": f"{BASE}/sale/index.php",       "type": "house",     "listing_type": "sale"},
    {"url": f"{BASE}/land/index.php",       "type": "land",      "listing_type": "sale"},
    {"url": f"{BASE}/rentals/index.php",    "type": "house",     "listing_type": "rent"},
    {"url": f"{BASE}/apartment/index.php",  "type": "apartment", "listing_type": "sale"},
]

# Thin districts to target with srch_words filter
THIN_DISTRICTS = [
    "Hambantota", "Kegalle", "Anuradhapura", "Matara", "Kurunegala",
    "Ratnapura", "Puttalam", "Matale", "Nuwara Eliya", "Jaffna",
    "Vavuniya", "Batticaloa", "Trincomalee", "Ampara", "Mannar",
    "Kilinochchi", "Polonnaruwa", "Monaragala",
]

DISTRICT_URLS = [
    {"url": f"{BASE}/sale/index.php?srch_words={d}&page=",    "type": "house", "listing_type": "sale",  "district": d}
    for d in THIN_DISTRICTS
] + [
    {"url": f"{BASE}/land/index.php?srch_words={d}&page=",    "type": "land",  "listing_type": "sale",  "district": d}
    for d in THIN_DISTRICTS
] + [
    {"url": f"{BASE}/rentals/index.php?srch_words={d}&page=", "type": "house", "listing_type": "rent",  "district": d}
    for d in THIN_DISTRICTS
]


class LPWScraper:
    SOURCE = "lpw"

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
            except Exception as e:
                delay = min(self.backoff_base * (2 ** attempt), self.backoff_max)
                delay += random.uniform(0, self.backoff_base * 0.2)
                log.warning("page_retry", source=self.SOURCE, url=url, attempt=attempt + 1, delay=round(delay, 2), error=str(e))
                await asyncio.sleep(delay)
        return False

    async def scrape(self, max_pages: int = 15, location: str = "sri-lanka"):
        from urllib.parse import urlparse
        from playwright.async_api import async_playwright

        consecutive_blocks = 0
        proxy_url = os.getenv("PROXY_URL")
        proxy_settings = None
        if proxy_url:
            parsed = urlparse(proxy_url)
            proxy_settings = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"}
            if parsed.username: proxy_settings["username"] = parsed.username
            if parsed.password: proxy_settings["password"] = parsed.password

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, proxy=proxy_settings)
            context = await browser.new_context(user_agent=random.choice(USER_AGENTS))
            page = await context.new_page()

            # Block heavy resources to speed things up
            await page.route("**/*", lambda route: route.abort()
                if route.request.resource_type in ["image", "media", "font", "stylesheet"]
                else route.continue_())

            total_found = 0
            total_new = 0

            for entry in BASE_URLS:
                base_url = entry["url"]
                default_type = entry["type"]
                listing_type = entry["listing_type"]

                for page_num in range(1, max_pages + 1):
                    full_url = f"{base_url}?page={page_num}"
                    log.info("scraping_lpw_page", page=page_num, url=full_url)

                    try:
                        ok = await self._safe_goto(page, full_url)
                        if not ok:
                            consecutive_blocks += 1
                            log.error("page_blocked", source=self.SOURCE, page=page_num, url=full_url, blocks=consecutive_blocks)
                            if consecutive_blocks >= self.stop_after_blocks:
                                raise RuntimeError("blocked_by_site")
                            continue
                        consecutive_blocks = 0
                        await page.wait_for_selector("article.listing-item", timeout=12000)

                        cards = await page.query_selector_all("article.listing-item")
                        if not cards:
                            log.warning("no_lpw_cards_found", url=full_url)
                            break

                        for card in cards:
                            try:
                                # Source ID from data attribute
                                source_id = await card.get_attribute("data-ad-id") or ""

                                # Listing URL
                                header_link = await card.query_selector("a.listing-header")
                                href = await header_link.get_attribute("href") if header_link else ""
                                listing_url = href if href.startswith("http") else f"{BASE}{href}"

                                # Title
                                title_el = await card.query_selector("h4.listing-title a, h4.listing-title")
                                title = (await title_el.inner_text()).strip() if title_el else ""

                                # Price
                                price_el = await card.query_selector(".listing-price")
                                raw_price = (await price_el.inner_text()).strip() if price_el else ""

                                # Location (city/district level)
                                loc_el = await card.query_selector(".location")
                                raw_loc = (await loc_el.inner_text()).strip() if loc_el else ""

                                # Property type override from card badge
                                type_el = await card.query_selector(".type")
                                type_text = (await type_el.inner_text()).strip().lower() if type_el else ""
                                if "apartment" in type_text or "flat" in type_text:
                                    property_type = "apartment"
                                elif "land" in type_text or "lot" in type_text:
                                    property_type = "land"
                                elif "commercial" in type_text or "office" in type_text or "shop" in type_text:
                                    property_type = "commercial"
                                else:
                                    property_type = default_type

                                # Size (perches/sqft)
                                size_el = await card.query_selector(".listing-summery li:nth-child(2) .count, li .count")
                                raw_size = (await size_el.inner_text()).strip() if size_el else ""

                                if not source_id and listing_url:
                                    m = re.search(r"(\d+)\.html", listing_url)
                                    source_id = m.group(1) if m else listing_url.split("/")[-1]

                                now = datetime.utcnow()
                                stmt = insert(RawListing).values(
                                    source=self.SOURCE,
                                    source_id=source_id,
                                    url=listing_url,
                                    title=title,
                                    raw_price=raw_price,
                                    raw_location=raw_loc,
                                    raw_size=raw_size,
                                    property_type=property_type,
                                    listing_type=listing_type,
                                    raw_json={},
                                    is_processed=False,
                                    scraped_at=now,
                                ).on_conflict_do_update(
                                    index_elements=["source", "source_id"],
                                    set_={
                                        "scraped_at": now,
                                        "raw_price": raw_price,
                                        "raw_location": raw_loc,
                                        "raw_size": raw_size,
                                    }
                                )

                                res = self.db.execute(stmt)
                                if res.rowcount and res.rowcount > 0:
                                    total_new += 1
                                total_found += 1

                                fingerprint = build_snapshot_fingerprint(
                                    title=title,
                                    raw_price=raw_price,
                                    raw_location=raw_loc,
                                    raw_size=raw_size,
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
                                    raw_location=raw_loc,
                                    raw_size=raw_size,
                                    property_type=property_type,
                                    listing_type=listing_type,
                                    raw_json={},
                                    fingerprint=fingerprint,
                                    scraped_at=now,
                                ).on_conflict_do_nothing(
                                    index_elements=["source", "source_id", "fingerprint"]
                                )
                                self.db.execute(snap_stmt)

                            except Exception as e:
                                log.error("lpw_card_error", error=str(e))

                        self.db.commit()
                        log.info("lpw_page_done", page=page_num, found=total_found, new=total_new)
                        await asyncio.sleep(random.uniform(1.5, 2.5))

                    except Exception as e:
                        if str(e) == "blocked_by_site":
                            raise
                        log.error("lpw_page_error", url=full_url, error=str(e))
                        break

            from db.models import ScrapeRun
            new_run = ScrapeRun(
                source=self.SOURCE,
                started_at=datetime.utcnow(),
                finished_at=datetime.utcnow(),
                listings_found=total_found,
                listings_new=total_new
            )
            self.db.add(new_run)
            self.db.commit()
            await browser.close()
            return total_found, total_new


async def scrape_lpw(db: Session, max_pages: int = 15, location: str = "sri-lanka"):
    scraper = LPWScraper(db)
    return await scraper.scrape(max_pages=max_pages, location=location)


async def scrape_lpw_districts(db: Session, max_pages: int = 50):
    """Scrape LPW with district-specific srch_words filter for thin districts."""
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

    grand_total_found = 0
    grand_total_new = 0

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, proxy=proxy_settings)
        context = await browser.new_context(user_agent=random.choice(USER_AGENTS))
        page = await context.new_page()
        await page.route("**/*", lambda route: route.abort()
            if route.request.resource_type in ["image", "media", "font", "stylesheet"]
            else route.continue_())

        for entry in DISTRICT_URLS:
            base_url = entry["url"]
            default_type = entry["type"]
            listing_type = entry["listing_type"]
            district = entry["district"]
            log.info("lpw_district_scrape_start", district=district, listing_type=listing_type, type=default_type)

            for page_num in range(1, max_pages + 1):
                full_url = f"{base_url}{page_num}"
                try:
                    await page.goto(full_url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_selector("article.listing-item", timeout=12000)
                    cards = await page.query_selector_all("article.listing-item")
                    if not cards:
                        break

                    page_new = 0
                    for card in cards:
                        try:
                            source_id = await card.get_attribute("data-ad-id") or ""
                            header_link = await card.query_selector("a.listing-header")
                            href = await header_link.get_attribute("href") if header_link else ""
                            listing_url = href if href.startswith("http") else f"{BASE}{href}"
                            title_el = await card.query_selector("h4.listing-title a, h4.listing-title")
                            title = (await title_el.inner_text()).strip() if title_el else ""
                            price_el = await card.query_selector(".listing-price")
                            raw_price = (await price_el.inner_text()).strip() if price_el else ""
                            loc_el = await card.query_selector(".location")
                            raw_loc = (await loc_el.inner_text()).strip() if loc_el else ""
                            type_el = await card.query_selector(".type")
                            type_text = (await type_el.inner_text()).strip().lower() if type_el else ""
                            if "apartment" in type_text or "flat" in type_text:
                                property_type = "apartment"
                            elif "land" in type_text or "lot" in type_text:
                                property_type = "land"
                            elif "commercial" in type_text or "office" in type_text or "shop" in type_text:
                                property_type = "commercial"
                            else:
                                property_type = default_type
                            size_el = await card.query_selector(".listing-summery li:nth-child(2) .count, li .count")
                            raw_size = (await size_el.inner_text()).strip() if size_el else ""
                            if not source_id and listing_url:
                                m = re.search(r"(\d+)\.html", listing_url)
                                source_id = m.group(1) if m else listing_url.split("/")[-1]

                            stmt = insert(RawListing).values(
                                source="lpw", source_id=source_id, url=listing_url,
                                title=title, raw_price=raw_price, raw_location=raw_loc,
                                raw_size=raw_size, property_type=property_type,
                                listing_type=listing_type, scraped_at=datetime.utcnow()
                            ).on_conflict_do_nothing()
                            res = db.execute(stmt)
                            if res.rowcount > 0:
                                page_new += 1
                                grand_total_new += 1
                            grand_total_found += 1
                        except Exception as e:
                            log.error("lpw_district_card_error", error=str(e))

                    db.commit()
                    log.info("lpw_district_page_done", district=district, page=page_num, new=page_new, total_new=grand_total_new)
                    if page_new == 0:
                        break
                    await asyncio.sleep(random.uniform(1.5, 2.5))

                except Exception as e:
                    log.error("lpw_district_page_error", url=full_url, error=str(e))
                    break

        from db.models import ScrapeRun
        db.add(ScrapeRun(source="lpw", started_at=datetime.utcnow(),
                         finished_at=datetime.utcnow(),
                         listings_found=grand_total_found, listings_new=grand_total_new))
        db.commit()
        await browser.close()

    return grand_total_found, grand_total_new
