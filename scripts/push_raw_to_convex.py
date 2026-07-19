"""
Push recent raw_listings rows from the existing Postgres database into Convex.

Required env:
  CONVEX_SITE_URL   e.g. https://your-deployment.convex.site
  CONVEX_INGEST_KEY same value configured in Convex env vars

Optional env:
  CONVEX_PUSH_LIMIT default 500
"""

from __future__ import annotations

from datetime import datetime, timezone
import os
import sys

import httpx
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.connection import SessionLocal
from db.models import RawListing
from scraper.privacy import redact_contact_channels, sanitize_ikman_raw_json


def to_ms(value) -> int | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    return None


def raw_to_convex(row: RawListing) -> dict:
    raw_json = row.raw_json
    if row.source == "ikman":
        raw_json = sanitize_ikman_raw_json(raw_json)

    payload = {
        "source": row.source,
        "sourceId": row.source_id,
        "scrapedAt": to_ms(row.scraped_at),
        "url": row.url,
        "title": row.title,
        "rawPrice": row.raw_price,
        "rawLocation": row.raw_location,
        "rawSize": row.raw_size,
        "propertyType": row.property_type,
        "listingType": row.listing_type,
        "description": redact_contact_channels(row.description),
        "rawJson": raw_json,
    }
    return {key: value for key, value in payload.items() if value is not None}


def main() -> int:
    load_dotenv()
    site_url = os.getenv("CONVEX_SITE_URL", "").rstrip("/")
    ingest_key = os.getenv("CONVEX_INGEST_KEY")
    limit = int(os.getenv("CONVEX_PUSH_LIMIT", "500"))

    if not site_url:
        print("CONVEX_SITE_URL is required", file=sys.stderr)
        return 2
    if not ingest_key:
        print("CONVEX_INGEST_KEY is required", file=sys.stderr)
        return 2

    db = SessionLocal()
    try:
        rows = (
            db.query(RawListing)
            .order_by(RawListing.scraped_at.desc())
            .limit(limit)
            .all()
        )
        listings = [raw_to_convex(row) for row in rows]
    finally:
        db.close()

    if not listings:
        print("No raw listings to push")
        return 0

    response = httpx.post(
        f"{site_url}/ingest/raw-listings",
        headers={"x-ingest-key": ingest_key},
        json={"listings": listings},
        timeout=60,
    )
    response.raise_for_status()
    print(response.json())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
