import asyncio
import os
import sys
from dotenv import load_dotenv

root = r"C:\Users\Ovindu\Documents\Ardeno Studio\Property Price Intelligence An Ardeno Production"
load_dotenv(os.path.join(root, ".env"))
sys.path.insert(0, root)

from db.connection import SessionLocal
from db.models import Listing, RawListing
from scraper.detail_enricher import DetailEnricher
from sqlalchemy import func

async def run():
    # Get total count with a short-lived session
    db = SessionLocal()
    try:
        total_missing = (
            db.query(func.count(Listing.id))
            .join(RawListing, Listing.raw_id == RawListing.id)
            .filter(
                Listing.is_outlier == False,
                Listing.size_perches.is_(None),
                Listing.size_sqft.is_(None),
                RawListing.url.isnot(None),
                RawListing.source.in_(["ikman", "lpw", "lamudi"]),
            )
            .scalar()
        )
        print(f"Listings needing enrichment: {total_missing}", flush=True)
    finally:
        db.close()

    batch = 0
    total_enriched = 0
    while True:
        batch += 1
        print(f"\n--- Batch {batch} ---", flush=True)
        # Fresh session per batch to avoid stale connections between long Playwright runs
        db = SessionLocal()
        try:
            enricher = DetailEnricher(db)
            enricher.max_per_run = 300
            stats = await enricher.enrich()
            total_enriched += stats.get("enriched", 0)
            print(f"  visited={stats['visited']}  enriched={stats['enriched']}  errors={stats.get('errors',0)}", flush=True)
            if stats.get("visited", 0) == 0:
                print("Nothing left to enrich.", flush=True)
                break
        finally:
            db.close()

    print(f"\nDone. Total enriched: {total_enriched}", flush=True)

asyncio.run(run())
