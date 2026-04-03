"""
Local scraper runner - run this from the project root.
Usage:
    python run_scraper.py ikman
    python run_scraper.py lpw
    python run_scraper.py process
"""
import asyncio
import sys
from dotenv import load_dotenv
load_dotenv()

from db.connection import SessionLocal
from scraper.ikman import scrape_ikman
from scraper.lpw import scrape_lpw
from scraper.cleaner import DataCleaner
from scraper.geocoder import Geocoder


async def main():
    source = sys.argv[1] if len(sys.argv) > 1 else "help"
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else None
    db = SessionLocal()

    try:
        if source == "ikman":
            pages_text = f" ({max_pages} pages)" if max_pages else ""
            print(f"[*] Starting Ikman scraper{pages_text}...")
            # Use max_pages if provided, else let it use function defaults
            kwargs = {"max_pages": max_pages} if max_pages else {}
            found, new = await scrape_ikman(db, **kwargs)
            print(f"[OK] Done! Found: {found}, New: {new}")

        elif source == "lpw":
            pages_text = f" ({max_pages} pages)" if max_pages else ""
            print(f"[*] Starting LankaPropertyWeb scraper{pages_text}...")
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

        else:
            print("Usage: python run_scraper.py [ikman | lpw | process] [max_pages]")

    finally:
        db.close()


asyncio.run(main())
