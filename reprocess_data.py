from db.connection import SessionLocal
from db.models import RawListing, Listing
from scraper.cleaner import DataCleaner
import structlog

log = structlog.get_logger()

db = SessionLocal()
try:
    print("Resetting is_processed flag for ALL raw listings...")
    db.query(RawListing).update({RawListing.is_processed: False})
    print("Deleting all entries from listings table to avoid duplicates during re-processing...")
    db.query(Listing).delete()
    db.commit()
    
    print("Starting re-processing with improved DataCleaner...")
    cleaner = DataCleaner(db)
    stats = cleaner.process_all()
    print(f"RE-PROCESSING COMPLETE: {stats}")
finally:
    db.close()
