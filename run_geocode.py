"""
Standalone geocoder runner — safe for local and CI use.
Geocodes all listings that are missing lat/lng coordinates.
"""
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

root = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(root, ".env"))
sys.path.insert(0, root)

from db.connection import SessionLocal
from db.models import JobRun
from scraper.geocoder import Geocoder


def run():
    db = SessionLocal()
    try:
        print("Running geocoder...", flush=True)
        start = datetime.utcnow()
        geocoder = Geocoder(db)
        geocoded = geocoder.geocode_listings()
        print(f"Geocoder done. Geocoded: {geocoded}", flush=True)
        db.add(JobRun(
            job_name="geocode_listings",
            started_at=start,
            finished_at=datetime.utcnow(),
            status="success",
            stats={"geocoded": geocoded},
        ))
        db.commit()
    finally:
        db.close()


run()
