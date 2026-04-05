"""
Detail Enricher — visits individual ikman/lpw listing pages to extract
structured attributes (size, bedrooms, bathrooms, exact location) that
are not visible on search-result cards.

Runs as a background job after the main scrape+clean pipeline.
Only visits listings that are still missing key fields.
"""
import asyncio
import json
import random
import re
import os
from datetime import datetime
from typing import Optional
import structlog
from playwright.async_api import async_playwright
from sqlalchemy.orm import Session
from db.models import Listing, RawListing

log = structlog.get_logger()

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
]

# ── Ikman attribute selectors (current site structure) ──────────────────────
# ikman.lk embeds Next.js __NEXT_DATA__ with all structured listing data.
# We try that first; fall back to DOM attribute chips.

IKMAN_ATTR_SELECTORS = [
    "[data-qa='ad-attributes'] li",
    "[class*='attributes--'] li",
    "[class*='KeyInformation'] li",
    "ul[class*='attribute'] li",
    "[class*='ad-info'] li",
]

LPW_ATTR_SELECTORS = [
    "table.table tr",
    "[class*='detail'] tr",
    ".listing-details tr",
]


def _parse_int(text: str) -> Optional[int]:
    m = re.search(r"(\d+)", text)
    return int(m.group(1)) if m else None


def _parse_float(text: str) -> Optional[float]:
    m = re.search(r"(\d+\.?\d*)", text)
    return float(m.group(1)) if m else None


def _perch_from_text(text: str) -> Optional[float]:
    t = text.lower()
    if "acre" in t:
        m = re.search(r"(\d+\.?\d*)", t)
        return float(m.group(1)) * 160 if m else None
    if "perch" in t or re.search(r"\bp\b", t):
        return _parse_float(t)
    # bare number next to "P" abbreviation: "15 P"
    m = re.search(r"(\d+\.?\d*)\s*p\b", t)
    return float(m.group(1)) if m else None


async def _extract_ikman(page) -> dict:
    """Extract structured attributes from an ikman.lk detail page."""
    attrs: dict = {}

    # ── 1. Try __NEXT_DATA__ JSON (fastest, most reliable) ──────────────────
    try:
        next_data_el = await page.query_selector("#__NEXT_DATA__")
        if next_data_el:
            raw_json = await next_data_el.inner_text()
            data = json.loads(raw_json)
            # Navigate the Next.js page props tree
            ad = (
                data.get("props", {})
                    .get("pageProps", {})
                    .get("ad", {})
            )
            if not ad:
                # Some versions nest it differently
                ad = (
                    data.get("props", {})
                        .get("pageProps", {})
                        .get("adData", {})
                )

            if ad:
                # ikman.lk standard fields
                attrs["raw_price"]    = ad.get("price", {}).get("text") or ad.get("price_text")
                attrs["raw_location"] = (
                    ad.get("location", {}).get("full_name")
                    or ad.get("ad_location", {}).get("full_name")
                )
                attrs["title"] = ad.get("title")

                # Structured attributes list
                for item in ad.get("attributes", []):
                    name  = str(item.get("name", "")).lower()
                    value = str(item.get("value", "")).strip()
                    if not value or value in ("null", "None", ""):
                        continue

                    if "size" in name or "land" in name or "area" in name or "perch" in name:
                        attrs["raw_size"] = value
                        p = _perch_from_text(value)
                        if p:
                            attrs["size_perches"] = p
                    elif "sqft" in name or "sq ft" in name or "floor" in name:
                        attrs["raw_size"] = value
                        attrs["size_sqft"] = _parse_float(value)
                    elif "bedroom" in name or "bed" in name:
                        attrs["bedrooms"] = _parse_int(value)
                    elif "bathroom" in name or "bath" in name:
                        attrs["bathrooms"] = _parse_int(value)

                return attrs
    except Exception as e:
        log.debug("ikman_next_data_fail", error=str(e))

    # ── 2. DOM fallback: attribute chips ────────────────────────────────────
    try:
        for sel in IKMAN_ATTR_SELECTORS:
            chips = await page.query_selector_all(sel)
            if not chips:
                continue
            for chip in chips:
                text = (await chip.inner_text()).strip().lower()
                if not text:
                    continue

                # Size
                if any(k in text for k in ("perch", " p ", " p\n", "acre", "sqft", "sq ft")):
                    attrs["raw_size"] = text
                    p = _perch_from_text(text)
                    if p:
                        attrs["size_perches"] = p
                    else:
                        sqft = _parse_float(text)
                        if sqft:
                            attrs["size_sqft"] = sqft

                # Bedrooms
                elif "bed" in text:
                    n = _parse_int(text)
                    if n:
                        attrs["bedrooms"] = n

                # Bathrooms
                elif "bath" in text:
                    n = _parse_int(text)
                    if n:
                        attrs["bathrooms"] = n

            if attrs:
                break
    except Exception as e:
        log.debug("ikman_dom_fail", error=str(e))

    return attrs


