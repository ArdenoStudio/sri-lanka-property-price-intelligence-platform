"""
Daily automated scraper scheduler.
Runs all property scrapers daily at a specified time with retry logic.

Usage:
    python daily_scraper.py                 # Run scheduler (runs at 2 AM daily)
    python daily_scraper.py --run-now       # Run scraping immediately
    python daily_scraper.py --time "03:00"  # Custom schedule time
"""
import asyncio
import argparse
from datetime import datetime, time
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import structlog
from dotenv import load_dotenv

load_dotenv()

from db.connection import SessionLocal
from run_all_scrapers import run_ikman_scraper, run_lamudi_scraper, run_lpw_scraper, process_scraped_data, print_summary

log = structlog.get_logger()


async def daily_scrape_job():
    """Main job that runs daily scraping."""
    log.info("daily_scrape_job_started", timestamp=datetime.utcnow().isoformat())

    db = SessionLocal()
    results = []

    try:
        # Run all scrapers sequentially (to avoid overwhelming sites)
        log.info("running_ikman_scraper")
        ikman_result = await run_ikman_scraper(db, test_mode=False)
        results.append(ikman_result)
        await asyncio.sleep(30)  # Cooldown between scrapers

        log.info("running_lamudi_scraper")
        lamudi_result = await run_lamudi_scraper(db, test_mode=False)
        results.append(lamudi_result)
        await asyncio.sleep(30)

        log.info("running_lpw_scraper")
        lpw_result = await run_lpw_scraper(db, test_mode=False)
        results.append(lpw_result)

        # Process data if any scraper succeeded
        processing_success = None
        if any(r.success for r in results):
            log.info("processing_scraped_data")
            processing_success, clean_stats, geo_stats = await process_scraped_data(db)

        # Print and log summary
        print_summary(results, processing_success)

        # Log to structured log for monitoring
        total_found = sum(r.found for r in results if r.success)
        total_new = sum(r.new for r in results if r.success)
        failed_count = sum(1 for r in results if not r.success)

        log.info("daily_scrape_job_completed",
                 total_found=total_found,
                 total_new=total_new,
                 failed_scrapers=failed_count,
                 processing_success=processing_success,
                 timestamp=datetime.utcnow().isoformat())

        return True

    except Exception as e:
        log.error("daily_scrape_job_failed", error=str(e), timestamp=datetime.utcnow().isoformat())
        return False

    finally:
        db.close()


async def run_scheduler(schedule_time: str = "02:00"):
    """
    Run the scheduler that executes scraping at specified time daily.

    Args:
        schedule_time: Time in HH:MM format (24-hour) when to run daily
    """
    scheduler = AsyncIOScheduler()

    # Parse schedule time
    hour, minute = map(int, schedule_time.split(":"))

    # Schedule daily scraping
    scheduler.add_job(
        daily_scrape_job,
        trigger=CronTrigger(hour=hour, minute=minute),
        id="daily_scrape",
        name="Daily Property Scraper",
        replace_existing=True,
        max_instances=1,  # Prevent overlapping runs
    )

    log.info("scheduler_started", schedule_time=schedule_time)
    print(f"\n{'='*80}")
    print(f"Daily Scraper Scheduler Started")
    print(f"{'='*80}")
    print(f"Schedule: Daily at {schedule_time} (24-hour format)")
    print(f"Timezone: System local time")
    print(f"Next run: {scheduler.get_job('daily_scrape').next_run_time}")
    print(f"\nPress Ctrl+C to stop the scheduler")
    print(f"{'='*80}\n")

    scheduler.start()

    # Keep the script running
    try:
        while True:
            await asyncio.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        log.info("scheduler_stopped")
        print("\nScheduler stopped.")
        scheduler.shutdown()


async def main():
    parser = argparse.ArgumentParser(description="Daily automated scraper")
    parser.add_argument("--run-now", action="store_true",
                        help="Run scraping immediately instead of scheduling")
    parser.add_argument("--time", default="02:00",
                        help="Daily run time in HH:MM format (24-hour, default: 02:00)")
    args = parser.parse_args()

    if args.run_now:
        # Run immediately
        print("Running scrapers immediately...")
        await daily_scrape_job()
    else:
        # Start scheduler
        await run_scheduler(args.time)


if __name__ == "__main__":
    asyncio.run(main())
