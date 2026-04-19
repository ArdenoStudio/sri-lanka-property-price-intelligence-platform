"""
Standalone cleaner runner — safe for local and CI use.
Processes all unprocessed raw listings into the cleaned listings table.
"""
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Works on any OS: finds .env next to this file (ignored silently in CI)
root = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(root, ".env"))
sys.path.insert(0, root)

from db.connection import SessionLocal
from db.models import JobRun
from scraper.cleaner import DataCleaner


def run():
    db = SessionLocal()
    try:
        print("Running cleaner...", flush=True)
        start = datetime.utcnow()
        cleaner = DataCleaner(db)
        total = 0
        while True:
            stats = cleaner.process_all(limit=500)
            total += stats.get("processed", 0)
            print(f"  batch: {stats}", flush=True)
            if stats.get("processed", 0) < 500:
                break
        print(f"Cleaner done. Total processed: {total}", flush=True)
        db.add(JobRun(
            job_name="clean_listings",
            started_at=start,
            finished_at=datetime.utcnow(),
            status="success",
            stats={"processed": total},
        ))
        db.commit()
    finally:
        db.close()


run()
