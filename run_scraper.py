"""
Local scraper runner - run this from the project root.
Usage:
    python run_scraper.py ikman
    python run_scraper.py lpw
    python run_scraper.py process
    python run_scraper.py bridge-ikman   # identity bridge (dry by default: add --apply)
    python run_scraper.py metrics
"""
import asyncio
import sys
from dotenv import load_dotenv
load_dotenv()

from db.connection import SessionLocal
from scraper.flags import use_ikman_serp_api, use_lpw_api, flag_snapshot
from scraper.ikman import scrape_ikman
from scraper.lpw import scrape_lpw
from scraper.cleaner import DataCleaner
from scraper.geocoder import Geocoder


async def main():
    source = sys.argv[1] if len(sys.argv) > 1 else "help"
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else None
    db = SessionLocal()

    try:
        if source == "ikman":
            pages_text = f" ({max_pages} pages)" if max_pages else ""
            if use_ikman_serp_api():
                from scraper.ikman_api import scrape_ikman_api
                print(f"[*] Starting Ikman API SERP scraper{pages_text}...")
                found, new = await scrape_ikman_api(db, max_pages=max_pages)
            else:
                print(f"[*] Starting Ikman Playwright scraper{pages_text}...")
                kwargs = {"max_pages": max_pages} if max_pages else {}
                found, new = await scrape_ikman(db, **kwargs)
            print(f"[OK] Done! Found: {found}, New: {new}")

        elif source == "lpw":
            pages_text = f" ({max_pages} pages)" if max_pages else ""
            if use_lpw_api():
                from scraper.lpw_api import scrape_lpw_api
                print(f"[*] Starting LankaPropertyWeb API scraper{pages_text}...")
                found, new = await scrape_lpw_api(db, max_pages=max_pages)
            else:
                print(f"[*] Starting LankaPropertyWeb Playwright scraper{pages_text}...")
                kwargs = {"max_pages": max_pages} if max_pages else {}
                found, new = await scrape_lpw(db, **kwargs)
            print(f"[OK] Done! Found: {found}, New: {new}")

        elif source == "process":
            print("[*] Cleaning raw listings...")
            cleaner = DataCleaner(db)
            stats = cleaner.process_all()
            print(f"[OK] Cleaned: {stats}")

            print("[*] Geocoding listings...")
            geocoder = Geocoder(db)
            geo_stats = geocoder.geocode_listings()
            print(f"[OK] Geocoded: {geo_stats}")

        elif source == "bridge-ikman":
            from scraper.ikman_api import bridge_ikman_identity
            apply = "--apply" in sys.argv
            print(f"[*] Ikman identity bridge ({'APPLY' if apply else 'dry-run'})...")
            stats = bridge_ikman_identity(db, dry_run=not apply)
            print(f"[OK] {stats}")

        elif source == "metrics":
            from scraper.metrics import fill_rate_snapshot
            print("[*] Fill-rate snapshot...")
            print(fill_rate_snapshot(db))
            print("[*] Flags:", flag_snapshot())

        else:
            print(
                "Usage: python run_scraper.py "
                "[ikman | lpw | process | bridge-ikman | metrics] [max_pages]"
            )

    finally:
        db.close()


asyncio.run(main())
