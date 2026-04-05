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
from sqlalchemy import text
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

LAMUDI_ATTR_SELECTORS = [
    # house.lk (formerly lamudi.lk) detail page — verified 2026-04
    "li.first_overview_date",
    # fallback legacy selectors
    ".KeyInformation-attribute",
    "[class*='attribute--']",
    "[data-cy='listing-attributes'] li",
    ".listing-keyinfo li",
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

    # ── 1. Try window.initialData (current ikman structure as of 2026) ───────
    try:
        html = await page.content()
        marker = "window.initialData = {"
        idx = html.find(marker)
        if idx != -1:
            chunk = html[idx + len(marker) - 1:]
            end = chunk.find("</script>")
            chunk = chunk[:end].rstrip().rstrip(";")
            data = json.loads(chunk)
            ad = (
                data.get("adDetail", {})
                    .get("data", {})
                    .get("ad", {})
            )
            if ad:
                # Location from nested parent district name
                loc = ad.get("location", {})
                parent = loc.get("parent", {})
                attrs["raw_location"] = parent.get("name") or loc.get("name")
                attrs["title"] = ad.get("title")

                # properties list: [{label, value, key, value_key}]
                for prop in ad.get("properties", []):
                    key   = str(prop.get("key", "")).lower()
                    label = str(prop.get("label", "")).lower()
                    value = str(prop.get("value", "")).strip()
                    if not value or value in ("null", "None", ""):
                        continue

                    is_size = key == "size" or "size" in label or "land" in label or "floor" in label or "area" in label
                    is_bed  = key in ("bedrooms", "beds") or "bedroom" in label or "bed" in label
                    is_bath = key in ("bathrooms", "baths") or "bathroom" in label or "bath" in label

                    if is_size:
                        attrs["raw_size"] = value
                        p = _perch_from_text(value)
                        if p:
                            attrs["size_perches"] = p
                        elif any(k in value.lower() for k in ("sqft", "sq ft", "sq. ft", "sqm")):
                            attrs["size_sqft"] = _parse_float(value)
                    elif is_bed:
                        attrs["bedrooms"] = _parse_int(value)
                    elif is_bath:
                        attrs["bathrooms"] = _parse_int(value)

                # Fallback 1: ad.details summary string
                if "size_perches" not in attrs and "size_sqft" not in attrs:
                    details = ad.get("details", "")
                    if details:
                        p = _perch_from_text(details)
                        if p:
                            attrs["size_perches"] = p
                            attrs["raw_size"] = details
                        elif any(k in details.lower() for k in ("sqft", "sq ft", "sqm")):
                            attrs["size_sqft"] = _parse_float(details)
                            attrs["raw_size"] = details

                # Fallback 2: scan description text for size patterns
                # (some sellers write "189 perches" in description but leave size field blank/0)
                if "size_perches" not in attrs and "size_sqft" not in attrs:
                    desc = ad.get("description", "") or ""
                    # Look for "X perch(es)" or "land extent: X" patterns
                    perch_matches = re.findall(
                        r'(\d+(?:\.\d+)?)\s*(?:perch(?:es)?|p(?:\s|$))',
                        desc, re.IGNORECASE
                    )
                    if perch_matches:
                        p = float(perch_matches[0])
                        if 0 < p < 10000:  # sanity check
                            attrs["size_perches"] = p
                            attrs["raw_size"] = f"{p} perches (from description)"
                    elif any(k in desc.lower() for k in ("sqft", "sq ft", "sq. ft")):
                        sqft_matches = re.findall(r'(\d[\d,]*)\s*(?:sqft|sq\.?\s*ft)', desc, re.IGNORECASE)
                        if sqft_matches:
                            s = float(sqft_matches[0].replace(",", ""))
                            if 0 < s < 100000:
                                attrs["size_sqft"] = s
                                attrs["raw_size"] = f"{s} sqft (from description)"

                if attrs:
                    return attrs
    except Exception as e:
        log.debug("ikman_initial_data_fail", error=str(e))

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

                if any(k in text for k in ("perch", " p ", " p\n", "acre", "sqft", "sq ft")):
                    attrs["raw_size"] = text
                    p = _perch_from_text(text)
                    if p:
                        attrs["size_perches"] = p
                    else:
                        sqft = _parse_float(text)
                        if sqft:
                            attrs["size_sqft"] = sqft
                elif "bed" in text:
                    n = _parse_int(text)
                    if n:
                        attrs["bedrooms"] = n
                elif "bath" in text:
                    n = _parse_int(text)
                    if n:
                        attrs["bathrooms"] = n

            if attrs:
                break
    except Exception as e:
        log.debug("ikman_dom_fail", error=str(e))

    return attrs


async def _extract_lamudi(page) -> dict:
    """Extract structured attributes from a lamudi.lk detail page."""
    attrs: dict = {}

    # 1. Try JSON-LD (Lamudi embeds schema.org markup)
    try:
        scripts = await page.query_selector_all('script[type="application/ld+json"]')
        for script in scripts:
            raw = await script.inner_text()
            data = json.loads(raw)
            # May be a list or single object
            if isinstance(data, list):
                data = next((d for d in data if d.get("@type") in ("Product", "RealEstateListing", "Offer")), data[0] if data else {})
            offer = data.get("offers", {}) or {}
            price = offer.get("price") or data.get("price")
            if price:
                attrs["raw_price"] = str(price)
            loc = data.get("address", {})
            if isinstance(loc, dict):
                locality = loc.get("addressLocality") or loc.get("addressRegion")
                if locality:
                    attrs["raw_location"] = locality
            # Floor size / lot size
            floor = data.get("floorSize", {})
            if isinstance(floor, dict) and floor.get("value"):
                attrs["raw_size"] = f"{floor['value']} {floor.get('unitText','sqft')}"
                attrs["size_sqft"] = _parse_float(str(floor["value"]))
            lot = data.get("lotSize", {})
            if isinstance(lot, dict) and lot.get("value"):
                attrs["raw_size"] = f"{lot['value']} {lot.get('unitText','perch')}"
                p = _perch_from_text(attrs["raw_size"])
                if p:
                    attrs["size_perches"] = p
            beds = data.get("numberOfRooms") or data.get("numberOfBedrooms")
            if beds:
                attrs["bedrooms"] = _parse_int(str(beds))
            baths = data.get("numberOfBathroomsTotal") or data.get("numberOfBathrooms")
            if baths:
                attrs["bathrooms"] = _parse_int(str(baths))
            if attrs:
                return attrs
    except Exception as e:
        log.debug("lamudi_jsonld_fail", error=str(e))

    # 2. Price from .price_area (house.lk detail page)
    try:
        price_el = await page.query_selector(".price_area")
        if price_el:
            attrs["raw_price"] = (await price_el.inner_text()).strip()
    except Exception:
        pass

    # 3. DOM attribute chips (house.lk uses li.first_overview_date)
    try:
        for sel in LAMUDI_ATTR_SELECTORS:
            chips = await page.query_selector_all(sel)
            if not chips:
                continue
            for chip in chips:
                text = (await chip.inner_text()).strip().lower()
                if not text:
                    continue
                if any(k in text for k in ("perch", "acre", "sqft", "sq ft", "sq. ft", "sq.ft", "sqm")):
                    attrs["raw_size"] = text
                    p = _perch_from_text(text)
                    if p:
                        attrs["size_perches"] = p
                    else:
                        sqft = _parse_float(text)
                        if sqft:
                            attrs["size_sqft"] = sqft
                elif "bed" in text:
                    n = _parse_int(text)
                    if n:
                        attrs["bedrooms"] = n
                elif "bath" in text:
                    n = _parse_int(text)
                    if n:
                        attrs["bathrooms"] = n
            if attrs:
                break
    except Exception as e:
        log.debug("lamudi_dom_fail", error=str(e))

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
        # Phase 1: fetch IDs + URLs as plain tuples, then immediately close the
        # transaction so no connection is held during the slow Playwright phase.
        raw_rows = (
            self.db.query(Listing.id, RawListing.url, RawListing.source)
            .join(RawListing, Listing.raw_id == RawListing.id)
            .filter(
                Listing.is_outlier == False,
                Listing.size_perches.is_(None),
                Listing.size_sqft.is_(None),
                Listing.enrichment_attempted_at.is_(None),
                RawListing.url.isnot(None),
                RawListing.source.in_(["ikman", "lpw", "lamudi"]),
            )
            .order_by(Listing.first_seen_at.desc())
            .limit(self.max_per_run)
            .all()
        )
        self.db.commit()  # close transaction — no connection held during Playwright

        if not raw_rows:
            log.info("detail_enricher_nothing_to_do")
            return {"visited": 0, "enriched": 0}

        stats = {"visited": 0, "enriched": 0, "errors": 0}

        # Phase 2: visit pages concurrently, collect results in memory
        results: dict[int, dict] = {}
        visited_ids: set[int] = set()  # all IDs we attempted, regardless of outcome
        concurrency = int(os.getenv("ENRICHER_CONCURRENCY", "6"))
        semaphore = asyncio.Semaphore(concurrency)

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox",
                      "--disable-blink-features=AutomationControlled"],
            )

            async def visit(listing_id: int, url: str, source: str):
                async with semaphore:
                    page = await browser.new_page(
                        user_agent=random.choice(USER_AGENTS),
                        viewport={"width": 1280, "height": 800},
                        locale="en-US",
                    )
                    await page.add_init_script(
                        "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
                    )
                    await page.route(
                        "**/*",
                        lambda route: route.abort()
                        if route.request.resource_type in ("image", "media", "font", "stylesheet")
                        else route.continue_(),
                    )
                    try:
                        resp = await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                        visited_ids.add(listing_id)  # mark attempted regardless of outcome
                        if resp and resp.status >= 400:
                            return
                        await asyncio.sleep(random.uniform(0.3, 0.8))
                        if source == "ikman":
                            attrs = await _extract_ikman(page)
                        elif source == "lpw":
                            attrs = await _extract_lpw(page)
                        elif source == "lamudi":
                            attrs = await _extract_lamudi(page)
                        else:
                            attrs = {}
                        if attrs:
                            results[listing_id] = attrs
                    except Exception as e:
                        visited_ids.add(listing_id)  # still mark as attempted on error
                        stats["errors"] += 1
                        log.debug("enrich_error", url=url, error=str(e))
                    finally:
                        stats["visited"] += 1
                        await page.close()

            await asyncio.gather(*[visit(lid, url, src) for lid, url, src in raw_rows])
            await browser.close()

        # Phase 3: write results — short-lived DB transactions, no Playwright overhead
        # Also stamp enrichment_attempted_at on every listing we visited (success OR failure)
        # so they are skipped on future runs.
        now = datetime.utcnow()
        all_ids_to_stamp = visited_ids  # full set including those with no attrs found

        written = 0
        for listing_id in all_ids_to_stamp:
            try:
                listing = self.db.get(Listing, listing_id)
                if listing is None:
                    continue

                # Always record that we attempted this listing
                listing.enrichment_attempted_at = now

                attrs = results.get(listing_id, {})
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
                if (
                    listing.size_perches
                    and listing.price_per_perch
                    and listing.price_lkr is None
                ):
                    listing.price_lkr = float(listing.price_per_perch) * float(listing.size_perches)
                    if listing.original_price_lkr is None:
                        listing.original_price_lkr = listing.price_lkr
                    changed = True

                if changed:
                    stats["enriched"] += 1

                self.db.add(listing)
                written += 1
                if written % 50 == 0:
                    self.db.commit()
                    log.info("detail_enricher_progress", **stats)

            except Exception as e:
                stats["errors"] += 1
                log.debug("enrich_write_error", listing_id=listing_id, error=str(e))

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

        # Phase 1: fetch IDs, current prices, URLs as plain tuples — close transaction immediately
        raw_rows = (
            self.db.query(Listing.id, Listing.price_lkr, Listing.size_perches, RawListing.url, RawListing.source)
            .join(RawListing, Listing.raw_id == RawListing.id)
            .filter(
                Listing.is_outlier == False,
                Listing.price_lkr.isnot(None),
                Listing.last_seen_at >= cutoff,
                RawListing.url.isnot(None),
                RawListing.source.in_(["ikman", "lpw", "lamudi"]),
            )
            .order_by(Listing.last_seen_at.desc())
            .limit(self.max_per_run)
            .all()
        )
        self.db.commit()  # close transaction — no connection held during Playwright

        if not raw_rows:
            return {"visited": 0, "price_drops": 0, "price_rises": 0}

        stats: dict = {"visited": 0, "price_drops": 0, "price_rises": 0, "errors": 0}

        # Phase 2: visit pages, collect new prices in memory
        price_updates: dict[int, float] = {}  # listing_id -> new_price

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

            for listing_id, price_lkr, size_perches, url, source in raw_rows:
                stats["visited"] += 1
                try:
                    resp = await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                    if resp and resp.status in (404, 410):
                        continue
                    if resp and resp.status >= 400:
                        continue

                    await asyncio.sleep(random.uniform(0.5, 1.0))

                    if source == "ikman":
                        attrs = await _extract_ikman(page)
                    elif source == "lpw":
                        attrs = await _extract_lpw(page)
                    elif source == "lamudi":
                        attrs = await _extract_lamudi(page)
                    else:
                        attrs = {}

                    new_price = None
                    if attrs.get("raw_price"):
                        raw = str(attrs["raw_price"]).replace(",", "").replace("Rs", "").strip()
                        if "per perch" in raw.lower() and size_perches:
                            m = re.search(r"(\d+\.?\d*)", raw)
                            if m:
                                new_price = float(m.group(1)) * float(size_perches)
                        elif "million" in raw.lower() or "mn" in raw.lower():
                            m = re.search(r"(\d+\.?\d*)", raw)
                            if m:
                                new_price = float(m.group(1)) * 1_000_000
                        else:
                            m = re.search(r"(\d[\d,]*\.?\d*)", raw)
                            if m:
                                new_price = float(m.group(1).replace(",", ""))

                    if new_price and new_price > 10_000:
                        price_updates[listing_id] = (float(price_lkr), new_price)

                except Exception as e:
                    stats["errors"] += 1
                    log.debug("price_check_error", url=url, error=str(e))

                await asyncio.sleep(random.uniform(self.delay_min, self.delay_max))

            await browser.close()

        # Phase 3: apply price updates — short DB transactions
        written = 0
        for listing_id, (current, new_price) in price_updates.items():
            try:
                diff_pct = (new_price - current) / current * 100
                if abs(diff_pct) <= 1:
                    continue

                listing = self.db.get(Listing, listing_id)
                if listing is None:
                    continue

                if diff_pct < -1:
                    if listing.original_price_lkr is None:
                        listing.original_price_lkr = listing.price_lkr
                    listing.price_lkr = new_price
                    listing.last_seen_at = datetime.utcnow()
                    self.db.add(listing)
                    stats["price_drops"] += 1
                    log.info("price_drop_detected",
                             id=listing_id,
                             old=current,
                             new=new_price,
                             pct=round(diff_pct, 1))
                else:
                    listing.price_lkr = new_price
                    listing.last_seen_at = datetime.utcnow()
                    self.db.add(listing)
                    stats["price_rises"] += 1

                written += 1
                if written % 20 == 0:
                    self.db.commit()
                    log.info("price_check_progress", **stats)

            except Exception as e:
                stats["errors"] += 1
                log.debug("price_write_error", listing_id=listing_id, error=str(e))

        self.db.commit()
        log.info("price_check_complete", **stats)
        return stats
