import asyncio
import random
import re
import os
from datetime import datetime
import structlog
from db.models import RawListing, ListingSnapshot, ScrapeRun
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from scraper.utils import build_snapshot_fingerprint
from playwright.async_api import async_playwright

log = structlog.get_logger()

# lamudi.lk rebranded to house.lk in 2025
# All selectors verified against live house.lk DOM as of 2026-04

BLOCK_STATUSES = {403, 429, 503, 520, 521, 522, 524}
BLOCK_KEYWORDS = [
    "access denied",
    "unusual traffic",
    # Cloudflare challenge-specific phrases (NOT just "cloudflare" which appears on every CF-protected page)
    "checking if the site connection is secure",
    "just a moment",
    "enable javascript and cookies to continue",
    "ddos protection by cloudflare",
    "please wait while we verify",
    "ray id:",
    "cf-challenge-running",
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
]

BASE = "https://house.lk"

# house.lk URL structure (formerly lamudi.lk)
# Pagination: /sale/page/2/, /sale/page/3/ etc.
BASE_URLS = [
    {"url": f"{BASE}/sale/",       "listing_type": "sale",  "property_type": "house"},
    {"url": f"{BASE}/rent/",       "listing_type": "rent",  "property_type": "house"},
    {"url": f"{BASE}/land/",       "listing_type": "sale",  "property_type": "land"},
]

def _page_url(base_url: str, page_num: int) -> str:
    """Build paginated URL: /sale/ -> /sale/page/2/ etc."""
    if page_num == 1:
        return base_url
    # strip trailing slash, append /page/N/
    return base_url.rstrip("/") + f"/page/{page_num}/"


