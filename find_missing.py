districts_25 = ["Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar", "Matale", "Matara", "Moneragala", "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"]
from db.connection import SessionLocal
from db.models import Listing
from sqlalchemy import func
db = SessionLocal()
try:
    seen = [r[0] for r in db.query(Listing.district).filter(Listing.district.isnot(None)).distinct().all()]
    missing = [d for d in districts_25 if d not in seen]
    print(f"MISSING: {missing}")
finally:
    db.close()
