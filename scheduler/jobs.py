import asyncio
import structlog
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from sqlalchemy import func
from db.connection import SessionLocal, engine
from db.models import ScrapeRun, Listing, PriceAggregate, JobRun
from scraper.ikman import IkmanScraper
from scraper.lpw import LPWScraper
from scraper.lamudi import LamudiScraper
from scraper.detail_enricher import DetailEnricher
from scraper.cleaner import DataCleaner
from scraper.geocoder import Geocoder
from datetime import datetime, timedelta
import os
import time

log = structlog.get_logger()

# APScheduler configuration
db_url = os.getenv("DATABASE_URL", "")
# SQLAlchemy 2.x requires postgresql:// not postgres://
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

try:
    if not db_url:
        raise ValueError("DATABASE_URL not set")
    jobstores = {
        'default': SQLAlchemyJobStore(url=db_url)
    }
    log.info("scheduler_using_db_jobstore")
except Exception as e:
    log.warning("scheduler_jobstore_fallback", reason=str(e), store="memory")
    jobstores = {}  # APScheduler defaults to in-memory MemoryJobStore

scheduler = BackgroundScheduler(jobstores=jobstores)

def _start_job_run(db, name: str) -> JobRun:
    run = JobRun(job_name=name, started_at=datetime.utcnow(), status="running")
    db.add(run)
    db.commit()
    db.refresh(run)
    return run

def _finish_job_run(db, run: JobRun, status: str, stats=None, error: str = None):
    run.status = status
    run.finished_at = datetime.utcnow()
    run.stats = stats
    run.error_message = error
    db.commit()