class LamudiScraper:
    """Scraper for house.lk (formerly lamudi.lk)."""
    SOURCE = "lamudi"

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
                log.warning("page_retry", source=self.SOURCE, url=url, attempt=attempt + 1,
                            delay=round(delay, 2), error=str(e))
                await asyncio.sleep(delay)
        return False

    async def _parse_listings(self, page, listing_type: str, property_type: str) -> list[dict]:
        """
        Parse house.lk listing cards.
        Card selector: div.property_listing
        Verified selectors (2026-04):
          - title/url : h4 > a[href*="/details/"]
          - price     : .listing_unit_price_wrapper
          - location  : .property_location_image
          - type      : .action_tag_wrapper  (class includes type, e.g. "action_tag_wrapper Villa")
          - bedrooms  : .inforoom
          - bathrooms : .infobath
          - size      : .infosize
        """
        items = []
        try:
            cards = await page.query_selector_all("div.property_listing")
        except Exception as e:
            log.debug("houseLk_card_query_error", error=str(e))
            return items

        if not cards:
            log.debug("houseLk_no_cards_found")
            return items

        for card in cards:
            try:
                # URL + title
                title_el = await card.query_selector("h4 > a[href*='/details/']")
                if not title_el:
                    continue
                href = await title_el.get_attribute("href")
                if not href:
                    continue
                if not href.startswith("http"):
                    href = BASE + href
                title = (await title_el.inner_text()).strip()

                # source_id: numeric suffix at end of slug e.g. "-5712978"
                slug = href.rstrip("/").split("/")[-1]
                m = re.search(r"-(\d+)$", slug)
                source_id = m.group(1) if m else slug

                # Price — strip "Negotiable"/"upwards" suffix captured in pricetype span
                price_el = await card.query_selector(".listing_unit_price_wrapper")
                raw_price = None
                if price_el:
                    # Remove the pricetype span text to get clean price
                    pricetype_el = await card.query_selector(".pricetype")
                    pricetype_text = (await pricetype_el.inner_text()).strip() if pricetype_el else ""
                    full_price_text = (await price_el.inner_text()).strip()
                    raw_price = full_price_text.replace(pricetype_text, "").strip()

                # Location
                loc_el = await card.query_selector(".property_location_image")
                raw_location = (await loc_el.inner_text()).strip() if loc_el else None

                # Property type — from action_tag_wrapper class e.g. "action_tag_wrapper Villa"
                type_el = await card.query_selector("[class*='action_tag_wrapper']")
                pt = property_type
                if type_el:
                    type_class = await type_el.get_attribute("class") or ""
                    type_text = (await type_el.inner_text()).strip()
                    # Prefer class-based detection (more reliable than text)
                    raw_t = None
                    for t in ("land", "villa", "apartment", "commercial", "hotel", "house"):
                        if t in type_class.lower() or t in type_text.lower():
                            raw_t = t
                            break
                    # Normalise to our 4 canonical types
                    if raw_t == "villa":
                        pt = "house"
                    elif raw_t == "hotel":
                        pt = "commercial"
                    elif raw_t:
                        pt = raw_t

                # Size
                size_el = await card.query_selector(".infosize")
                raw_size = (await size_el.inner_text()).strip() if size_el else None

                # Bedrooms
                beds_el = await card.query_selector(".inforoom")
                bedrooms = None
                if beds_el:
                    beds_text = (await beds_el.inner_text()).strip()
                    bm = re.search(r"(\d+)", beds_text)
                    bedrooms = int(bm.group(1)) if bm else None

                # Bathrooms
                baths_el = await card.query_selector(".infobath")
                bathrooms = None
                if baths_el:
                    baths_text = (await baths_el.inner_text()).strip()
                    bm = re.search(r"(\d+)", baths_text)
                    bathrooms = int(bm.group(1)) if bm else None

                items.append({
                    "source_id": source_id,
                    "url": href,
                    "title": title,
                    "raw_price": raw_price,
                    "raw_location": raw_location,
                    "raw_size": raw_size,
                    "property_type": pt,
                    "listing_type": listing_type,
                    "bedrooms": bedrooms,
                    "bathrooms": bathrooms,
                })

            except Exception as e:
                log.debug("houseLk_card_parse_error", error=str(e))

        return items

    def _upsert(self, items: list[dict]) -> tuple[int, int]:
        found = len(items)
        new_count = 0
        now = datetime.utcnow()

        for item in items:
            try:
                fingerprint = build_snapshot_fingerprint(
                    title=item.get("title", ""),
                    raw_price=item.get("raw_price", ""),
                    raw_location=item.get("raw_location", ""),
                    raw_size=item.get("raw_size", ""),
                    property_type=item.get("property_type", ""),
                    listing_type=item.get("listing_type", ""),
                    url=item.get("url", ""),
                )
                snap_stmt = insert(ListingSnapshot).values(
                    source=self.SOURCE,
                    source_id=item["source_id"],
                    scraped_at=now,
                    url=item["url"],
                    title=item["title"],
                    raw_price=item.get("raw_price"),
                    raw_location=item.get("raw_location"),
                    raw_size=item.get("raw_size"),
                    property_type=item["property_type"],
                    listing_type=item["listing_type"],
                    raw_json={},
                    fingerprint=fingerprint,
                ).on_conflict_do_nothing(
                    index_elements=["source", "source_id", "fingerprint"]
                )
                self.db.execute(snap_stmt)

                raw_stmt = insert(RawListing).values(
                    source=self.SOURCE,
                    source_id=item["source_id"],
                    scraped_at=now,
                    url=item["url"],
                    title=item["title"],
                    raw_price=item.get("raw_price"),
                    raw_location=item.get("raw_location"),
                    raw_size=item.get("raw_size"),
                    property_type=item["property_type"],
                    listing_type=item["listing_type"],
                    raw_json={},
                    is_processed=False,
                ).on_conflict_do_update(
                    index_elements=["source", "source_id"],
                    set_={
                        "scraped_at": now,
                        "raw_price": item.get("raw_price"),
                        "raw_location": item.get("raw_location"),
                        "raw_size": item.get("raw_size"),
                    }
                )
                exists = self.db.query(RawListing.id).filter_by(
                    source=self.SOURCE, source_id=item["source_id"]
                ).first()
                self.db.execute(raw_stmt)
                if not exists:
                    new_count += 1
            except Exception as e:
                log.error("houseLk_upsert_error", source_id=item.get("source_id"), error=str(e))

        self.db.commit()
        return found, new_count

    async def scrape(self, max_pages: int = 20) -> tuple[int, int]:
        total_found = 0
        total_new = 0

        async with async_playwright() as pw:
            # Use installed Chrome (channel="chrome") rather than bundled Chromium.
            # house.lk is behind Cloudflare which fingerprints the browser binary;
            # real Chrome passes where Chromium is detected and blocked.
            try:
                browser = await pw.chromium.launch(
                    channel="chrome",
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-blink-features=AutomationControlled",
                    ],
                )
            except Exception:
                # Fallback to bundled Chromium if Chrome isn't installed
                browser = await pw.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-blink-features=AutomationControlled",
                    ],
                )
            ua = random.choice(USER_AGENTS)
            context = await browser.new_context(
                user_agent=ua,
                viewport={"width": 1280, "height": 800},
                locale="en-US",
                ignore_https_errors=True,
            )
            await context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )
            page = await context.new_page()

            consecutive_blocks = 0

            # Warm up — visit homepage first so Cloudflare sees a natural session
            try:
                await page.goto(BASE, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(random.uniform(2.0, 4.0))
            except Exception:
                pass

            for target in BASE_URLS:
                if consecutive_blocks >= self.stop_after_blocks:
                    log.warning("houseLk_too_many_blocks_stopping")
                    break

                for page_num in range(1, max_pages + 1):
                    url = _page_url(target["url"], page_num)
                    log.info("houseLk_scraping", url=url, page=page_num)

                    ok = await self._safe_goto(page, url)
                    if not ok:
                        consecutive_blocks += 1
                        log.warning("houseLk_skip_page", url=url)
                        break

                    consecutive_blocks = 0
                    await asyncio.sleep(random.uniform(2.0, 4.0))

                    items = await self._parse_listings(page, target["listing_type"], target["property_type"])
                    if not items:
                        log.info("houseLk_no_more_listings", url=url, page=page_num)
                        break

                    found, new = self._upsert(items)
                    total_found += found
                    total_new += new
                    log.info("houseLk_page_done", url=url, found=found, new=new)

                    # Stop paginating early if we're hitting all duplicates
                    if new == 0 and page_num > 2:
                        log.info("houseLk_all_duplicates_stopping", url=url, page=page_num)
                        break

                    await asyncio.sleep(random.uniform(1.5, 3.5))

            await browser.close()

        self.db.add(ScrapeRun(
            source=self.SOURCE,
            started_at=datetime.utcnow(),
            finished_at=datetime.utcnow(),
            listings_found=total_found,
            listings_new=total_new,
        ))
        self.db.commit()
        log.info("houseLk_scrape_complete", total_found=total_found, total_new=total_new)
        return total_found, total_new
