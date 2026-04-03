import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from db.connection import SessionLocal
from scraper.ikman import scrape_ikman
from scraper.cleaner import DataCleaner
from api.main import DISTRICT_COORDS, PriceAggregator
from datetime import datetime
import structlog
from db.models import ScrapeRun

log = structlog.get_logger()

async def run_mega_scrape_local():
    """
    LOCAL MEGA SCRAPER
    Run this on your PC to refresh data for all 25 districts in the production database.
    """
    load_dotenv()
    db = SessionLocal()
    
    districts = list(DISTRICT_COORDS.keys())
    log.info("mega_scrape_started", total_districts=len(districts))
    
    try:
        for i, d in enumerate(districts):
            log.info("scrapping_district", district=d, progress=f"{i+1}/{len(districts)}")
            try:
                # Scrape more pages locally (e.g. 15 pages per district)
                found, new = await scrape_ikman(db, max_pages=15, location=d)
                log.info("district_complete", district=d, found=found, new=new)
            except Exception as e:
                log.error("district_failed", district=d, error=str(e))
            
            # Brief pause to avoid being flagged
            await asyncio.sleep(2)
        
        log.info("cleaning_data")
        cleaner = DataCleaner(db)
        processed = cleaner.process_all()
        
        log.info("aggregating_trends")
        agg = PriceAggregator(db)
        trends = agg.aggregate()
        
        log.info("mega_scrape_finished", processed=processed, trends_updated=trends)
        
        # Record final completion for dashboard "Last Updated"
        mega_run = ScrapeRun(
            source="mega_scrape",
            started_at=datetime.utcnow(),
            finished_at=datetime.utcnow(),
            status="success",
            listings_found=processed
        )
        db.add(mega_run)
        db.commit()
        
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_mega_scrape_local())