def run_async(coro):
    """Helper to run async code in sync APScheduler jobs"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

def scrape_ikman_job():
    db = SessionLocal()
    run = ScrapeRun(source="ikman", started_at=datetime.utcnow(), status="running")
    db.add(run)
    db.commit()
    
    try:
        scraper = IkmanScraper(db)
        found, new = run_async(scraper.scrape())
        run.listings_found = found
        run.listings_new = new
        run.status = "success"
        run.finished_at = datetime.utcnow()
    except Exception as e:
        run.status = "failed"
        run.error_message = str(e)
        log.error("ikman_job_failed", error=str(e))
    finally:
        db.commit()
        db.close()

def scrape_lpw_job():
    db = SessionLocal()
    run = ScrapeRun(source="lpw", started_at=datetime.utcnow(), status="running")
    db.add(run)
    db.commit()
    
    try:
        scraper = LPWScraper(db)
        found, new = run_async(scraper.scrape())
        run.listings_found = found
        run.listings_new = new
        run.status = "success"
        run.finished_at = datetime.utcnow()
    except Exception as e:
        run.status = "failed"
        run.error_message = str(e)
        log.error("lpw_job_failed", error=str(e))
    finally:
        db.commit()
        db.close()

def scrape_lamudi_job():
    db = SessionLocal()
    run = ScrapeRun(source="lamudi", started_at=datetime.utcnow(), status="running")
    db.add(run)
    db.commit()

    try:
        scraper = LamudiScraper(db)
        found, new = run_async(scraper.scrape())
        run.listings_found = found
        run.listings_new = new
        run.status = "success"
        run.finished_at = datetime.utcnow()
    except Exception as e:
        run.status = "failed"
        run.error_message = str(e)
        log.error("lamudi_job_failed", error=str(e))
    finally:
        db.commit()
        db.close()


def clean_listings_job():
    db = SessionLocal()
    run = None
    try:
        run = _start_job_run(db, "clean_listings")
        cleaner = DataCleaner(db)
        stats = cleaner.process_all()
        log.info("clean_job_complete", **stats)
        _finish_job_run(db, run, "success", stats=stats)
    except Exception as e:
        log.error("clean_job_failed", error=str(e))
        if run:
            _finish_job_run(db, run, "failed", error=str(e))
    finally:
        db.close()

def geocode_listings_job():
    db = SessionLocal()
    run = None
    try:
        run = _start_job_run(db, "geocode_listings")
        geocoder = Geocoder(db)
        stats = geocoder.geocode_listings()
        log.info("geocode_job_complete", **stats)
        _finish_job_run(db, run, "success", stats=stats)
    except Exception as e:
        log.error("geocode_job_failed", error=str(e))
        if run:
            _finish_job_run(db, run, "failed", error=str(e))
    finally:
        db.close()

def enrich_details_job():
    db = SessionLocal()
    run = None
    try:
        run = _start_job_run(db, "enrich_details")
        enricher = DetailEnricher(db)
        stats = run_async(enricher.enrich())
        log.info("enrich_details_job_complete", **stats)
        _finish_job_run(db, run, "success", stats=stats)
    except Exception as e:
        log.error("enrich_details_job_failed", error=str(e))
        if run:
            _finish_job_run(db, run, "failed", error=str(e))
    finally:
        db.close()


def check_price_changes_job():
    db = SessionLocal()
    run = None
    try:
        run = _start_job_run(db, "check_price_changes")
        enricher = DetailEnricher(db)
        stats = run_async(enricher.check_price_changes())
        log.info("price_check_job_complete", **stats)
        _finish_job_run(db, run, "success", stats=stats)
    except Exception as e:
        log.error("price_check_job_failed", error=str(e))
        if run:
            _finish_job_run(db, run, "failed", error=str(e))
    finally:
        db.close()


def compute_aggregates_job():
    db = SessionLocal()
    run = None
    try:
        run = _start_job_run(db, "compute_aggregates")
        log.info("compute_aggregates_job_started")
        from api.main import PriceAggregator
        aggregator = PriceAggregator(db)
        count = aggregator.aggregate()
        log.info("compute_aggregates_job_complete", aggregates=count)
        _finish_job_run(db, run, "success", stats={"aggregates": count})
    except Exception as e:
        log.error("compute_aggregates_job_failed", error=str(e))
        if run:
            _finish_job_run(db, run, "failed", error=str(e))
    finally:
        db.close()

def start_scheduler():
    """Start the background scheduler. Failures here must never crash the API."""
    try:
        # 1. Scrape every 24 hours
        scheduler.add_job(scrape_ikman_job,  'cron', hour=2, minute=0,  id='scrape_ikman',  replace_existing=True)
        scheduler.add_job(scrape_lpw_job,    'cron', hour=2, minute=30, id='scrape_lpw',    replace_existing=True)
        scheduler.add_job(scrape_lamudi_job, 'cron', hour=3, minute=0,  id='scrape_lamudi', replace_existing=True)

        # 2. Clean every 24 hours
        scheduler.add_job(clean_listings_job, 'cron', hour=4, minute=0, id='clean_listings', replace_existing=True)

        # 3. Geocode every 24 hours
        scheduler.add_job(geocode_listings_job, 'cron', hour=5, minute=0, id='geocode_listings', replace_existing=True)

        # 3b. Enrich missing detail fields (size, beds, baths) from detail pages
        scheduler.add_job(enrich_details_job, 'cron', hour=5, minute=30, id='enrich_details', replace_existing=True)

        # 3c. Check active listings for price changes daily
        scheduler.add_job(check_price_changes_job, 'cron', hour=6, minute=0, id='check_price_changes', replace_existing=True)

        # 4. Aggregates every Sunday
        scheduler.add_job(compute_aggregates_job, 'cron', day_of_week='sun', hour=6, minute=0, id='compute_aggregates', replace_existing=True)

        scheduler.start()
        log.info("scheduler_started")
    except Exception as e:
        log.error("scheduler_start_failed", error=str(e))
        log.warning("scheduler_disabled_api_still_running")

if __name__ == "__main__":
    start_scheduler()
    try:
        # Keep the script running
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
