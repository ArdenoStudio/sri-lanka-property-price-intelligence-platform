"""
Targeted scrape for thin districts (< 100 listings in DB).
Run: python scrape_thin_districts.py
"""
import asyncio
import os
from dotenv import load_dotenv
from db.connection import SessionLocal
from scraper.ikman import scrape_ikman
from scraper.cleaner import DataCleaner

root = r"C:\Users\Ovindu\Documents\Ardeno Studio\Property Price Intelligence An Ardeno Production"
load_dotenv(os.path.join(root, ".env"))

# Districts with < 100 listings in the DB as of 2026-04-05
# slug → current count (for reference)
THIN_DISTRICTS = [
    ("galle", 305),
]

MAX_PAGES = 50

async def run():
    total_new = 0

    for i, (slug, current) in enumerate(THIN_DISTRICTS, 1):
        print(f"\n[{i}/{len(THIN_DISTRICTS)}] {slug} (currently {current} listings) — scraping {MAX_PAGES} pages...", flush=True)
        # Fresh session per district — a failure in one can never poison the next
        db = SessionLocal()
        try:
            found, new = await scrape_ikman(db, max_pages=MAX_PAGES, location=slug)
            total_new += new
            print(f"  [OK] found={found}  new={new}  running_total_new={total_new}", flush=True)
        except Exception as e:
            msg = str(e).encode('ascii', errors='replace').decode('ascii')
            print(f"  [FAIL] {msg[:200]}", flush=True)
        finally:
            db.close()
        await asyncio.sleep(3)

    print(f"\n--- Scraping done. {total_new} new raw listings. Running cleaner... ---\n", flush=True)

    # Fresh session for cleaning too
    db = SessionLocal()
    try:
        cleaner = DataCleaner(db)
        total_processed = 0
        while True:
            stats = cleaner.process_all(limit=500)
            batch = stats.get("processed", 0)
            total_processed += batch
            print(f"  cleaner batch: {stats}", flush=True)
            if batch < 500:
                break
        print(f"\n[DONE] Raw new: {total_new} | Cleaned: {total_processed}", flush=True)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run())
