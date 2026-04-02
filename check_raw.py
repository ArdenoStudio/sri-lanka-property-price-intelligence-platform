from db.connection import SessionLocal
from db.models import RawListing
import json

db = SessionLocal()
try:
    results = db.query(RawListing.id, RawListing.raw_price, RawListing.raw_location).limit(20).all()
    out = []
    for r in results:
        out.append({"id": r[0], "raw_price": r[1], "raw_location": r[2]})
    print(json.dumps(out, indent=2))
finally:    
    db.close()
