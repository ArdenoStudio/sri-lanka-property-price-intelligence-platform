"""ikman.lk public API scraper — api.ikman.lk SERP + ad detail.

Behind USE_IKMAN_SERP_API / USE_IKMAN_DETAIL_API.
Identity: prefer hex `id`; bridge legacy trailing-digit source_ids via URL slug.
"""
from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
import structlog
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from db.models import Listing, ListingSnapshot, RawListing
from scraper.privacy import sanitize_ikman_raw_json
from scraper.utils import build_snapshot_fingerprint

log = structlog.get_logger()

API_BASE = "https://api.ikman.lk"
USER_AGENT = (
    "Mozilla/5.0 (compatible; PropertyLkBot/1.0; +https://github.com/ArdenoStudio/"
    "sri-lanka-property-price-intelligence-platform)"
)

# Property categories (excluding short-term 936 by default)
DEFAULT_CATEGORIES = (
    415,  # houses sale
    942,  # land sale
    937,  # apt sale
    416,  # house rent
    938,  # apt rent
    939,  # commercial sale
    940,  # commercial rent
)

CATEGORY_PROPERTY_TYPE = {
    415: "house",
    416: "house",
    937: "apartment",
    938: "apartment",
    942: "land",
    939: "commercial",
    940: "commercial",
    409: "house",  # root — refined per result
    936: "house",  # short-term
    413: "house",  # rooms/annex
}

BEDROOMS_RE = re.compile(r"(?i)bedrooms?\s*:\s*(\d+)")
BATHROOMS_RE = re.compile(r"(?i)bathrooms?\s*:\s*(\d+)")
SIZE_HINT_RE = re.compile(
    r"(?i)(\d+(?:\.\d+)?)\s*(perches?|acres?|sq\.?\s*ft|sqft)"
)


def slug_from_url(url: str | None) -> Optional[str]:
    if not url:
        return None
    path = urlparse(url).path.rstrip("/")
    if "/ad/" in path:
        return path.split("/ad/")[-1] or None
    slug = path.split("/")[-1]
    return slug or None


def legacy_source_id_from_slug(slug: str | None) -> Optional[str]:
    if not slug:
        return None
    m = re.search(r"-(\d+)$", slug)
    return m.group(1) if m else slug


def map_listing_type(api_type: str | None) -> str:
    t = (api_type or "").lower()
    if t in {"for_rent", "to_rent"}:
        return "rent"
    return "sale"


def map_property_type_from_category(category: dict | None, fallback: str = "house") -> str:
    if not category:
        return fallback
    cid = category.get("id")
    if cid in CATEGORY_PROPERTY_TYPE:
        return CATEGORY_PROPERTY_TYPE[cid]
    name = (category.get("name") or "").lower()
    if "land" in name:
        return "land"
    if "apartment" in name or "flat" in name:
        return "apartment"
    if "commercial" in name:
        return "commercial"
    if "house" in name:
        return "house"
    return fallback


def parse_details(details: list | None) -> dict[str, Any]:
    bedrooms = bathrooms = None
    size_hint = None
    for item in details or []:
        text_item = str(item)
        if bedrooms is None:
            m = BEDROOMS_RE.search(text_item)
            if m:
                bedrooms = int(m.group(1))
        if bathrooms is None:
            m = BATHROOMS_RE.search(text_item)
            if m:
                bathrooms = int(m.group(1))
        if size_hint is None and SIZE_HINT_RE.search(text_item):
            size_hint = text_item.strip()
        # bare "8.5 perches" style
        if size_hint is None and re.search(r"(?i)perch|acre|sq", text_item):
            size_hint = text_item.strip()
    return {"bedrooms": bedrooms, "bathrooms": bathrooms, "size_hint": size_hint}


