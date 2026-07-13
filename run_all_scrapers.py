#!/usr/bin/env python3
"""
Master Scraper Runner
Run all scrapers (ikman, lamudi, onlineproperty) in parallel.

Usage:
    python run_all_scrapers.py                        # Run all scrapers (standard)
    python run_all_scrapers.py --full                 # Full mode: districts + extras
    python run_all_scrapers.py --scrapers ikman       # Run specific scraper
    python run_all_scrapers.py --test                 # Test mode (1-2 pages each)
    python run_all_scrapers.py --district-pages 50    # Pages per district (default: 50)
    python run_all_scrapers.py --mega                 # Mega mode: 500 pages, all 25 districts
"""
import asyncio
import sys
import os
import argparse
import random
from dataclasses import replace
from datetime import datetime
from dotenv import load_dotenv
import structlog
from sqlalchemy import func

load_dotenv()

from db.connection import SessionLocal
from db.models import JobRun, Listing
from scraper.ikman import scrape_ikman, scrape_ikman_full, scrape_ikman_coverage
from scraper.location_targets import CANONICAL_DISTRICTS, build_ikman_coverage_targets
from scraper.lpw import scrape_lpw, scrape_lpw_districts
from scraper.lamudi import LamudiScraper
from scraper.onlineproperty import scrape_onlineproperty
from scraper.cleaner import DataCleaner
from scraper.geocoder import Geocoder

log = structlog.get_logger()


def _district_counts(db) -> dict[str, int]:
    rows = (
        db.query(Listing.district, func.count(Listing.id))
        .filter(Listing.district.isnot(None), Listing.is_outlier == False)
        .group_by(Listing.district)
        .all()
    )
    return {district: int(count) for district, count in rows if district}


