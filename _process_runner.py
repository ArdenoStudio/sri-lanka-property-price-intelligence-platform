"""
Post-scrape processing runner.
Runs cleaner → geocoder → aggregates in sequence, writing JobRun records for each.
"""
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

root = r"C:\Users\Ovindu\Documents\Ardeno Studio\Property Price Intelligence An Ardeno Production"
load_dotenv(os.path.join(root, ".env"))
sys.path.insert(0, root)

from db.connection import SessionLocal
from db.models import JobRun
from scraper.cleaner import DataCleaner
from scraper.geocoder import Geocoder


def run():
    db = SessionLocal()
    try:
        # ── Cleaner ──────────────────────────────────────────────────────────
        print("Running cleaner...", flush=True)
        cleaner_start = datetime.utcnow()
        cleaner = DataCleaner(db)
        total_processed = 0
        while True:
            stats = cleaner.process_all(limit=500)
            total_processed += stats.get("processed", 0)
            print(f"  cleaner batch: {stats}", flush=True)
            if stats.get("processed", 0) < 500:
                break
        print(f"Cleaner done. Total processed: {total_processed}", flush=True)
        db.add(JobRun(job_name="clean_listings", started_at=cleaner_start,
                      finished_at=datetime.utcnow(), status="success",
                      stats={"processed": total_processed}))
        db.commit()

        # ── Geocoder ─────────────────────────────────────────────────────────
        print("\nRunning geocoder...", flush=True)
        geocoder_start = datetime.utcnow()
        geocoder = Geocoder(db)
        geocoded = geocoder.geocode_listings()
        print(f"Geocoder done. Geocoded: {geocoded}", flush=True)
        db.add(JobRun(job_name="geocode_listings", started_at=geocoder_start,
                      finished_at=datetime.utcnow(), status="success",
                      stats={"geocoded": geocoded}))
        db.commit()

        # ── Aggregates ───────────────────────────────────────────────────────
        print("\nRunning aggregates...", flush=True)
        from api.main import PriceAggregator
        agg_start = datetime.utcnow()
        aggregator = PriceAggregator(db)
        trends = aggregator.aggregate()
        print(f"Aggregates done. Trends updated: {trends}", flush=True)
        db.add(JobRun(job_name="compute_aggregates", started_at=agg_start,
                      finished_at=datetime.utcnow(), status="success",
                      stats={"trends_updated": trends}))
        db.commit()

    finally:
        db.close()


run()
