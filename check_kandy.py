from db.connection import SessionLocal
from db.models import Listing
import json

db = SessionLocal()
try:
    listings = db.query(Listing).filter(Listing.district == "Kandy").limit(5).all()
    out = []
    for l in listings:
        out.append({
            "id": l.id,
            "raw_id": l.raw_id,
            "price_lkr": float(l.price_lkr) if l.price_lkr else None,
            "property_type": l.property_type,
            "raw_location": l.raw_location
        })
    print(json.dumps(out, indent=2))
finally:    
    db.close()