async def run_ikman(
    max_pages: int = 50,
    full_scrape: bool = False,
    district_pages: int = 50,
    use_all_districts: bool = False,
    coverage: bool = False,
    district_target: int = 750,
    subdistricts_per_district: int = 2,
    subdistrict_pages: int = 2,
):
    """Run ikman scraper with its own DB session."""
    db = SessionLocal()
    log.info("scraper_starting", source="ikman", max_pages=max_pages, coverage=coverage)
    try:
        if coverage:
            targets = build_ikman_coverage_targets(
                _district_counts(db),
                district_target=district_target,
                subdistricts_per_district=subdistricts_per_district,
                subdistrict_pages=subdistrict_pages,
            )
            if district_pages:
                targets = [
                    replace(
                        target,
                        pages=min(target.pages, district_pages) if target.kind == "district" else target.pages,
                        min_pages=min(target.min_pages, district_pages) if target.kind == "district" else target.min_pages,
                    )
                    for target in targets
                ]
            result = await scrape_ikman_coverage(
                db,
                main_pages=max_pages,
                targets=targets,
                headless=True,
            )
            log.info("scraper_complete", **result)
            return result
        elif full_scrape:
            found, new = await scrape_ikman_full(
                db,
                main_pages=max_pages,
                district_pages=district_pages,
                extra_pages=10,
                headless=True,
                use_all_districts=use_all_districts,
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


async def run_lpw(
    max_pages: int = 15,
    full_scrape: bool = False,
    district_pages: int = 50,
    use_all_districts: bool = False,
    coverage: bool = False,
):
    """Run LankaPropertyWeb scraper with its own DB session.

    District mode (scrape_lpw_districts) is only used for --mega runs because
    the srch_words filter on the redesigned LPW site returns no results for most
    districts, silently yielding found=11/new=0 every daily run. The main feed
    (scrape_lpw) hits /sale|land|rentals|condo/index.php directly and works fine.
    """
    db = SessionLocal()
    # mega mode: district sweep (all 25 districts); otherwise always use main feed
    if use_all_districts:
        log.info("scraper_starting", source="lpw", mode="mega_district", max_pages=district_pages)
    else:
        log.info("scraper_starting", source="lpw", mode="main_feed", max_pages=max_pages)
    try:
        if use_all_districts:
            found, new = await scrape_lpw_districts(db, max_pages=district_pages, use_all_districts=True)
        else:
            found, new = await scrape_lpw(db, max_pages=max_pages)
            if coverage and os.getenv("LPW_COVERAGE_PROBE", "1") != "0":
                try:
                    probe_found, probe_new = await scrape_lpw_districts(db, max_pages=1, use_all_districts=True)
                    found += probe_found
                    new += probe_new
                    log.info(
                        "lpw_coverage_probe_complete",
                        found=probe_found,
                        new=probe_new,
                        district_targets_attempted=len(CANONICAL_DISTRICTS),
                    )
                except Exception as probe_error:
                    log.warning("lpw_coverage_probe_skipped", error=str(probe_error))
        log.info("scraper_complete", source="lpw", found=found, new=new)
        result = {"source": "lpw", "found": found, "new": new, "success": True}
        if coverage:
            result["district_targets_attempted"] = len(CANONICAL_DISTRICTS)
            result["subdistrict_targets_attempted"] = 0
            result["new_by_target_district"] = {}
        return result
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


async def run_onlineproperty(max_pages: int = 50):
    """Run onlineproperty.lk scraper with its own DB session."""
    db = SessionLocal()
    log.info("scraper_starting", source="onlineproperty", max_pages=max_pages)
    try:
        result = await scrape_onlineproperty(db, max_pages=max_pages)
        success = result.get("success", result.get("found", 0) > 0)
        payload = {
            "source": "onlineproperty",
            "found": result["found"],
            "new": result["new"],
            "success": success,
        }
        if result.get("error"):
            payload["error"] = result["error"]
        if not success:
            log.error(
                "scraper_zero_yield",
                source="onlineproperty",
                found=result["found"],
                error=result.get("error", "zero_yield"),
            )
        return payload
    except Exception as e:
        log.error("scraper_failed", source="onlineproperty", error=str(e))
        return {"source": "onlineproperty", "found": 0, "new": 0, "success": False, "error": str(e)}
    finally:
        db.close()


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


async def run_data_processing():
    """Run data cleaning, geocoding, and aggregate computation with its own DB session."""
    db = SessionLocal()
    log.info("processing_starting")
    try:
        # --- Clean ---
        clean_run = _start_job_run(db, "clean_listings")
        try:
            cleaner = DataCleaner(db)
            clean_stats = cleaner.process_all()
            null_reprocess_stats = cleaner.reprocess_null_districts()
            clean_stats["null_district_reprocess"] = null_reprocess_stats
            log.info("cleaning_complete", stats=clean_stats)
            _finish_job_run(db, clean_run, "success", stats=clean_stats)
        except Exception as e:
            log.error("cleaning_failed", error=str(e))
            _finish_job_run(db, clean_run, "failed", error=str(e))
            clean_stats = {}

        # --- Geocode ---
        geo_run = _start_job_run(db, "geocode_listings")
        try:
            geocoder = Geocoder(db)
            geo_stats = geocoder.geocode_listings()
            log.info("geocoding_complete", stats=geo_stats)
            _finish_job_run(db, geo_run, "success", stats=geo_stats)
        except Exception as e:
            log.error("geocoding_failed", error=str(e))
            _finish_job_run(db, geo_run, "failed", error=str(e))
            geo_stats = {}

        # --- Aggregates ---
        agg_run = _start_job_run(db, "compute_aggregates")
        try:
            from api.main import PriceAggregator
            aggregator = PriceAggregator(db)
            count = aggregator.aggregate()
            log.info("aggregates_complete", count=count)
            _finish_job_run(db, agg_run, "success", stats={"aggregates": count})
        except Exception as e:
            log.error("aggregates_failed", error=str(e))
            _finish_job_run(db, agg_run, "failed", error=str(e))

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
        choices=["ikman", "lpw", "lamudi", "onlineproperty"],
        help="Scrapers to run (default: all)",
    )
    parser.add_argument("--test", action="store_true",
                        help="Test mode: 1-2 pages per scraper")
    parser.add_argument("--full", action="store_true",
                        help="Full mode: includes district sweeps and extra categories")
    parser.add_argument("--coverage", action="store_true",
                        help="Adaptive daily coverage: main feed plus all districts and rotating subdistrict targets")
    parser.add_argument("--skip-processing", action="store_true",
                        help="Skip data cleaning and geocoding")
    parser.add_argument("--ikman-pages", type=int, default=75,
                        help="Max pages for ikman main feed (default: 75)")
    parser.add_argument("--lpw-pages", type=int, default=25,
                        help="Max pages for lpw main feed (default: 25)")
    parser.add_argument("--lamudi-pages", type=int, default=35,
                        help="Max pages for lamudi (default: 35)")
    parser.add_argument("--onlineproperty-pages", type=int, default=50,
                        help="Max pages per onlineproperty category (default: 50)")
    parser.add_argument("--district-pages", type=int, default=50,
                        help="Max pages per district for ikman and lpw (default: 50)")
    parser.add_argument("--district-target", type=int, default=750,
                        help="Clean-listing target per district before reducing adaptive district budget (default: 750)")
    parser.add_argument("--subdistricts-per-district", type=int, default=3,
                        help="Rotating subdistrict aliases per thin district in coverage mode (default: 3)")
    parser.add_argument("--subdistrict-pages", type=int, default=3,
                        help="Pages per subdistrict alias target in coverage mode (default: 3)")
    parser.add_argument("--mega", action="store_true",
                        help="Mega mode: 500 pages, all 25 districts, implies --full")

    args = parser.parse_args()

    scrapers_to_run = args.scrapers if args.scrapers else ["ikman", "lpw", "lamudi", "onlineproperty"]

    subdistricts_per_district = args.subdistricts_per_district
    subdistrict_pages = args.subdistrict_pages

    if args.test:
        ikman_pages, lpw_pages, lamudi_pages, district_pages = 2, 1, 1, 1
        onlineproperty_pages = 1
        subdistricts_per_district = 0
        subdistrict_pages = min(subdistrict_pages, 1)
        log.info("test_mode_enabled")
    elif args.mega:
        ikman_pages, lpw_pages, lamudi_pages, district_pages = 500, 500, 500, 500
        onlineproperty_pages = 500
    else:
        ikman_pages = args.ikman_pages
        lpw_pages = args.lpw_pages
        lamudi_pages = args.lamudi_pages
        onlineproperty_pages = args.onlineproperty_pages
        district_pages = args.district_pages

    full_scrape = args.full or args.mega
    use_all_districts = args.mega
    coverage = args.coverage and not args.mega

    start_time = datetime.utcnow()

    print("\n" + "=" * 70)
    print("PROPERTY SCRAPER - STARTING")
    print("=" * 70)
    print(f"Scrapers:       {', '.join(scrapers_to_run)}")
    print(f"Mode:           {'TEST' if args.test else 'MEGA' if args.mega else 'COVERAGE' if coverage else 'FULL' if args.full else 'STANDARD'}")
    print(f"District pages: {district_pages}")
    if coverage:
        print(f"District target:{args.district_target}")
        print(f"Subdistricts:   {subdistricts_per_district} per thin district, {subdistrict_pages} page(s) each")
        print(f"OnlineProp pgs:{onlineproperty_pages} per category")
    print(f"Parallelism:    {'yes - scrapers run simultaneously' if len(scrapers_to_run) > 1 else 'single scraper'}")
    print(f"Time:           {start_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 70 + "\n")

    # Build parallel tasks — each scraper owns its own DB session
    tasks = []
    if "ikman" in scrapers_to_run:
        tasks.append(run_ikman(
            max_pages=ikman_pages,
            full_scrape=full_scrape,
            district_pages=district_pages,
            use_all_districts=use_all_districts,
            coverage=coverage,
            district_target=args.district_target,
            subdistricts_per_district=subdistricts_per_district,
            subdistrict_pages=subdistrict_pages,
        ))
    if "lpw" in scrapers_to_run:
        tasks.append(run_lpw(
            max_pages=lpw_pages,
            full_scrape=full_scrape,
            district_pages=district_pages,
            use_all_districts=use_all_districts,
            coverage=coverage,
        ))
    if "lamudi" in scrapers_to_run:
        tasks.append(run_lamudi(max_pages=lamudi_pages))
    if "onlineproperty" in scrapers_to_run:
        tasks.append(run_onlineproperty(max_pages=onlineproperty_pages))

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
        print("\nProcessing Data (cleaning & geocoding)...")
        proc_result = await run_data_processing()
        results.append(proc_result)

    # Summary
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()

    print("\n" + "=" * 70)
    print("SCRAPING SUMMARY")
    print("=" * 70)

    total_found = total_new = 0
    for result in results:
        source = result.get("source")
        if not source:
            continue
        status = "SUCCESS" if result.get("success") else "FAILED"
        print(f"\n{source.upper()}: {status}")
        if result.get("success"):
            print(f"  Found: {result.get('found', 0)}")
            print(f"  New:   {result.get('new', 0)}")
            if "district_targets_attempted" in result:
                print(f"  District targets:    {result.get('district_targets_attempted', 0)}")
                print(f"  Subdistrict targets: {result.get('subdistrict_targets_attempted', 0)}")
                by_district = result.get("new_by_target_district") or {}
                if by_district:
                    compact = ", ".join(f"{k}:{v}" for k, v in sorted(by_district.items()))
                    print(f"  New by target district: {compact}")
            total_found += result.get("found", 0)
            total_new += result.get("new", 0)
        else:
            print(f"  Error: {result.get('error', 'unknown')}")

    print(f"\n{'-' * 70}")
    print(f"TOTAL FOUND: {total_found}")
    print(f"TOTAL NEW:   {total_new}")
    print(f"DURATION:    {int(duration)}s ({duration / 60:.1f}m)")
    print(f"COMPLETED:   {end_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 70 + "\n")

    sys.exit(0 if all(r.get("success") for r in results if r.get("source")) else 1)


if __name__ == "__main__":
    asyncio.run(main())
