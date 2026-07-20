#!/usr/bin/env python3
"""Batch-enrich ikman listings via GET /v1/ads/{id} (beds/baths/size/desc/views).

Usage:
  USE_IKMAN_DETAIL_API=1 ENRICHER_MAX_PER_RUN=2000 \\
    python3 scripts/run_ikman_detail_enrich.py --batches 20
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.connection import SessionLocal
from db.models import Listing, RawListing
from scraper.detail_enricher import DetailEnricher
from sqlalchemy import or_


def _clear_false_attempt_stamps(db) -> int:
    """Clear enrichment_attempted_at on ikman rows that never got detail fields.

    An earlier bug stamped legacy non-hex IDs as attempted without calling the API.
    """
    q = (
        db.query(Listing)
        .join(RawListing, Listing.raw_id == RawListing.id)
        .filter(
            RawListing.source == "ikman",
            Listing.enrichment_attempted_at.isnot(None),
            Listing.size_perches.is_(None),
            Listing.size_sqft.is_(None),
            or_(
                Listing.bedrooms.is_(None),
                Listing.property_type.notin_(["house", "apartment"]),
            ),
        )
    )
    # Only clear when description also missing (never wrote detail payload)
    cleared = 0
    for listing in q.limit(5000).all():
        raw = db.get(RawListing, listing.raw_id) if listing.raw_id else None
        if raw and raw.description:
            continue
        payload = raw.raw_json if raw and isinstance(raw.raw_json, dict) else {}
        if payload.get("views") is not None or payload.get("detail_enriched_at"):
            continue
        listing.enrichment_attempted_at = None
        cleared += 1
    if cleared:
        db.commit()
    return cleared


async def main() -> None:
    parser = argparse.ArgumentParser(description="ikman detail API enricher batches")
    parser.add_argument("--batches", type=int, default=1, help="Number of enrich batches")
    parser.add_argument(
        "--max-per-run",
        type=int,
        default=int(os.getenv("ENRICHER_MAX_PER_RUN", "500")),
        help="Listings per batch",
    )
    args = parser.parse_args()

    os.environ.setdefault("USE_IKMAN_DETAIL_API", "1")
    # API-only path — do not pull LPW/Lamudi into this job (avoids Playwright in CI).
    os.environ["ENRICHER_SOURCES"] = "ikman"
    os.environ["ENRICHER_MAX_PER_RUN"] = str(args.max_per_run)

    db = SessionLocal()
    try:
        cleared = _clear_false_attempt_stamps(db)
        print(f"cleared_false_attempt_stamps={cleared}", flush=True)
    finally:
        db.close()

    total = {"visited": 0, "enriched": 0, "errors": 0, "skipped_no_hex": 0}
    for batch in range(1, args.batches + 1):
        db = SessionLocal()
        try:
            enricher = DetailEnricher(db)
            enricher.max_per_run = args.max_per_run
            stats = await enricher.enrich()
            for key in total:
                total[key] += int(stats.get(key, 0) or 0)
            print(
                f"batch={batch} visited={stats.get('visited')} "
                f"enriched={stats.get('enriched')} errors={stats.get('errors')} "
                f"ikman_api={stats.get('ikman_api')} "
                f"skipped_no_hex={stats.get('skipped_no_hex')}",
                flush=True,
            )
            if int(stats.get("visited") or 0) == 0 and int(stats.get("skipped_no_hex") or 0) == 0:
                print("nothing_left", flush=True)
                break
            # If we only skipped legacy IDs, stop — SERP catch-up will add hex rows.
            if int(stats.get("visited") or 0) == 0 and int(stats.get("skipped_no_hex") or 0) > 0:
                print("only_legacy_non_hex_remaining", flush=True)
                break
        finally:
            db.close()

    print(f"done totals={total}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
