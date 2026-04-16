"""
Comprehensive scraper runner for all 3 property listing sources.
Runs Ikman, Lamudi (house.lk), and LPW scrapers with error handling and reporting.

Usage:
    python run_all_scrapers.py              # Run all scrapers
    python run_all_scrapers.py --test       # Test mode (fewer pages)
    python run_all_scrapers.py --source ikman  # Run specific scraper
"""
import asyncio
import sys
import argparse
from datetime import datetime
from dotenv import load_dotenv
import structlog

load_dotenv()

from db.connection import SessionLocal
from scraper.ikman import scrape_ikman_full, IkmanScraper
from scraper.lamudi import LamudiScraper
from scraper.lpw import LPWScraper
from scraper.cleaner import DataCleaner
from scraper.geocoder import Geocoder

log = structlog.get_logger()


class ScraperResult:
    def __init__(self, source: str, success: bool, found: int = 0, new: int = 0, error: str = None):
        self.source = source
        self.success = success
        self.found = found
        self.new = new
        self.error = error
        self.timestamp = datetime.utcnow()


async def run_ikman_scraper(db, test_mode: bool = False) -> ScraperResult:
    """Run Ikman scraper with full coverage."""
    try:
        log.info("starting_ikman_scraper", test_mode=test_mode)

        if test_mode:
            # Test mode: just scrape first 5 pages of main feed
            scraper = IkmanScraper(db)
            found, new = await scraper.scrape(max_pages=5)
        else:
            # Full mode: main feed + thin districts + extra categories
            found, new = await scrape_ikman_full(
                db,
                main_pages=50,
                district_pages=20,
                extra_pages=10,
                headless=True
            )

        log.info("ikman_scraper_complete", found=found, new=new)
        return ScraperResult("ikman", True, found, new)

    except Exception as e:
        error_msg = str(e)
        log.error("ikman_scraper_failed", error=error_msg)

        # Check if it's a blocking/captcha error
        if "blocked" in error_msg.lower() or "captcha" in error_msg.lower():
            log.warning("ikman_blocked_by_captcha", suggestion="Consider using proxy or solving captcha manually")

        return ScraperResult("ikman", False, 0, 0, error_msg)


async def run_lamudi_scraper(db, test_mode: bool = False) -> ScraperResult:
    """Run Lamudi (house.lk) scraper."""
    try:
        log.info("starting_lamudi_scraper", test_mode=test_mode)

        scraper = LamudiScraper(db)
        max_pages = 5 if test_mode else 20
        found, new = await scraper.scrape(max_pages=max_pages)

        log.info("lamudi_scraper_complete", found=found, new=new)
        return ScraperResult("lamudi", True, found, new)

    except Exception as e:
        error_msg = str(e)
        log.error("lamudi_scraper_failed", error=error_msg)

        if "blocked" in error_msg.lower() or "cloudflare" in error_msg.lower():
            log.warning("lamudi_blocked_by_cloudflare", suggestion="Site uses Cloudflare protection")

        return ScraperResult("lamudi", False, 0, 0, error_msg)


async def run_lpw_scraper(db, test_mode: bool = False) -> ScraperResult:
    """Run LPW (lankapropertyweb.com) scraper."""
    try:
        log.info("starting_lpw_scraper", test_mode=test_mode)

        scraper = LPWScraper(db)
        max_pages = 5 if test_mode else 15
        found, new = await scraper.scrape(max_pages=max_pages)

        log.info("lpw_scraper_complete", found=found, new=new)
        return ScraperResult("lpw", True, found, new)

    except Exception as e:
        error_msg = str(e)
        log.error("lpw_scraper_failed", error=error_msg)

        if "blocked" in error_msg.lower():
            log.warning("lpw_blocked", suggestion="Consider rotating user agents or adding delays")

        return ScraperResult("lpw", False, 0, 0, error_msg)


async def process_scraped_data(db):
    """Clean and geocode scraped data."""
    try:
        log.info("starting_data_processing")

        # Clean raw listings
        cleaner = DataCleaner(db)
        clean_stats = cleaner.process_all()
        log.info("data_cleaning_complete", stats=clean_stats)

        # Geocode listings
        geocoder = Geocoder(db)
        geo_stats = geocoder.geocode_listings()
        log.info("geocoding_complete", stats=geo_stats)

        return True, clean_stats, geo_stats

    except Exception as e:
        log.error("data_processing_failed", error=str(e))
        return False, None, None


def print_summary(results: list[ScraperResult], processing_success: bool = None):
    """Print a formatted summary of scraper results."""
    print("\n" + "="*80)
    print("SCRAPER RUN SUMMARY")
    print("="*80)
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    print("-"*80)

    total_found = 0
    total_new = 0
    failed_scrapers = []

    for result in results:
        status = "✓ SUCCESS" if result.success else "✗ FAILED"
        print(f"\n{result.source.upper():15s} {status}")

        if result.success:
            print(f"  Found: {result.found:,} listings")
            print(f"  New:   {result.new:,} listings")
            total_found += result.found
            total_new += result.new
        else:
            print(f"  Error: {result.error}")
            failed_scrapers.append(result.source)

    print("-"*80)
    print(f"\nTOTAL FOUND: {total_found:,} listings")
    print(f"TOTAL NEW:   {total_new:,} listings")

    if processing_success is not None:
        proc_status = "✓ SUCCESS" if processing_success else "✗ FAILED"
        print(f"\nDATA PROCESSING: {proc_status}")

    if failed_scrapers:
        print(f"\n⚠ WARNING: {len(failed_scrapers)} scraper(s) failed: {', '.join(failed_scrapers)}")
        print("\nTroubleshooting tips:")
        print("  1. Check if sites are blocking your IP (captchas, rate limits)")
        print("  2. Try using a proxy: set PROXY_URL in .env file")
        print("  3. For Ikman captchas: run _ikman_solve_captcha.py manually")
        print("  4. Increase delays: adjust SCRAPER_BACKOFF_BASE_SECONDS in .env")

    print("="*80 + "\n")


async def main():
    parser = argparse.ArgumentParser(description="Run property scrapers")
    parser.add_argument("--test", action="store_true", help="Test mode (fewer pages)")
    parser.add_argument("--source", choices=["ikman", "lamudi", "lpw", "all"],
                        default="all", help="Which scraper to run")
    parser.add_argument("--no-process", action="store_true",
                        help="Skip data processing (cleaning/geocoding)")
    args = parser.parse_args()

    db = SessionLocal()
    results = []

    try:
        # Run scrapers
        if args.source in ["ikman", "all"]:
            result = await run_ikman_scraper(db, args.test)
            results.append(result)

        if args.source in ["lamudi", "all"]:
            result = await run_lamudi_scraper(db, args.test)
            results.append(result)

        if args.source in ["lpw", "all"]:
            result = await run_lpw_scraper(db, args.test)
            results.append(result)

        # Process data if any scraper succeeded
        processing_success = None
        if not args.no_process and any(r.success for r in results):
            processing_success, clean_stats, geo_stats = await process_scraped_data(db)

        # Print summary
        print_summary(results, processing_success)

        # Return exit code based on success
        all_success = all(r.success for r in results)
        sys.exit(0 if all_success else 1)

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
