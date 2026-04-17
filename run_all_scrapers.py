#!/usr/bin/env python3
"""
Master Scraper Runner
Run all 3 scrapers (ikman, lpw, lamudi) in parallel.

Usage:
    python run_all_scrapers.py                        # Run all scrapers (standard)
    python run_all_scrapers.py --full                 # Full mode: districts + extras
    python run_all_scrapers.py --scrapers ikman       # Run specific scraper
    python run_all_scrapers.py --test                 # Test mode (1-2 pages each)
    python run_all_scrapers.py --district-pages 50    # Pages per district (default: 50)
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


async def run_ikman(max_pages: int = 50, full_scrape: bool = False, district_pages: int = 50):
    """Run ikman scraper with its own DB session."""
    db = SessionLocal()
    log.info("scraper_starting", source="ikman", max_pages=max_pages)
    try:
        if full_scrape:
            found, new = await scrape_ikman_full(
                db,
                main_pages=max_pages,
                district_pages=district_pages,
                extra_pages=10,
                headless=True,
            )
        else:
            found, new = await scrape_ikman(db, max_pages=max_pages)
        log.info("scraper_complete", source="ikman", found=found, new=new)
        return {"source": "ikman", "found": found, "new": new, "success": True}
    except Exception as e:
        log.error("scraper_failed", source="ikman", error=str(e))
        return {"source": "ikman", "found": 0, "new": 0, "success": False, "error": str(e)}
    finally:
        db.close()


async def run_lpw(max_pages: int = 15, full_scrape: bool = False, district_pages: int = 50):
    """Run LankaPropertyWeb scraper with its own DB session."""
    db = SessionLocal()
    if full_scrape:
        log.info("scraper_starting", source="lpw", mode="district", max_pages=district_pages)
    else:
        log.info("scraper_starting", source="lpw", mode="main_feed", max_pages=max_pages)
    try:
        if full_scrape:
            found, new = await scrape_lpw_districts(db, max_pages=district_pages)
        else:
            found, new = await scrape_lpw(db, max_pages=max_pages)
        log.info("scraper_complete", source="lpw", found=found, new=new)
        return {"source": "lpw", "found": found, "new": new, "success": True}
    except Exception as e:
        log.error("scraper_failed", source="lpw", error=str(e))
        return {"source": "lpw", "found": 0, "new": 0, "success": False, "error": str(e)}
    finally:
        db.close()


async def run_lamudi(max_pages: int = 20):
    """Run house.lk (Lamudi) scraper with its own DB session."""
    db = SessionLocal()
    log.info("scraper_starting", source="lamudi", max_pages=max_pages)
    try:
        scraper = LamudiScraper(db)
        found, new = await scraper.scrape(max_pages=max_pages)
        log.info("scraper_complete", source="lamudi", found=found, new=new)
        return {"source": "lamudi", "found": found, "new": new, "success": True}
    except Exception as e:
        log.error("scraper_failed", source="lamudi", error=str(e))
        return {"source": "lamudi", "found": 0, "new": 0, "success": False, "error": str(e)}
    finally:
        db.close()


async def run_data_processing():
    """Run data cleaning and geocoding with its own DB session."""
    db = SessionLocal()
    log.info("processing_starting")
    try:
        cleaner = DataCleaner(db)
        clean_stats = cleaner.process_all()
        log.info("cleaning_complete", stats=clean_stats)

        geocoder = Geocoder(db)
        geo_stats = geocoder.geocode_listings()
        log.info("geocoding_complete", stats=geo_stats)

        return {"cleaned": clean_stats, "geocoded": geo_stats, "success": True}
    except Exception as e:
        log.error("processing_failed", error=str(e))
        return {"success": False, "error": str(e)}
    finally:
        db.close()


async def main():
    parser = argparse.ArgumentParser(description="Run property scrapers in parallel")
    parser.add_argument(
        "--scrapers",
        nargs="+",
        choices=["ikman", "lpw", "lamudi"],
        help="Scrapers to run (default: all)",
    )
    parser.add_argument("--test", action="store_true",
                        help="Test mode: 1-2 pages per scraper")
    parser.add_argument("--full", action="store_true",
                        help="Full mode: includes district sweeps and extra categories")
    parser.add_argument("--skip-processing", action="store_true",
                        help="Skip data cleaning and geocoding")
    parser.add_argument("--ikman-pages", type=int, default=50,
                        help="Max pages for ikman main feed (default: 50)")
    parser.add_argument("--lpw-pages", type=int, default=15,
                        help="Max pages for lpw main feed (default: 15)")
    parser.add_argument("--lamudi-pages", type=int, default=20,
                        help="Max pages for lamudi (default: 20)")
    parser.add_argument("--district-pages", type=int, default=50,
                        help="Max pages per district for ikman and lpw (default: 50)")

    args = parser.parse_args()

    scrapers_to_run = args.scrapers if args.scrapers else ["ikman", "lpw", "lamudi"]

    if args.test:
        ikman_pages, lpw_pages, lamudi_pages, district_pages = 2, 1, 1, 1
        log.info("test_mode_enabled")
    else:
        ikman_pages = args.ikman_pages
        lpw_pages = args.lpw_pages
        lamudi_pages = args.lamudi_pages
        district_pages = args.district_pages

    start_time = datetime.utcnow()

    print("\n" + "=" * 70)
    print("🚀 PROPERTY SCRAPER - STARTING")
    print("=" * 70)
    print(f"Scrapers:       {', '.join(scrapers_to_run)}")
    print(f"Mode:           {'TEST' if args.test else 'FULL' if args.full else 'STANDARD'}")
    print(f"District pages: {district_pages}")
    print(f"Parallelism:    {'yes — scrapers run simultaneously' if len(scrapers_to_run) > 1 else 'single scraper'}")
    print(f"Time:           {start_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 70 + "\n")

    # Build parallel tasks — each scraper owns its own DB session
    tasks = []
    if "ikman" in scrapers_to_run:
        tasks.append(run_ikman(max_pages=ikman_pages, full_scrape=args.full, district_pages=district_pages))
    if "lpw" in scrapers_to_run:
        tasks.append(run_lpw(max_pages=lpw_pages, full_scrape=args.full, district_pages=district_pages))
    if "lamudi" in scrapers_to_run:
        tasks.append(run_lamudi(max_pages=lamudi_pages))

    scraper_results = await asyncio.gather(*tasks, return_exceptions=True)

    # Normalise any unexpected exceptions into result dicts
    results = []
    for r in scraper_results:
        if isinstance(r, Exception):
            results.append({"found": 0, "new": 0, "success": False, "error": str(r)})
        else:
            results.append(r)

    # Processing runs after all scrapers finish (needs their data committed)
    if not args.skip_processing:
        print("\n🔄 Processing Data (cleaning & geocoding)...")
        proc_result = await run_data_processing()
        results.append(proc_result)

    # Summary
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()

    print("\n" + "=" * 70)
    print("📊 SCRAPING SUMMARY")
    print("=" * 70)

    total_found = total_new = 0
    for result in results:
        source = result.get("source")
        if not source:
            continue
        status = "✅ SUCCESS" if result.get("success") else "❌ FAILED"
        print(f"\n{source.upper()}: {status}")
        if result.get("success"):
            print(f"  Found: {result.get('found', 0)}")
            print(f"  New:   {result.get('new', 0)}")
            total_found += result.get("found", 0)
            total_new += result.get("new", 0)
        else:
            print(f"  Error: {result.get('error', 'unknown')}")

    print(f"\n{'─' * 70}")
    print(f"TOTAL FOUND: {total_found}")
    print(f"TOTAL NEW:   {total_new}")
    print(f"DURATION:    {int(duration)}s ({duration / 60:.1f}m)")
    print(f"COMPLETED:   {end_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 70 + "\n")

    sys.exit(0 if any(r.get("success") for r in results) else 1)


if __name__ == "__main__":
    asyncio.run(main())
