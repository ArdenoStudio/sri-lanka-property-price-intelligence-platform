#!/usr/bin/env python3
"""
Enhanced Master Scraper Runner with Captcha Bypass
Run all 3 scrapers (ikman, lpw, lamudi) with advanced anti-detection.

Usage:
    python run_all_scrapers.py                    # Run all scrapers
    python run_all_scrapers.py --scrapers ikman   # Run specific scraper
    python run_all_scrapers.py --test             # Test mode (1 page each)
    python run_all_scrapers.py --proxy-file proxies.txt  # Use proxy rotation
"""
import asyncio
import sys
import os
import argparse
import random
from datetime import datetime
from dotenv import load_dotenv
import structlog

load_dotenv()

from db.connection import SessionLocal
from scraper.ikman import scrape_ikman, scrape_ikman_full
from scraper.lpw import scrape_lpw, scrape_lpw_districts
from scraper.lamudi import LamudiScraper
from scraper.cleaner import DataCleaner
from scraper.geocoder import Geocoder

log = structlog.get_logger()


class ProxyRotator:
    """Rotate through a list of proxies."""
    def __init__(self, proxy_file: str = None):
        self.proxies = []
        self.current_index = 0

        if proxy_file and os.path.exists(proxy_file):
            with open(proxy_file, 'r') as f:
                self.proxies = [line.strip() for line in f if line.strip()]
            log.info("proxy_rotator_loaded", count=len(self.proxies))
        elif os.getenv("PROXY_URL"):
            self.proxies = [os.getenv("PROXY_URL")]
            log.info("proxy_from_env", proxy=self.proxies[0])

    def get_next(self) -> str:
        """Get next proxy in rotation."""
        if not self.proxies:
            return None
        proxy = self.proxies[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.proxies)
        return proxy


async def run_ikman(db, max_pages: int = 50, full_scrape: bool = False):
    """Run ikman scraper with enhanced settings."""
    log.info("scraper_starting", source="ikman", max_pages=max_pages)

    try:
        if full_scrape:
            # Full scrape includes main feed, thin districts, and extra categories
            found, new = await scrape_ikman_full(
                db,
                main_pages=max_pages,
                district_pages=20,
                extra_pages=10,
                headless=True
            )
        else:
            # Standard scrape of main sri-lanka feed
            found, new = await scrape_ikman(db, max_pages=max_pages)

        log.info("scraper_complete", source="ikman", found=found, new=new)
        return {"source": "ikman", "found": found, "new": new, "success": True}

    except Exception as e:
        log.error("scraper_failed", source="ikman", error=str(e))
        return {"source": "ikman", "found": 0, "new": 0, "success": False, "error": str(e)}


async def run_lpw(db, max_pages: int = 15, district_scrape: bool = False):
    """Run LankaPropertyWeb scraper."""
    log.info("scraper_starting", source="lpw", max_pages=max_pages)

    try:
        if district_scrape:
            # Scrape thin districts with targeted searches
            found, new = await scrape_lpw_districts(db, max_pages=max_pages)
        else:
            # Standard scrape
            found, new = await scrape_lpw(db, max_pages=max_pages)

        log.info("scraper_complete", source="lpw", found=found, new=new)
        return {"source": "lpw", "found": found, "new": new, "success": True}

    except Exception as e:
        log.error("scraper_failed", source="lpw", error=str(e))
        return {"source": "lpw", "found": 0, "new": 0, "success": False, "error": str(e)}


async def run_lamudi(db, max_pages: int = 20):
    """Run house.lk (lamudi) scraper."""
    log.info("scraper_starting", source="lamudi", max_pages=max_pages)

    try:
        scraper = LamudiScraper(db)
        found, new = await scraper.scrape(max_pages=max_pages)

        log.info("scraper_complete", source="lamudi", found=found, new=new)
        return {"source": "lamudi", "found": found, "new": new, "success": True}

    except Exception as e:
        log.error("scraper_failed", source="lamudi", error=str(e))
        return {"source": "lamudi", "found": 0, "new": 0, "success": False, "error": str(e)}


async def run_data_processing(db):
    """Run data cleaning and geocoding."""
    log.info("processing_starting")

    try:
        # Clean raw listings
        cleaner = DataCleaner(db)
        clean_stats = cleaner.process_all()
        log.info("cleaning_complete", stats=clean_stats)

        # Geocode listings
        geocoder = Geocoder(db)
        geo_stats = geocoder.geocode_listings()
        log.info("geocoding_complete", stats=geo_stats)

        return {
            "cleaned": clean_stats,
            "geocoded": geo_stats,
            "success": True
        }

    except Exception as e:
        log.error("processing_failed", error=str(e))
        return {"success": False, "error": str(e)}


