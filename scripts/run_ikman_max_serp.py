#!/usr/bin/env python3
"""Max-out ikman SERP ingest via location-sharded api.ikman.lk walks.

Usage:
  USE_IKMAN_SERP_API=1 python3 scripts/run_ikman_max_serp.py
  python3 scripts/run_ikman_max_serp.py --category 415
  python3 scripts/run_ikman_max_serp.py --category 942 --max-pages 0
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.connection import SessionLocal
from scraper.ikman_api import DEFAULT_CATEGORIES, bridge_ikman_identity, scrape_ikman_api


async def main() -> None:
    parser = argparse.ArgumentParser(description="Location-sharded ikman SERP catch-up")
    parser.add_argument(
        "--category",
        type=int,
        action="append",
        dest="categories",
        help="Category id (repeatable). Default: all DEFAULT_CATEGORIES",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=int(os.getenv("IKMAN_API_MAX_PAGES", "0") or "0"),
        help="Per-shard page cap; 0 = until empty/dupes/soft-stop",
    )
    parser.add_argument(
        "--stop-after-dup-pages",
        type=int,
        default=None,
        help="Override IKMAN_API_STOP_AFTER_DUP_PAGES for this run",
    )
    args = parser.parse_args()

    os.environ.setdefault("USE_IKMAN_SERP_API", "1")
    os.environ["IKMAN_API_LOCATION_SHARD"] = "1"
    if args.stop_after_dup_pages is not None:
        os.environ["IKMAN_API_STOP_AFTER_DUP_PAGES"] = str(args.stop_after_dup_pages)

    cats = args.categories or list(DEFAULT_CATEGORIES)
    max_pages = args.max_pages or None

    db = SessionLocal()
    try:
        try:
            bridge_stats = bridge_ikman_identity(db, dry_run=False, limit=5000)
            print("identity_bridge", bridge_stats, flush=True)
        except Exception as e:
            print("identity_bridge_skipped", e, flush=True)

        found, new = await scrape_ikman_api(
            db,
            max_pages=max_pages,
            sharded=True,
            categories=cats,
        )
        print(f"done found={found} new={new} categories={cats}", flush=True)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
