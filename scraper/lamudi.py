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
from playwright.async_api import async_playwright

log = structlog.get_logger()

BLOCK_STATUSES = {403, 429, 503, 520, 521, 522, 524}
BLOCK_KEYWORDS = [
    "access denied",
    "captcha",
    "unusual traffic",
    "verify you are human",
    "blocked",
    "cloudflare",
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
]

BASE = "https://www.lamudi.lk"

BASE_URLS = [
    {"url": f"{BASE}/buy/",           "listing_type": "sale", "property_type": "house"},
    {"url": f"{BASE}/rent/",          "listing_type": "rent", "property_type": "house"},
    {"url": f"{BASE}/buy/land/",      "listing_type": "sale", "property_type": "land"},
    {"url": f"{BASE}/buy/apartment/", "listing_type": "sale", "property_type": "apartment"},
    {"url": f"{BASE}/rent/apartment/","listing_type": "rent", "property_type": "apartment"},
    {"url": f"{BASE}/buy/commercial/","listing_type": "sale", "property_type": "commercial"},
]


class LamudiScraper:
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
        items = []
        try:
            # Lamudi uses article cards or div cards — try multiple selectors
            cards = await page.query_selector_all(
                'article.ListingCell-content, div.ListingCell-content, '
                '[data-cy="listing-card"], .js-listing-cards-container .ListingCell'
            )
            if not cards:
                # fallback: any link that looks like a listing detail page
                cards = await page.query_selector_all('li[data-index]')
        except Exception:
            return items

        for card in cards:
            try:
                # Title
                title_el = await card.query_selector(
                    'h2.ListingCell-KeyInfo-title, .card-title, h3[itemprop="name"], [data-cy="listing-title"]'
                )
                title = (await title_el.inner_text()).strip() if title_el else None

                # URL
                link_el = await card.query_selector('a[href]')
                href = await link_el.get_attribute('href') if link_el else None
                if href and not href.startswith('http'):
                    href = BASE + href

                if not href:
                    continue

                # Source ID from URL slug
                source_id = href.rstrip('/').split('/')[-1] or href

                # Price
                price_el = await card.query_selector(
                    '.price, [itemprop="price"], .KeyInformation-attribute--price span, '
                    'span[data-cy="listing-price"], .ListingCell-KeyInfo-price-value'
                )
                raw_price = (await price_el.inner_text()).strip() if price_el else None

                # Location
                loc_el = await card.query_selector(
                    '.ListingCell-KeyInfo-address-text, [itemprop="addressLocality"], '
                    'span[data-cy="listing-location"], .location'
                )
                raw_location = (await loc_el.inner_text()).strip() if loc_el else None

                # Size
                size_el = await card.query_selector(
                    '[data-cy="listing-floorarea"], .ListingCell-KeyInfo-details span:first-child, '
                    '.KeyInformation-attribute--land_size span, .size'
                )
                raw_size = (await size_el.inner_text()).strip() if size_el else None

                # Bedrooms
                beds_el = await card.query_selector(
                    '[data-cy="listing-bedrooms"], .KeyInformation-attribute--bedrooms span, '
                    'span[title="bedrooms"]'
                )
                bedrooms_text = (await beds_el.inner_text()).strip() if beds_el else None
                bedrooms = None
                if bedrooms_text:
                    m = re.search(r'(\d+)', bedrooms_text)
                    bedrooms = int(m.group(1)) if m else None

                # Bathrooms
                baths_el = await card.query_selector(
                    '[data-cy="listing-bathrooms"], .KeyInformation-attribute--bathrooms span, '
                    'span[title="bathrooms"]'
                )
                baths_text = (await baths_el.inner_text()).strip() if baths_el else None
                bathrooms = None
                if baths_text:
                    m = re.search(r'(\d+)', baths_text)
                    bathrooms = int(m.group(1)) if m else None

                # Infer property_type from URL if it looks more specific
                pt = property_type
                if href:
                    if '/land/' in href:
                        pt = 'land'
                    elif '/apartment/' in href:
                        pt = 'apartment'
                    elif '/commercial/' in href:
                        pt = 'commercial'

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
                log.debug("lamudi_card_parse_error", error=str(e))

        return items

    def _upsert(self, items: list[dict]) -> tuple[int, int]:
        found = len(items)
        new_count = 0
        now = datetime.utcnow()

        for item in items:
            try:
                fingerprint = build_snapshot_fingerprint(
                    item["source_id"], item.get("raw_price", ""), item.get("raw_location", "")
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
                result = self.db.execute(raw_stmt)
                if result.rowcount and result.rowcount > 0:
                    new_count += 1
            except Exception as e:
                log.error("lamudi_upsert_error", source_id=item.get("source_id"), error=str(e))

        self.db.commit()
        return found, new_count

    async def scrape(self, max_pages: int = 10) -> tuple[int, int]:
        total_found = 0
        total_new = 0

        async with async_playwright() as pw:
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
            )
            await context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )
            page = await context.new_page()

            consecutive_blocks = 0

            for target in BASE_URLS:
                if consecutive_blocks >= self.stop_after_blocks:
                    log.warning("lamudi_too_many_blocks_stopping")
                    break

                for page_num in range(1, max_pages + 1):
                    sep = '&' if '?' in target["url"] else '?'
                    url = f"{target['url']}{sep}page={page_num}"
                    log.info("lamudi_scraping", url=url, page=page_num)

                    ok = await self._safe_goto(page, url)
                    if not ok:
                        consecutive_blocks += 1
                        log.warning("lamudi_skip_page", url=url)
                        break

                    consecutive_blocks = 0
                    await asyncio.sleep(random.uniform(1.5, 3.5))

                    items = await self._parse_listings(page, target["listing_type"], target["property_type"])
                    if not items:
                        log.info("lamudi_no_more_listings", url=url, page=page_num)
                        break

                    found, new = self._upsert(items)
                    total_found += found
                    total_new += new
                    log.info("lamudi_page_done", url=url, found=found, new=new)

                    await asyncio.sleep(random.uniform(2.0, 5.0))

            await browser.close()

        log.info("lamudi_scrape_complete", total_found=total_found, total_new=total_new)
        return total_found, total_new
