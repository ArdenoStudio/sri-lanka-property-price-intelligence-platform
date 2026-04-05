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
from datetime import datetime, timedelta

async def run():
    # Get total count with a short-lived session
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=60)
        total = (
            db.query(func.count(Listing.id))
            .join(RawListing, Listing.raw_id == RawListing.id)
            .filter(
                Listing.is_outlier == False,
                Listing.price_lkr.isnot(None),
                Listing.last_seen_at >= cutoff,
                RawListing.url.isnot(None),
                RawListing.source.in_(["ikman", "lpw", "lamudi"]),
            )
            .scalar()
        )
        print(f"Active listings to price-check: {total}", flush=True)
    finally:
        db.close()

    batch = 0
    total_drops = 0
    total_rises = 0
    while True:
        batch += 1
        print(f"\n--- Batch {batch} ---", flush=True)
        # Fresh session per batch to avoid stale connections between long Playwright runs
        db = SessionLocal()
        try:
            enricher = DetailEnricher(db)
            enricher.max_per_run = 300
            stats = await enricher.check_price_changes()
            total_drops += stats.get("price_drops", 0)
            total_rises += stats.get("price_rises", 0)
            print(f"  visited={stats['visited']}  drops={stats['price_drops']}  rises={stats['price_rises']}  errors={stats.get('errors',0)}", flush=True)
            if stats.get("visited", 0) == 0:
                print("Nothing left to check.", flush=True)
                break
        finally:
            db.close()

    print(f"\nDone. Total price drops: {total_drops} | rises: {total_rises}", flush=True)

asyncio.run(run())
