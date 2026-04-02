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
    db = SessionLocal()

    try:
        if source == "ikman":
            print("[*] Starting Ikman scraper...")
            found, new = await scrape_ikman(db)
            print(f"[OK] Done! Found: {found}, New: {new}")

        elif source == "lpw":
            print("[*] Starting LankaPropertyWeb scraper...")
            found, new = await scrape_lpw(db)
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
            print("Usage: python run_scraper.py [ikman | lpw | process]")

    finally:
        db.close()


asyncio.run(main())
