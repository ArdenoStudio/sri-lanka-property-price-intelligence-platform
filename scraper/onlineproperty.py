"""
Scraper for onlineproperty.lk
WordPress site using the RTCL Classified Listing plugin.
Server-rendered HTML — no Playwright needed, plain httpx + BeautifulSoup.
"""
import asyncio
import random
import re
import os
import hashlib
from datetime import datetime
import httpx
from bs4 import BeautifulSoup
import structlog
from db.models import RawListing, ListingSnapshot
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from scraper.utils import build_snapshot_fingerprint

log = structlog.get_logger()

SOURCE = "onlineproperty"
BASE = "https://onlineproperty.lk"

# All property categories available on the site
# URL pattern: /all-ads/listing-category/<slug>/page/<n>/
CATEGORIES = [
    {"slug": "houses-for-sale",              "property_type": "house",      "listing_type": "sale"},
    {"slug": "land-for-sale",                "property_type": "land",       "listing_type": "sale"},
    {"slug": "apartments-flats-for-sale",    "property_type": "apartment",  "listing_type": "sale"},
    {"slug": "commercial-property-for-sale", "property_type": "commercial", "listing_type": "sale"},
    {"slug": "houses-for-rent",              "property_type": "house",      "listing_type": "rent"},
    {"slug": "annexes-for-rent",             "property_type": "house",      "listing_type": "rent"},
    {"slug": "apartments-flats-for-rent",    "property_type": "apartment",  "listing_type": "rent"},
    {"slug": "commercial-property-for-rent", "property_type": "commercial", "listing_type": "rent"},
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
]


def _category_url(slug: str, page: int) -> str:
    if page == 1:
        return f"{BASE}/all-ads/listing-category/{slug}/"
    return f"{BASE}/all-ads/listing-category/{slug}/page/{page}/"


def _clean_price(raw: str) -> str:
    """Normalise price text — strip suffixes the cleaner doesn't handle."""
    if not raw:
        return ""
    # "රු 48,500,000total price" → "රු 48,500,000"
    # "රු 25,000per month"       → "රු 25,000 Per Month"
    s = raw
    s = s.replace("total price", "").replace("Total Price", "")
    s = s.replace("per month", " Per Month").replace("Per month", " Per Month")
    s = s.replace("per perch", " Per Perch").replace("Per perch", " Per Perch")
    # Strip Sinhala rupee symbol — cleaner only knows Rs./LKR
    s = s.replace("රු", "Rs.")
    return re.sub(r"\s+", " ", s).strip()


def _parse_location(meta_items: list) -> str:
    """Location is usually the second meta item (first is time ago)."""
    for item in meta_items:
        text = item.get_text(strip=True)
        # Skip time-ago items like "1 year ago", "3 months ago"
        if re.search(r"\d+\s+(year|month|week|day|hour|minute)", text, re.I):
            continue
        if text:
            return text
    return ""


