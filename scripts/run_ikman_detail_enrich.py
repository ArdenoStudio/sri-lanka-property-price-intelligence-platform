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
from scraper.detail_enricher import DetailEnricher


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

    total = {"visited": 0, "enriched": 0, "errors": 0}
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
                f"ikman_api={stats.get('ikman_api')}",
                flush=True,
            )
            if int(stats.get("visited") or 0) == 0:
                print("nothing_left", flush=True)
                break
        finally:
            db.close()

    print(f"done totals={total}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
