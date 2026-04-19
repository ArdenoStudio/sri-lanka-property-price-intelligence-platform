"""
Standalone aggregates runner — safe for local and CI use.
Recomputes monthly price aggregates per district / property type.
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
from api.main import PriceAggregator


def run():
    db = SessionLocal()
    try:
        print("Running aggregates...", flush=True)
        start = datetime.utcnow()
        aggregator = PriceAggregator(db)
        trends = aggregator.aggregate()
        print(f"Aggregates done. Trends updated: {trends}", flush=True)
        db.add(JobRun(
            job_name="compute_aggregates",
            started_at=start,
            finished_at=datetime.utcnow(),
            status="success",
            stats={"trends_updated": trends},
        ))
        db.commit()
    finally:
        db.close()


run()
