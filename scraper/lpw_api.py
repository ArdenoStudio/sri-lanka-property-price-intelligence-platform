"""LankaPropertyWeb API scraper — GET /api/v3/search2.

Uses the JWT + secure_key embedded in public HTML (same as the site frontend).
Behind USE_LPW_API; falls back to Playwright HTML scraper when disabled.
"""
from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime
from typing import Any, Optional
from urllib.parse import urljoin

import httpx
import structlog
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from db.models import ListingSnapshot, RawListing
from scraper.utils import build_snapshot_fingerprint

log = structlog.get_logger()

BASE = "https://www.lankapropertyweb.com"
SEARCH_URL = f"{BASE}/api/v3/search2"
BOOTSTRAP_URL = f"{BASE}/sale/index.php"
USER_AGENT = (
    "Mozilla/5.0 (compatible; PropertyLkBot/1.0; +https://github.com/ArdenoStudio/"
    "sri-lanka-property-price-intelligence-platform)"
)

# (api type, default property_type, listing_type)
SEARCH_TYPES = (
    ("sales", "house", "sale"),
    ("rentals", "house", "rent"),
    ("land", "land", "sale"),
)

TOKEN_RE = re.compile(
    r"""(?:token["'\s:=]+|token=)([A-Za-z0-9_\-]+=*\.[A-Za-z0-9_\-]+=*\.[A-Za-z0-9_\-+=]*)""",
    re.I,
)
SECURE_KEY_RE = re.compile(r"""secure_key["'\s:=]+([A-Za-z0-9]+)""", re.I)


def map_property_type(raw: str | None, default: str = "house") -> str:
    text = (raw or "").strip().lower()
    if not text:
        return default
    if "apartment" in text or "condo" in text or "flat" in text:
        return "apartment"
    if "land" in text:
        return "land"
    if "commercial" in text or "manufactur" in text or "office" in text or "shop" in text:
        return "commercial"
    if "villa" in text or "bungalow" in text or "house" in text:
        return "house"
    return default


def map_listing_type(api_type: str | None, fallback: str = "sale") -> str:
    t = (api_type or "").strip().lower()
    if t in {"rentals", "rent", "rental"}:
        return "rent"
    if t in {"sales", "sale", "land"}:
        return "sale"
    return fallback


def _safe_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        n = int(float(str(value).strip()))
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None


def build_raw_size(ad: dict[str, Any]) -> Optional[str]:
    floor = (ad.get("floor_area") or "").strip()
    if floor:
        return floor
    land_size = (ad.get("land_size") or "").strip()
    land_units = (ad.get("land_units") or "").strip()
    if land_size:
        return f"{land_size} {land_units}".strip()
    return None


def build_raw_location(ad: dict[str, Any]) -> Optional[str]:
    parts = []
    for key in ("city", "main_city", "area", "region"):
        val = (ad.get(key) or "").strip()
        if val and val not in parts:
            parts.append(val)
    return ", ".join(parts) if parts else None


def build_raw_price(ad: dict[str, Any]) -> Optional[str]:
    price_str = (ad.get("price_str") or "").strip()
    if price_str:
        return price_str
    price = ad.get("price")
    if price not in (None, "", "0", 0):
        return f"Rs {price}"
    month = (ad.get("price_month") or "").strip()
    if month:
        return month
    return None


