from db.connection import SessionLocal
from db.models import RawListing, Listing
from scraper.cleaner import DataCleaner
import os

db = SessionLocal()
try:
    # Resetting 1000 at a time to be safe
    unprocessed = db.query(RawListing).filter(RawListing.is_processed == True).limit(1000).all()
    for raw in unprocessed:
        raw.is_processed = False
    
    # Clear existing listings to avoid FK issues during bulk delete
    db.query(Listing).delete()
    db.commit()
    
    cleaner = DataCleaner(db)
    stats = cleaner.process_all()
    print(f"CLEAN_STATS: {stats}")
finally:
    db.close()
