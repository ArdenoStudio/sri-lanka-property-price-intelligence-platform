"""
One-off script: re-assign district for clean Listings where district IS NULL.
Runs the updated parse_location logic against existing raw_location + title data.
"""
import sys
sys.path.insert(0, '.')

from db.connection import SessionLocal
from db.models import Listing, RawListing
from scraper.cleaner import DataCleaner

def run():
    db = SessionLocal()
    cleaner = DataCleaner(db)

    # Load all listings missing district
    nulls = db.query(Listing).filter(Listing.district == None).all()
    print(f"Listings with NULL district: {len(nulls)}")

    fixed = 0
    batch = 0

    for listing in nulls:
        raw_location = listing.raw_location or ""
        title = ""
        # Try to get title from raw listing
        if listing.raw_id:
            raw = db.query(RawListing).filter(RawListing.id == listing.raw_id).first()
            if raw:
                title = raw.title or ""

        district, city, confidence = cleaner.parse_location(raw_location, title)

        if district:
            listing.district = district
            if not listing.city:
                listing.city = city
            listing.geocode_confidence = confidence
            fixed += 1

        batch += 1
        if batch % 1000 == 0:
            db.commit()
            print(f"  Processed {batch}/{len(nulls)}, fixed {fixed} so far...")

    db.commit()
    db.close()
    print(f"\nDone. Fixed {fixed} / {len(nulls)} NULL-district listings.")

if __name__ == "__main__":
    run()
