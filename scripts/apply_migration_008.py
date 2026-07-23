"""Apply migration 008 (listing_type on price_aggregates) if needed.

Idempotent: skips when listing_type column already exists.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / ".env")
sys.path.insert(0, str(root))

from sqlalchemy import text
from db.connection import SessionLocal, engine

STEPS = [
    "ALTER TABLE price_aggregates ADD COLUMN IF NOT EXISTS listing_type VARCHAR(10)",
    "DELETE FROM price_aggregates",
    """
    UPDATE listings
    SET deal_score = NULL, market_median_lkr = NULL
    WHERE deal_score IS NOT NULL OR market_median_lkr IS NOT NULL
    """,
    "DROP INDEX IF EXISTS idx_price_aggregates_broad",
    "DROP INDEX IF EXISTS idx_price_aggregates_bucketed",
    """
    CREATE UNIQUE INDEX IF NOT EXISTS idx_price_aggregates_broad
        ON price_aggregates (district, property_type, listing_type, period_year, period_month)
        WHERE bedroom_bucket IS NULL
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS idx_price_aggregates_bucketed
        ON price_aggregates (district, property_type, listing_type, bedroom_bucket,
                             period_year, period_month)
        WHERE bedroom_bucket IS NOT NULL
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_price_aggregates_listing_type
        ON price_aggregates (listing_type)
    """,
]


def _has_listing_type(conn) -> bool:
    row = conn.execute(text("""
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'price_aggregates'
          AND column_name = 'listing_type'
        LIMIT 1
    """)).fetchone()
    return row is not None


def _apply_views(conn) -> None:
    sql = (root / "db/migrations/008_listing_type_aggregates.sql").read_text()
    for stmt in sql.split(";"):
        s = stmt.strip()
        if s.upper().startswith("CREATE OR REPLACE VIEW"):
            preview = " ".join(s.split())[:110]
            print(f"  [view] {preview}", flush=True)
            conn.execute(text(s))


def run() -> None:
    import time

    last_err: Exception | None = None
    for attempt in range(1, 6):
        try:
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                conn.execute(text("SET statement_timeout = '15min'"))
                if _has_listing_type(conn):
                    print("Migration 008 already applied (listing_type present). Skipping.", flush=True)
                    return

                print(f"Applying migration 008 ({len(STEPS)} steps + views)...", flush=True)
                for i, stmt in enumerate(STEPS, 1):
                    preview = " ".join(stmt.split())[:110]
                    print(f"  [{i}/{len(STEPS)}] {preview}", flush=True)
                    conn.execute(text(stmt))
                _apply_views(conn)
            break
        except Exception as e:
            last_err = e
            wait = min(30, 4 * attempt)
            print(f"  connect/apply attempt {attempt} failed: {e}; retry in {wait}s", flush=True)
            time.sleep(wait)
    else:
        raise last_err  # type: ignore[misc]

    db = SessionLocal()
    try:
        agg_n = db.execute(text("SELECT COUNT(*) FROM price_aggregates")).scalar()
        scored = db.execute(text(
            "SELECT COUNT(*) FROM listings WHERE deal_score IS NOT NULL"
        )).scalar()
        print(f"Done. price_aggregates={agg_n}; listings_with_deal_score={scored}", flush=True)
    finally:
        db.close()


if __name__ == "__main__":
    if not os.getenv("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is not set")
    run()
