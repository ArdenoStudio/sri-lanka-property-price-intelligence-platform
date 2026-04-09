"""
LPW (Lanka Property Web) catchup runner.
Scrapes sale, land, rent, and apartment categories,
then runs the cleaner on newly ingested listings.
"""
import asyncio
import os
from dotenv import load_dotenv
from datetime import datetime
from db.connection import SessionLocal
from db.models import JobRun
from scraper.lpw import LPWScraper
from scraper.cleaner import DataCleaner

root = r"C:\Users\Ovindu\Documents\Ardeno Studio\Property Price Intelligence An Ardeno Production"
load_dotenv(os.path.join(root, ".env"))

MAX_PAGES = int(os.getenv("LPW_MAX_PAGES", "50"))


async def run():
    db = SessionLocal()
    total_found = 0
    total_new = 0

    try:
        print(f"Starting LPW catchup (max {MAX_PAGES} pages per category)...", flush=True)
        scraper = LPWScraper(db)
        found, new = await scraper.scrape(max_pages=MAX_PAGES)
        total_found += found
        total_new += new
        print(f"Scrape complete: found={total_found}, new={total_new}", flush=True)

    finally:
        db.close()

    # Fresh session for cleaner + JobRun — isolated from scraper session
    db2 = SessionLocal()
    try:
        print("Running cleaner...", flush=True)
        cleaner = DataCleaner(db2)
        total_processed = 0
        cleaner_start = datetime.utcnow()
        while True:
            stats = cleaner.process_all(limit=500)
            total_processed += stats.get("processed", 0)
            print(f"  cleaner batch: {stats}", flush=True)
            if stats.get("processed", 0) < 500:
                break
        print(f"Cleaner done. Total processed: {total_processed}", flush=True)
        db2.add(JobRun(job_name="clean_listings", started_at=cleaner_start,
                       finished_at=datetime.utcnow(), status="success",
                       stats={"processed": total_processed}))
        db2.commit()
    finally:
        db2.close()


asyncio.run(run())