def _parse_cards(html: str, property_type: str, listing_type: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select(".listing-grid-each")
    items = []

    for card in cards:
        try:
            # Title + URL
            title_el = card.select_one(".rtin-title a") or card.select_one("h2 a, h3 a, h4 a")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            url = title_el.get("href", "").strip()
            if not url or not title:
                continue

            # Price
            price_el = card.select_one(".rtin-price")
            raw_price = _clean_price(price_el.get_text()) if price_el else ""

            # Location from meta items
            meta_items = card.select(".rtin-meta li")
            raw_location = _parse_location(meta_items)

            # Source ID from URL slug — capped at 100 chars (DB column limit)
            slug = url.rstrip("/").split("/")[-1]
            source_id = slug[:100] if len(slug) <= 100 else hashlib.sha1(slug.encode()).hexdigest()

            items.append({
                "source": SOURCE,
                "source_id": source_id,
                "title": title,
                "url": url,
                "raw_price": raw_price,
                "raw_location": raw_location,
                "property_type": property_type,
                "listing_type": listing_type,
            })
        except Exception as e:
            log.debug("onlineproperty_parse_card_error", error=str(e))

    return items


async def _fetch_page(client: httpx.AsyncClient, url: str, retries: int = 3) -> str | None:
    backoff = float(os.getenv("SCRAPER_BACKOFF_BASE_SECONDS", "5"))
    backoff_max = float(os.getenv("SCRAPER_BACKOFF_MAX_SECONDS", "60"))

    for attempt in range(retries):
        try:
            ua = random.choice(USER_AGENTS)
            resp = await client.get(url, headers={"User-Agent": ua}, timeout=20)
            if resp.status_code == 404:
                return None  # past last page
            if resp.status_code >= 400:
                raise RuntimeError(f"http_{resp.status_code}")
            return resp.text
        except Exception as e:
            delay = min(backoff * (2 ** attempt), backoff_max) + random.uniform(0, backoff * 0.2)
            log.warning("onlineproperty_page_retry", url=url, attempt=attempt + 1,
                        delay=round(delay, 2), error=str(e))
            await asyncio.sleep(delay)
    return None


def _upsert_listings(db: Session, items: list[dict]) -> tuple[int, int]:
    found = len(items)
    new_count = 0
    now = datetime.utcnow()

    for item in items:
        fingerprint = build_snapshot_fingerprint(
            title=item["title"],
            raw_price=item["raw_price"],
            raw_location=item["raw_location"],
            raw_size="",
            property_type=item["property_type"],
            listing_type=item["listing_type"],
            url=item["url"],
        )

        # Snapshot upsert
        snap_stmt = insert(ListingSnapshot).values(
            source=item["source"],
            source_id=item["source_id"],
            raw_price=item["raw_price"],
            scraped_at=now,
            fingerprint=fingerprint,
        ).on_conflict_do_nothing(index_elements=["source", "source_id", "fingerprint"])
        db.execute(snap_stmt)

        # RawListing upsert
        stmt = insert(RawListing).values(
            source=item["source"],
            source_id=item["source_id"],
            title=item["title"],
            url=item["url"],
            raw_price=item["raw_price"],
            raw_location=item["raw_location"],
            property_type=item["property_type"],
            listing_type=item["listing_type"],
            scraped_at=now,
        ).on_conflict_do_update(
            index_elements=["source", "source_id"],
            set_={
                "title": item["title"],
                "raw_price": item["raw_price"],
                "raw_location": item["raw_location"],
                "scraped_at": now,
            }
        )
        result = db.execute(stmt)
        if result.rowcount and result.rowcount > 0:
            new_count += 1

    db.commit()
    return found, new_count


async def scrape_onlineproperty(db: Session, max_pages: int = 30) -> dict:
    """Scrape all property categories from onlineproperty.lk."""
    total_found = 0
    total_new = 0
    stop_after_dupes = int(os.getenv("SCRAPER_STOP_AFTER_BLOCKS", "3"))

    log.info("onlineproperty_starting", max_pages=max_pages, source=SOURCE)

    async with httpx.AsyncClient(follow_redirects=True) as client:
        for cat in CATEGORIES:
            slug = cat["slug"]
            property_type = cat["property_type"]
            listing_type = cat["listing_type"]
            dupe_pages = 0

            for page in range(1, max_pages + 1):
                url = _category_url(slug, page)
                html = await _fetch_page(client, url)

                if html is None:
                    log.info("onlineproperty_category_done",
                             slug=slug, pages_scraped=page - 1)
                    break

                items = _parse_cards(html, property_type, listing_type)

                if not items:
                    log.info("onlineproperty_no_items", slug=slug, page=page)
                    break

                found, new = _upsert_listings(db, items)
                total_found += found
                total_new += new

                log.info("onlineproperty_page_done",
                         slug=slug, page=page, found=found, new=new)

                # Stop early if consecutive pages are all dupes
                if new == 0:
                    dupe_pages += 1
                    if dupe_pages >= stop_after_dupes:
                        log.info("onlineproperty_all_dupes_stopping",
                                 slug=slug, page=page)
                        break
                else:
                    dupe_pages = 0

                # Polite delay between pages
                await asyncio.sleep(random.uniform(1.5, 3.0))

            # Delay between categories
            await asyncio.sleep(random.uniform(2.0, 4.0))

    log.info("scraper_complete", source=SOURCE, found=total_found, new=total_new)
    return {"found": total_found, "new": total_new}