def properties_to_dict(properties: list | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for prop in properties or []:
        if not isinstance(prop, dict):
            continue
        key = prop.get("key") or prop.get("label")
        val = prop.get("value")
        if key and val is not None:
            out[str(key)] = str(val)
    return out


def build_raw_location(result: dict[str, Any]) -> Optional[str]:
    loc = (result.get("location") or {}).get("name")
    area = (result.get("area") or {}).get("name")
    parts = [p for p in (loc, area) if p]
    return ", ".join(parts) if parts else None


def build_raw_price(result: dict[str, Any]) -> Optional[str]:
    money = result.get("money") or {}
    amount = money.get("amount")
    if amount:
        return str(amount)
    info = result.get("info")
    return str(info) if info else None


def normalize_ad_url(url: str | None, slug: str | None) -> str:
    if url:
        if url.startswith("http://"):
            return "https://" + url[len("http://") :]
        if url.startswith("/"):
            return f"https://ikman.lk{url}"
        return url
    if slug:
        return f"https://ikman.lk/en/ad/{slug}"
    return "https://ikman.lk/"


def map_ikman_serp_result(
    result: dict[str, Any],
    *,
    default_property_type: str | None = None,
) -> Optional[dict[str, Any]]:
    """Map one SERP result to a RawListing-shaped dict."""
    hex_id = result.get("id")
    if not hex_id:
        return None
    source_id = str(hex_id)
    slug = result.get("slug") or slug_from_url(result.get("url"))
    category = result.get("category") or {}
    parsed = parse_details(result.get("details"))
    is_short_term = category.get("id") == 936 or "/night" in (build_raw_price(result) or "").lower()

    raw_json = sanitize_ikman_raw_json(
        {
            "ingest": "ikman_serp_api",
            "hex_id": source_id,
            "slug": slug,
            "legacy_source_id": legacy_source_id_from_slug(slug),
            "bedrooms": parsed["bedrooms"],
            "bathrooms": parsed["bathrooms"],
            "details": result.get("details"),
            "category_id": category.get("id"),
            "category_name": category.get("name"),
            "type": result.get("type"),
            "date": result.get("date"),
            "last_bump_up_date": result.get("last_bump_up_date"),
            "location": result.get("location"),
            "area": result.get("area"),
            "is_short_term": is_short_term,
            "contact_card": result.get("contact_card"),
        }
    )

    return {
        "source": "ikman",
        "source_id": source_id,
        "url": normalize_ad_url(result.get("url"), slug),
        "title": (result.get("title") or "").strip() or f"ikman {source_id}",
        "raw_price": build_raw_price(result),
        "raw_location": build_raw_location(result),
        "raw_size": parsed["size_hint"],
        "property_type": map_property_type_from_category(
            category, default_property_type or "house"
        ),
        "listing_type": map_listing_type(result.get("type")),
        "description": None,
        "raw_json": raw_json,
        "is_short_term": is_short_term,
    }


def map_ikman_ad_detail(payload: dict[str, Any]) -> dict[str, Any]:
    """Extract enrichment attrs from GET /v1/ads/{id} JSON."""
    ad = payload.get("ad") if isinstance(payload.get("ad"), dict) else payload
    props = properties_to_dict(ad.get("properties"))
    details_parsed = parse_details(ad.get("details"))

    size_perches = size_sqft = None
    for key in ("size", "land_size", "house_size"):
        val = props.get(key) or ""
        m = re.search(r"([\d.]+)\s*perch", val, re.I)
        if m and size_perches is None:
            size_perches = float(m.group(1))
        m = re.search(r"([\d.]+)\s*(?:sq\.?\s*ft|sqft)", val, re.I)
        if m and size_sqft is None:
            size_sqft = float(m.group(1))

    bedrooms = details_parsed["bedrooms"]
    bathrooms = details_parsed["bathrooms"]
    for key, target in (("bedrooms", "bedrooms"), ("bathrooms", "bathrooms")):
        if props.get(key):
            try:
                n = int(re.search(r"\d+", props[key]).group(0))  # type: ignore[union-attr]
                if target == "bedrooms":
                    bedrooms = bedrooms or n
                else:
                    bathrooms = bathrooms or n
            except (AttributeError, ValueError, TypeError):
                pass

    return {
        "source_id": str(ad.get("id") or ""),
        "slug": ad.get("slug") or slug_from_url(ad.get("url")),
        "description": ad.get("description"),
        "raw_price": build_raw_price(ad),
        "raw_location": build_raw_location(ad),
        "raw_size": details_parsed["size_hint"]
        or props.get("size")
        or props.get("land_size")
        or props.get("house_size"),
        "size_perches": size_perches,
        "size_sqft": size_sqft,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "properties": props,
        "views": (ad.get("statistics") or {}).get("views"),
        "raw_json": sanitize_ikman_raw_json(
            {
                "ingest": "ikman_detail_api",
                "hex_id": ad.get("id"),
                "slug": ad.get("slug"),
                "properties": ad.get("properties"),
                "details": ad.get("details"),
                "statistics": ad.get("statistics"),
                "contact_card": ad.get("contact_card"),
                "bedrooms": bedrooms,
                "bathrooms": bathrooms,
            }
        ),
    }


_HEX_ID_RE = re.compile(r"^[0-9a-f]{24}$")


def bridge_ikman_identity(db: Session, *, dry_run: bool = False, limit: int = 5000) -> dict[str, int]:
    """Re-key legacy digit/slug source_ids to hex ids stored in raw_json.hex_id."""
    stats = {"examined": 0, "renamed": 0, "skipped_conflict": 0, "noop": 0}

    candidates = (
        db.query(RawListing)
        .filter(RawListing.source == "ikman")
        .order_by(RawListing.id.desc())
        .limit(limit)
        .all()
    )

    for raw in candidates:
        if _HEX_ID_RE.match(raw.source_id or ""):
            continue
        stats["examined"] += 1
        payload = raw.raw_json if isinstance(raw.raw_json, dict) else {}
        hex_id = payload.get("hex_id")
        if not hex_id:
            stats["noop"] += 1
            continue
        hex_id = str(hex_id)

        conflict = (
            db.query(RawListing.id)
            .filter(RawListing.source == "ikman", RawListing.source_id == hex_id)
            .first()
        )
        if conflict:
            stats["skipped_conflict"] += 1
            continue

        if dry_run:
            stats["renamed"] += 1
            continue

        try:
            new_json = dict(payload)
            new_json["legacy_source_id"] = raw.source_id
            new_json["identity_bridged"] = True
            legacy = raw.source_id
            raw.source_id = hex_id
            raw.raw_json = new_json

            listing = (
                db.query(Listing)
                .filter(Listing.source == "ikman", Listing.source_id == legacy)
                .first()
            )
            if listing:
                listing_conflict = (
                    db.query(Listing.id)
                    .filter(Listing.source == "ikman", Listing.source_id == hex_id)
                    .first()
                )
                if not listing_conflict:
                    listing.source_id = hex_id

            stats["renamed"] += 1
        except Exception as e:
            db.rollback()
            log.warning("ikman_identity_bridge_row_failed", source_id=raw.source_id, error=str(e))
            stats["skipped_conflict"] += 1

    if not dry_run:
        db.commit()
    return stats


class IkmanApiScraper:
    SOURCE = "ikman"

    def __init__(self, db: Session):
        self.db = db
        self.delay = float(os.getenv("IKMAN_API_DELAY_SECONDS", "0.4"))
        self.max_pages = int(os.getenv("IKMAN_API_MAX_PAGES", "0"))  # 0 = until empty/dupes
        self.stop_after_dup_pages = int(os.getenv("IKMAN_API_STOP_AFTER_DUP_PAGES", "3"))
        cats = os.getenv("IKMAN_API_CATEGORIES", "")
        if cats.strip():
            self.categories = [int(x) for x in cats.split(",") if x.strip().isdigit()]
        else:
            self.categories = list(DEFAULT_CATEGORIES)

    def _headers(self) -> dict[str, str]:
        return {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Application": "web",
        }

    async def fetch_serp_page(
        self,
        client: httpx.AsyncClient,
        *,
        category: int,
        page: int = 1,
        next_page_token: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"category": category, "page": page}
        if next_page_token:
            params["next_page_token"] = next_page_token
        resp = await client.get(f"{API_BASE}/v1/serp", params=params)
        resp.raise_for_status()
        return resp.json()

    async def fetch_ad_detail(self, client: httpx.AsyncClient, ad_id: str) -> dict[str, Any]:
        resp = await client.get(f"{API_BASE}/v1/ads/{ad_id}")
        resp.raise_for_status()
        return resp.json()

    def _upsert_mapped(self, mapped: dict[str, Any]) -> bool:
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
        self.db.execute(
            insert(ListingSnapshot)
            .values(
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
            )
            .on_conflict_do_nothing(index_elements=["source", "source_id", "fingerprint"])
        )

        self.db.execute(
            insert(RawListing)
            .values(
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
            )
            .on_conflict_do_update(
                index_elements=["source", "source_id"],
                set_={
                    "scraped_at": now,
                    "raw_price": mapped.get("raw_price"),
                    "raw_location": mapped.get("raw_location"),
                    "raw_size": mapped.get("raw_size"),
                    "property_type": mapped.get("property_type"),
                    "listing_type": mapped.get("listing_type"),
                    "raw_json": mapped.get("raw_json") or {},
                    "url": mapped["url"],
                    "title": mapped.get("title"),
                    "is_processed": False,
                },
            )
        )
        return exists is None

    async def scrape_serp(self, max_pages: int | None = None) -> tuple[int, int]:
        page_cap = max_pages if max_pages is not None else self.max_pages
        total_found = 0
        total_new = 0

        async with httpx.AsyncClient(headers=self._headers(), timeout=40.0) as client:
            for category in self.categories:
                page = 1
                token = None
                dup_pages = 0
                while True:
                    if page_cap and page > page_cap:
                        break
                    data = await self.fetch_serp_page(
                        client, category=category, page=page, next_page_token=token
                    )
                    results = (data.get("serp") or {}).get("results") or []
                    if not results:
                        break

                    page_new = 0
                    for result in results:
                        if not isinstance(result, dict):
                            continue
                        mapped = map_ikman_serp_result(
                            result,
                            default_property_type=CATEGORY_PROPERTY_TYPE.get(category, "house"),
                        )
                        if not mapped:
                            continue
                        if mapped.get("is_short_term"):
                            # Still store but flag in raw_json; cleaner detects short-term
                            pass
                        total_found += 1
                        if self._upsert_mapped(mapped):
                            page_new += 1
                            total_new += 1

                    self.db.commit()
                    log.info(
                        "ikman_serp_page",
                        category=category,
                        page=page,
                        results=len(results),
                        new=page_new,
                    )

                    if page_new == 0:
                        dup_pages += 1
                        if dup_pages >= self.stop_after_dup_pages:
                            break
                    else:
                        dup_pages = 0

                    pagination = data.get("pagination") or {}
                    token = pagination.get("next_page_token")
                    if not token and page >= int(pagination.get("pages") or page):
                        break
                    page += 1
                    await asyncio.sleep(self.delay)

        log.info("ikman_serp_done", found=total_found, new=total_new)
        return total_found, total_new


async def scrape_ikman_api(db: Session, max_pages: int | None = None) -> tuple[int, int]:
    return await IkmanApiScraper(db).scrape_serp(max_pages=max_pages)


async def fetch_ikman_detail_attrs(ad_id: str) -> dict[str, Any]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Application": "web",
    }
    async with httpx.AsyncClient(headers=headers, timeout=40.0) as client:
        resp = await client.get(f"{API_BASE}/v1/ads/{ad_id}")
        resp.raise_for_status()
        return map_ikman_ad_detail(resp.json())