def map_lpw_ad(
    ad: dict[str, Any],
    *,
    default_property_type: str = "house",
    default_listing_type: str = "sale",
) -> Optional[dict[str, Any]]:
    """Map one search2 ad into a RawListing-shaped dict. Pure — no I/O."""
    ad_id = ad.get("ad_id")
    if ad_id is None or str(ad_id).strip() == "":
        return None
    source_id = str(ad_id).strip()

    link = (ad.get("link") or "").strip()
    if link and not link.startswith("http"):
        link = urljoin(BASE + "/", link.lstrip("/"))
    if not link:
        link = f"{BASE}/sale/property_details-{source_id}.html"

    title = (
        (ad.get("heading_main") or ad.get("seo_heading") or ad.get("heading") or "").strip()
        or f"LPW listing {source_id}"
    )

    property_type = map_property_type(ad.get("property_type"), default_property_type)
    listing_type = map_listing_type(ad.get("type"), default_listing_type)

    rooms = _safe_int(ad.get("rooms"))
    bathrooms = _safe_int(ad.get("bathrooms"))
    lat = _safe_float(ad.get("lat"))
    lon = _safe_float(ad.get("lon"))

    raw_json = {
        "ingest": "lpw_api",
        "ad_id": source_id,
        "rooms": rooms,
        "bedrooms": rooms,
        "bathrooms": bathrooms,
        "lat": lat,
        "lon": lon,
        "lng": lon,
        "floor_area": ad.get("floor_area"),
        "land_size": ad.get("land_size"),
        "land_units": ad.get("land_units"),
        "price": ad.get("price"),
        "price_type": ad.get("price_type"),
        "price_sqft": ad.get("price_sqft"),
        "region": ad.get("region"),
        "city": ad.get("city"),
        "main_city": ad.get("main_city"),
        "area": ad.get("area"),
        "verified": ad.get("verified"),
    }

    return {
        "source": "lpw",
        "source_id": source_id,
        "url": link,
        "title": title,
        "raw_price": build_raw_price(ad),
        "raw_location": build_raw_location(ad),
        "raw_size": build_raw_size(ad),
        "property_type": property_type,
        "listing_type": listing_type,
        "description": (ad.get("description") or None),
        "raw_json": raw_json,
    }


def extract_bootstrap_credentials(html: str) -> tuple[Optional[str], Optional[str]]:
    token_m = TOKEN_RE.search(html or "")
    key_m = SECURE_KEY_RE.search(html or "")
    token = token_m.group(1) if token_m else None
    secure_key = key_m.group(1) if key_m else None
    return token, secure_key


