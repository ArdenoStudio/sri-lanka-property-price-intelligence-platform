"""
One-off backfill: reclassify listings/raw_listings where title contains
bungalow/villa/cottage/annexe/annex/townhouse/holiday home but
property_type was incorrectly set to 'land'.
"""
from db.connection import SessionLocal
from sqlalchemy import text

KEYWORDS = ['%bungalow%', '%villa%', '%cottage%', '%annexe%', '%annex%', '%townhouse%', '%holiday home%']


def build_ilike_clause(col: str) -> str:
    return " OR ".join(f"{col} ILIKE :{f'k{i}'}" for i, _ in enumerate(KEYWORDS))


def make_params() -> dict:
    return {f"k{i}": kw for i, kw in enumerate(KEYWORDS)}


def run():
    db = SessionLocal()
    try:
        clause = build_ilike_clause("title")
        params = make_params()

        # ── listings ────────────────────────────────────────────────────────
        result = db.execute(
            text(f"""
                UPDATE listings
                SET property_type = 'house'
                WHERE property_type = 'land'
                  AND ({clause})
            """),
            params,
        )
        listings_updated = result.rowcount
        print(f"listings      → {listings_updated} row(s) updated")

        # ── raw_listings ─────────────────────────────────────────────────────
        result = db.execute(
            text(f"""
                UPDATE raw_listings
                SET property_type = 'house'
                WHERE property_type = 'land'
                  AND ({clause})
            """),
            params,
        )
        raw_updated = result.rowcount
        print(f"raw_listings  → {raw_updated} row(s) updated")

        db.commit()
        print(f"\nDone. Total: {listings_updated + raw_updated} row(s) fixed.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
