import asyncio
import os
from math import ceil
from dotenv import load_dotenv
from db.connection import SessionLocal
from scraper.ikman import IkmanScraper
from scraper.cleaner import DataCleaner

root = r"C:\Users\Ovindu\Documents\Ardeno Studio\Property Price Intelligence An Ardeno Production"
load_dotenv(os.path.join(root, ".env"))

STATE_FILE = os.path.join(root, "ikman_auth_state.json")

district_counts = {
    "matale": 346,
    "nuwara-eliya": 481,
    "matara": 1110,
    "hambantota": 783,
    "jaffna": 199,
    "vavuniya": 27,
    "kilinochchi": 25,
    "batticaloa": 94,
    "ampara": 83,
    "trincomalee": 82,
    "kurunegala": 1300,
    "puttalam": 196,
    "anuradhapura": 514,
    "polonnaruwa": 46,
    "badulla": 321,
    "monaragala": 111,
    "ratnapura": 263,
    "kegalle": 427,
    "mannar": 8,
    "mullativu": 2,
}

async def run():
    db = SessionLocal()
    if os.path.exists(STATE_FILE):
        print(f"Using saved auth state from {STATE_FILE}", flush=True)
    else:
        print("No auth state found — run _ikman_solve_captcha.py first if getting blocked.", flush=True)

    try:
        for i, (slug, count) in enumerate(district_counts.items(), 1):
            pages = max(1, ceil(count / 25))
            print(f"[{i}/{len(district_counts)}] {slug}: {pages} pages", flush=True)
            try:
                scraper = IkmanScraper(db)
                found, new = await scraper.scrape(
                    max_pages=pages,
                    location=slug,
                    storage_state=STATE_FILE if os.path.exists(STATE_FILE) else None,
                )
                print(f"  done: found={found}, new={new}", flush=True)
            except Exception as e:
                print(f"  failed: {e}", flush=True)
            await asyncio.sleep(2)

        cleaner = DataCleaner(db)
        total_processed = 0
        while True:
            stats = cleaner.process_all(limit=500)
            total_processed += stats.get("processed", 0)
            print(f"  cleaner batch: {stats}", flush=True)
            if stats.get("processed", 0) < 500:
                break
        print("cleaner_processed", total_processed, flush=True)
    finally:
        db.close()

asyncio.run(run())
