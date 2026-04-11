"""
Backfill bedrooms and size from listing titles for existing rows
that are still missing those fields.

Run from project root:
    python -m scripts.backfill_from_titles
"""
import re
from db.connection import SessionLocal
from db.models import Listing, RawListing

BATCH = 500


def parse_bedrooms(title: str) -> int | None:
    text = (title or "").lower()
    m = re.search(r"(\d+)\s*(?:bed(?:room(?:ed)?)?s?|br\b|bhk)", text)
    if m:
        n = int(m.group(1))
        return n if 1 <= n <= 20 else None
    if "studio" in text:
        return 1
    return None


def parse_size(title: str, raw_size: str = "") -> tuple[float | None, float | None]:
    text = ((title or "") + " " + (raw_size or "")).lower()
    if "acre" in text:
        m = re.search(r"(\d+\.?\d*)\s*acre", text)
        if m:
            return float(m.group(1)) * 160.0, None
    m = re.search(r"(\d+\.?\d*)\s*(?:perch|perches|p\b)", text)
    if m:
        return float(m.group(1)), None
    if "sq ft" in text or "sqft" in text or "sq.ft" in text:
        m = re.search(r"(\d[\d,]*\.?\d*)\s*(?:sq\.?\s*ft|sqft)", text)
        if m:
            return None, float(m.group(1).replace(",", ""))
    return None, None


def run():
    db = SessionLocal()
    try:
        offset = 0
        beds_updated = size_updated = 0

        while True:
            rows = (
                db.query(Listing.id, Listing.bedrooms,
                         Listing.size_perches, Listing.size_sqft,
                         RawListing.title, RawListing.raw_size)
                .join(RawListing, Listing.raw_id == RawListing.id, isouter=True)
                .filter(
                    (Listing.bedrooms.is_(None)) |
                    (Listing.size_perches.is_(None) & Listing.size_sqft.is_(None))
                )
                .limit(BATCH)
                .offset(offset)
                .all()
            )
            if not rows:
                break

            for lid, beds, sp, ss, title, raw_size in rows:
                listing = db.get(Listing, lid)
                if listing is None:
                    continue
                changed = False

                if beds is None and title:
                    n = parse_bedrooms(title)
                    if n:
                        listing.bedrooms = n
                        beds_updated += 1
                        changed = True

                if sp is None and ss is None and title:
                    p, s = parse_size(title, raw_size or "")
                    if p:
                        listing.size_perches = p
                        size_updated += 1
                        changed = True
                    elif s:
                        listing.size_sqft = s
                        size_updated += 1
                        changed = True

                if changed:
                    db.add(listing)

            db.commit()
            offset += BATCH
            print(f"  processed {offset} rows | beds: {beds_updated} | size: {size_updated}")

        print(f"\nDone. Bedrooms filled: {beds_updated} | Size filled: {size_updated}")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