async def main():
    parser = argparse.ArgumentParser(description="Run property scrapers")
    parser.add_argument(
        "--scrapers",
        nargs="+",
        choices=["ikman", "lpw", "lamudi"],
        help="Scrapers to run (default: all)"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test mode: scrape only 1-2 pages per scraper"
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Full scrape mode: includes districts and extra categories"
    )
    parser.add_argument(
        "--skip-processing",
        action="store_true",
        help="Skip data cleaning and geocoding"
    )
    parser.add_argument(
        "--proxy-file",
        type=str,
        help="Path to file with proxy list (one per line)"
    )
    parser.add_argument(
        "--ikman-pages",
        type=int,
        default=50,
        help="Max pages for ikman (default: 50)"
    )
    parser.add_argument(
        "--lpw-pages",
        type=int,
        default=15,
        help="Max pages for lpw (default: 15)"
    )
    parser.add_argument(
        "--lamudi-pages",
        type=int,
        default=20,
        help="Max pages for lamudi (default: 20)"
    )

    args = parser.parse_args()

    # Determine which scrapers to run
    scrapers_to_run = args.scrapers if args.scrapers else ["ikman", "lpw", "lamudi"]

    # Test mode: reduce page counts
    if args.test:
        ikman_pages = 2
        lpw_pages = 1
        lamudi_pages = 1
        log.info("test_mode_enabled", message="Running in test mode with reduced pages")
    else:
        ikman_pages = args.ikman_pages
        lpw_pages = args.lpw_pages
        lamudi_pages = args.lamudi_pages

    # Setup proxy rotation if provided
    if args.proxy_file:
        proxy_rotator = ProxyRotator(args.proxy_file)
        if proxy_rotator.proxies:
            # Set first proxy as environment variable
            os.environ["PROXY_URL"] = proxy_rotator.get_next()

    # Create database session
    db = SessionLocal()

    start_time = datetime.utcnow()
    results = []

    print("\n" + "="*70)
    print("🚀 ENHANCED PROPERTY SCRAPER - STARTING")
    print("="*70)
    print(f"Scrapers: {', '.join(scrapers_to_run)}")
    print(f"Mode: {'TEST' if args.test else 'FULL' if args.full else 'STANDARD'}")
    print(f"Time: {start_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("="*70 + "\n")

    try:
        # Run scrapers sequentially with delays between them
        if "ikman" in scrapers_to_run:
            print("\n📱 Running Ikman Scraper...")
            result = await run_ikman(db, max_pages=ikman_pages, full_scrape=args.full)
            results.append(result)

            # Brief pause between scrapers
            if len(scrapers_to_run) > 1:
                await asyncio.sleep(random.uniform(5, 10))

        if "lpw" in scrapers_to_run:
            print("\n🏠 Running LankaPropertyWeb Scraper...")
            result = await run_lpw(db, max_pages=lpw_pages, district_scrape=args.full)
            results.append(result)

            if "lamudi" in scrapers_to_run:
                await asyncio.sleep(random.uniform(5, 10))

        if "lamudi" in scrapers_to_run:
            print("\n🏘️  Running House.lk (Lamudi) Scraper...")
            result = await run_lamudi(db, max_pages=lamudi_pages)
            results.append(result)

        # Run data processing unless skipped
        if not args.skip_processing:
            print("\n🔄 Processing Data (cleaning & geocoding)...")
            await asyncio.sleep(2)  # Brief pause before processing
            proc_result = await run_data_processing(db)
            results.append(proc_result)

    finally:
        db.close()

    # Print summary
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()

    print("\n" + "="*70)
    print("📊 SCRAPING SUMMARY")
    print("="*70)

    total_found = 0
    total_new = 0

    for result in results:
        if result.get("source"):
            status = "✅ SUCCESS" if result.get("success") else "❌ FAILED"
            print(f"\n{result['source'].upper()}: {status}")
            if result.get("success"):
                print(f"  Found: {result.get('found', 0)}")
                print(f"  New: {result.get('new', 0)}")
                total_found += result.get('found', 0)
                total_new += result.get('new', 0)
            else:
                print(f"  Error: {result.get('error', 'Unknown error')}")

    print(f"\n{'─'*70}")
    print(f"TOTAL FOUND: {total_found}")
    print(f"TOTAL NEW: {total_new}")
    print(f"DURATION: {int(duration)}s ({duration/60:.1f}m)")
    print(f"COMPLETED: {end_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("="*70 + "\n")

    # Return success if at least one scraper succeeded
    success = any(r.get("success") for r in results)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