class LPWApiScraper:
    SOURCE = "lpw"

    def __init__(self, db: Session):
        self.db = db
        self.limit = int(os.getenv("LPW_API_PAGE_LIMIT", "30"))
        self.request_delay = float(os.getenv("LPW_API_DELAY_SECONDS", "0.35"))
        self.max_pages = int(os.getenv("LPW_API_MAX_PAGES", "0"))  # 0 = all
        self.secure_key_fallback = os.getenv("LPW_SECURE_KEY", "2JIOMXS")

    async def _fetch_credentials(self, client: httpx.AsyncClient) -> tuple[str, str]:
        resp = await client.get(BOOTSTRAP_URL)
        resp.raise_for_status()
        token, secure_key = extract_bootstrap_credentials(resp.text)
        if not token:
            raise RuntimeError("LPW API token not found in bootstrap HTML")
        return token, secure_key or self.secure_key_fallback

    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        *,
        token: str,
        secure_key: str,
        api_type: str,
        start_point: int,
    ) -> dict[str, Any]:
        params = {
            "token": token,
            "site": "LPW",
            "secure_key": secure_key,
            "lang": "en",
            "type": api_type,
            "start_point": str(start_point),
            "limit": str(self.limit),
            "is_results_page": "Y",
            "pic_limit": "Y",
        }
        resp = await client.get(SEARCH_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, dict):
            raise RuntimeError(f"Unexpected LPW search2 payload type: {type(data)}")
        return data

    def _upsert_mapped(self, mapped: dict[str, Any]) -> bool:
        """Upsert one mapped listing. Returns True if new."""
        now = datetime.utcnow()
        exists = (
            self.db.query(RawListing.id)
            .filter_by(source=self.SOURCE, source_id=mapped["source_id"])
            .first()
        )

        fingerprint = build_snapshot_fingerprint(
            title=mapped.get("title") or "",
            raw_price=mapped.get("raw_price") or "",
            raw_location=mapped.get("raw_location") or "",
            raw_size=mapped.get("raw_size") or "",
            property_type=mapped.get("property_type") or "",
            listing_type=mapped.get("listing_type") or "",
            url=mapped.get("url") or "",
        )
        snap = insert(ListingSnapshot).values(
            source=self.SOURCE,
            source_id=mapped["source_id"],
            scraped_at=now,
            url=mapped["url"],
            title=mapped.get("title"),
            raw_price=mapped.get("raw_price"),
            raw_location=mapped.get("raw_location"),
            raw_size=mapped.get("raw_size"),
            property_type=mapped.get("property_type"),
            listing_type=mapped.get("listing_type"),
            raw_json=mapped.get("raw_json") or {},
            fingerprint=fingerprint,
        ).on_conflict_do_nothing(index_elements=["source", "source_id", "fingerprint"])
        self.db.execute(snap)

        stmt = insert(RawListing).values(
            source=self.SOURCE,
            source_id=mapped["source_id"],
            scraped_at=now,
            url=mapped["url"],
            title=mapped.get("title"),
            raw_price=mapped.get("raw_price"),
            raw_location=mapped.get("raw_location"),
            raw_size=mapped.get("raw_size"),
            property_type=mapped.get("property_type"),
            listing_type=mapped.get("listing_type"),
            description=mapped.get("description"),
            raw_json=mapped.get("raw_json") or {},
            is_processed=False,
        ).on_conflict_do_update(
            index_elements=["source", "source_id"],
            set_={
                "scraped_at": now,
                "raw_price": mapped.get("raw_price"),
                "raw_location": mapped.get("raw_location"),
                "raw_size": mapped.get("raw_size"),
                "property_type": mapped.get("property_type"),
                "listing_type": mapped.get("listing_type"),
                "description": mapped.get("description"),
                "raw_json": mapped.get("raw_json") or {},
                "url": mapped["url"],
                "title": mapped.get("title"),
                "is_processed": False,
            },
        )
        self.db.execute(stmt)
        return exists is None

    async def scrape(self, max_pages: int | None = None) -> tuple[int, int]:
        page_cap = max_pages if max_pages is not None else self.max_pages
        total_found = 0
        total_new = 0
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json,text/html"}

        async with httpx.AsyncClient(headers=headers, timeout=45.0, follow_redirects=True) as client:
            token, secure_key = await self._fetch_credentials(client)
            log.info("lpw_api_credentials_ok", secure_key=secure_key)

            for api_type, default_ptype, default_ltype in SEARCH_TYPES:
                start = 0
                pages = 0
                while True:
                    if page_cap and pages >= page_cap:
                        break
                    try:
                        data = await self._fetch_page(
                            client,
                            token=token,
                            secure_key=secure_key,
                            api_type=api_type,
                            start_point=start,
                        )
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code in {401, 403}:
                            token, secure_key = await self._fetch_credentials(client)
                            data = await self._fetch_page(
                                client,
                                token=token,
                                secure_key=secure_key,
                                api_type=api_type,
                                start_point=start,
                            )
                        else:
                            log.warning(
                                "lpw_api_page_error",
                                type=api_type,
                                start=start,
                                status=e.response.status_code,
                            )
                            break

                    ads = data.get("ads") or []
                    if not ads:
                        break

                    page_new = 0
                    for ad in ads:
                        if not isinstance(ad, dict):
                            continue
                        mapped = map_lpw_ad(
                            ad,
                            default_property_type=default_ptype,
                            default_listing_type=default_ltype,
                        )
                        if not mapped:
                            continue
                        total_found += 1
                        if self._upsert_mapped(mapped):
                            page_new += 1
                            total_new += 1

                    self.db.commit()
                    pages += 1
                    result_count = int(data.get("result_count") or 0)
                    log.info(
                        "lpw_api_page",
                        type=api_type,
                        start=start,
                        ads=len(ads),
                        new=page_new,
                        result_count=result_count,
                    )

                    start += self.limit
                    if start >= result_count:
                        break
                    await asyncio.sleep(self.request_delay)

        log.info("lpw_api_done", found=total_found, new=total_new)
        return total_found, total_new


async def scrape_lpw_api(db: Session, max_pages: int | None = None) -> tuple[int, int]:
    return await LPWApiScraper(db).scrape(max_pages=max_pages)