async def _extract_lpw(page) -> dict:
    """Extract structured attributes from a lankapropertyweb.com detail page."""
    attrs: dict = {}
    try:
        for sel in LPW_ATTR_SELECTORS:
            rows = await page.query_selector_all(sel)
            for row in rows:
                text = (await row.inner_text()).strip().lower()
                if "perch" in text or "acre" in text:
                    p = _perch_from_text(text)
                    if p:
                        attrs["size_perches"] = p
                        attrs["raw_size"] = text
                elif "bed" in text:
                    n = _parse_int(text)
                    if n:
                        attrs["bedrooms"] = n
                elif "bath" in text:
                    n = _parse_int(text)
                    if n:
                        attrs["bathrooms"] = n
    except Exception as e:
        log.debug("lpw_dom_fail", error=str(e))
    return attrs


class DetailEnricher:
    """Visits individual listing URLs to fill in missing structured fields."""

    def __init__(self, db: Session):
        self.db = db
        self.max_per_run = int(os.getenv("ENRICHER_MAX_PER_RUN", "200"))
        self.delay_min = float(os.getenv("ENRICHER_DELAY_MIN", "1.5"))
        self.delay_max = float(os.getenv("ENRICHER_DELAY_MAX", "3.5"))

    async def enrich(self) -> dict:
        """
        Find listings missing size/bedrooms and visit their source URLs.
        Returns stats dict.
        """
        # Join listings with raw_listings to get the URL
        rows = (
            self.db.query(Listing, RawListing.url, RawListing.source)
            .join(RawListing, Listing.raw_id == RawListing.id)
            .filter(
                Listing.is_outlier == False,
                Listing.size_perches.is_(None),
                Listing.size_sqft.is_(None),
                RawListing.url.isnot(None),
                RawListing.source.in_(["ikman", "lpw"]),
            )
            .order_by(Listing.first_seen_at.desc())
            .limit(self.max_per_run)
            .all()
        )

        if not rows:
            log.info("detail_enricher_nothing_to_do")
            return {"visited": 0, "enriched": 0}

        stats = {"visited": 0, "enriched": 0, "errors": 0}

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox",
                      "--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1280, "height": 800},
                locale="en-US",
            )
            await context.add_init_script(
                "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
            )
            # Block images/media to speed up loads
            await context.route(
                "**/*",
                lambda route: route.abort()
                if route.request.resource_type in ("image", "media", "font", "stylesheet")
                else route.continue_(),
            )
            page = await context.new_page()

            for listing, url, source in rows:
                stats["visited"] += 1
                try:
                    resp = await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                    if resp and resp.status >= 400:
                        continue

                    await asyncio.sleep(random.uniform(0.5, 1.2))

                    if source == "ikman":
                        attrs = await _extract_ikman(page)
                    elif source == "lpw":
                        attrs = await _extract_lpw(page)
                    else:
                        attrs = {}

                    if not attrs:
                        continue

                    changed = False

                    if attrs.get("size_perches") and listing.size_perches is None:
                        listing.size_perches = attrs["size_perches"]
                        changed = True
                    if attrs.get("size_sqft") and listing.size_sqft is None:
                        listing.size_sqft = attrs["size_sqft"]
                        changed = True
                    if attrs.get("bedrooms") and listing.bedrooms is None:
                        listing.bedrooms = attrs["bedrooms"]
                        changed = True
                    if attrs.get("bathrooms") and listing.bathrooms is None:
                        listing.bathrooms = attrs["bathrooms"]
                        changed = True

                    # Back-calculate total price if we now have size + price_per_perch
                    if (
                        listing.size_perches
                        and listing.price_per_perch
                        and listing.price_lkr is None
                    ):
                        listing.price_lkr = listing.price_per_perch * listing.size_perches
                        if listing.original_price_lkr is None:
                            listing.original_price_lkr = listing.price_lkr
                        changed = True

                    if changed:
                        stats["enriched"] += 1
                        self.db.add(listing)

                except Exception as e:
                    stats["errors"] += 1
                    log.debug("enrich_error", url=url, error=str(e))

                if stats["visited"] % 20 == 0:
                    self.db.commit()
                    log.info("detail_enricher_progress", **stats)

                await asyncio.sleep(random.uniform(self.delay_min, self.delay_max))

            await browser.close()

        self.db.commit()
        log.info("detail_enricher_complete", **stats)
        return stats

    async def check_price_changes(self) -> dict:
        """
        Visit listings that already have a price and check whether the current
        advertised price has changed. Updates price_lkr and sets original_price_lkr
        to the first-seen price if a drop is detected.
        Only checks listings seen within the last 60 days (likely still active).
        """
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=60)

        rows = (
            self.db.query(Listing, RawListing.url, RawListing.source)
            .join(RawListing, Listing.raw_id == RawListing.id)
            .filter(
                Listing.is_outlier == False,
                Listing.price_lkr.isnot(None),
                Listing.last_seen_at >= cutoff,
                RawListing.url.isnot(None),
                RawListing.source.in_(["ikman", "lpw"]),
            )
            .order_by(Listing.last_seen_at.desc())
            .limit(self.max_per_run)
            .all()
        )

        if not rows:
            return {"visited": 0, "price_drops": 0, "price_rises": 0}

        stats: dict = {"visited": 0, "price_drops": 0, "price_rises": 0, "errors": 0}

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox",
                      "--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1280, "height": 800},
                locale="en-US",
            )
            await context.add_init_script(
                "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
            )
            await context.route(
                "**/*",
                lambda route: route.abort()
                if route.request.resource_type in ("image", "media", "font", "stylesheet")
                else route.continue_(),
            )
            page = await context.new_page()

            for listing, url, source in rows:
                stats["visited"] += 1
                try:
                    resp = await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                    if resp and resp.status in (404, 410):
                        # Listing removed — mark last_seen as-is, skip
                        continue
                    if resp and resp.status >= 400:
                        continue

                    await asyncio.sleep(random.uniform(0.5, 1.0))

                    if source == "ikman":
                        attrs = await _extract_ikman(page)
                    elif source == "lpw":
                        attrs = await _extract_lpw(page)
                    else:
                        attrs = {}

                    # Parse a numeric price from whatever the page returned
                    new_price = None
                    if attrs.get("raw_price"):
                        raw = str(attrs["raw_price"]).replace(",", "").replace("Rs", "").strip()
                        # Handle "300,000 per perch" style — only use if we have size
                        if "per perch" in raw.lower() and listing.size_perches:
                            m = re.search(r"(\d+\.?\d*)", raw)
                            if m:
                                new_price = float(m.group(1)) * float(listing.size_perches)
                        elif "million" in raw.lower() or "mn" in raw.lower():
                            m = re.search(r"(\d+\.?\d*)", raw)
                            if m:
                                new_price = float(m.group(1)) * 1_000_000
                        else:
                            m = re.search(r"(\d[\d,]*\.?\d*)", raw)
                            if m:
                                new_price = float(m.group(1).replace(",", ""))

                    if new_price and new_price > 10_000:  # sanity floor
                        current = float(listing.price_lkr)
                        diff_pct = (new_price - current) / current * 100

                        if diff_pct < -1:  # >1% drop
                            # Preserve original if not already set
                            if listing.original_price_lkr is None:
                                listing.original_price_lkr = listing.price_lkr
                            listing.price_lkr = new_price
                            listing.last_seen_at = datetime.utcnow()
                            self.db.add(listing)
                            stats["price_drops"] += 1
                            log.info("price_drop_detected",
                                     id=listing.id,
                                     old=current,
                                     new=new_price,
                                     pct=round(diff_pct, 1))

                        elif diff_pct > 1:  # >1% rise
                            listing.price_lkr = new_price
                            listing.last_seen_at = datetime.utcnow()
                            self.db.add(listing)
                            stats["price_rises"] += 1

                except Exception as e:
                    stats["errors"] += 1
                    log.debug("price_check_error", url=url, error=str(e))

                if stats["visited"] % 20 == 0:
                    self.db.commit()
                    log.info("price_check_progress", **stats)

                await asyncio.sleep(random.uniform(self.delay_min, self.delay_max))

            await browser.close()

        self.db.commit()
        log.info("price_check_complete", **stats)
        return stats
