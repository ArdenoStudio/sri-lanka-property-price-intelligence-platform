"""
1. Apply migration 005 (adds is_short_term column to listings).
2. Backfill the flag for any existing listings that match short-term signals
   detected in raw_price, title, or description.

Run from project root:
    python -m scripts.backfill_short_term
"""
import time
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from db.connection import SessionLocal


def run_sql(sql: str, params: dict | None = None) -> int:
    """Run a single statement, return rowcount. Retries up to 3 times."""
    for attempt in range(3):
        db = SessionLocal()
        try:
            result = db.execute(text(sql), params or {})
            db.commit()
            return result.rowcount if result.rowcount is not None else 0
        except Exception as e:
            try: db.rollback()
            except Exception: pass
            if attempt < 2:
                print(f"  retry {attempt + 1}: {e}", flush=True)
                time.sleep(4)
            else:
                raise
        finally:
            try: db.close()
            except Exception: pass
    return 0


def run():
    # ── Step 1: apply migration ───────────────────────────────────────────────
    print("Applying migration 005 (is_short_term column)...", flush=True)
    run_sql("ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_short_term BOOLEAN DEFAULT FALSE")
    run_sql(
        "CREATE INDEX IF NOT EXISTS idx_listings_is_short_term "
        "ON listings (is_short_term) WHERE is_short_term = TRUE"
    )
    print("  Migration applied.", flush=True)

    # ── Step 2: bulk UPDATE via PostgreSQL pattern matching ───────────────────
    print("Backfilling is_short_term flag on existing listings...", flush=True)

    flagged = run_sql("""
        UPDATE listings l
        SET is_short_term = TRUE
        FROM raw_listings r
        WHERE l.raw_id = r.id
          AND l.is_short_term = FALSE
          AND (
            r.raw_price ILIKE '%per night%'   OR r.raw_price ILIKE '%per day%'
            OR r.raw_price ILIKE '%/night%'   OR r.raw_price ILIKE '%/day%'
            OR r.raw_price ILIKE '%nightly%'  OR r.raw_price ILIKE '%daily rate%'
            OR r.title    ILIKE '%holiday home%'      OR r.title ILIKE '%holiday villa%'
            OR r.title    ILIKE '%holiday bungalow%'  OR r.title ILIKE '%holiday cabin%'
            OR r.title    ILIKE '%vacation home%'     OR r.title ILIKE '%vacation villa%'
            OR r.title    ILIKE '%vacation rental%'
            OR r.title    ILIKE '%short stay%'        OR r.title ILIKE '%short-stay%'
            OR r.title    ILIKE '%short term rental%' OR r.title ILIKE '%short-term rental%'
            OR r.title    ILIKE '%airbnb%'
            OR r.title    ILIKE '%per night%'         OR r.title ILIKE '%per day%'
            OR r.title    ILIKE '%nightly%'
            OR r.description ILIKE '%per night%'      OR r.description ILIKE '%per day%'
            OR r.description ILIKE '%nightly%'        OR r.description ILIKE '%holiday villa%'
            OR r.description ILIKE '%vacation rental%' OR r.description ILIKE '%short stay%'
            OR r.description ILIKE '%airbnb%'
          )
    """)

    print(f"\nDone.  Listings flagged as short-term: {flagged}", flush=True)


if __name__ == "__main__":
    run()
