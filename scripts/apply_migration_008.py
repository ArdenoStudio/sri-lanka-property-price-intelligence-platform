"""Apply migration 008 (listing_type on price_aggregates) then exit.

Safe to re-run: uses IF NOT EXISTS / IF EXISTS where possible.
Deletes mixed aggregates and clears deal scores so the next aggregate
rebuilds sale/rent-separated medians.
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


def _statements(sql: str) -> list[str]:
    parts: list[str] = []
    buf: list[str] = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        buf.append(line)
        if stripped.endswith(";"):
            stmt = "\n".join(buf).strip().rstrip(";").strip()
            if stmt:
                parts.append(stmt)
            buf = []
    tail = "\n".join(buf).strip()
    if tail:
        parts.append(tail)
    return parts


def run() -> None:
    sql_path = root / "db" / "migrations" / "008_listing_type_aggregates.sql"
    sql = sql_path.read_text()
    stmts = _statements(sql)
    print(f"Applying {sql_path.name} ({len(stmts)} statements)...", flush=True)

    # Migration can rewrite indexes/views; allow longer than default 60s.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text("SET statement_timeout = '10min'"))
        for i, stmt in enumerate(stmts, 1):
            preview = " ".join(stmt.split())[:100]
            print(f"  [{i}/{len(stmts)}] {preview}", flush=True)
            conn.execute(text(stmt))

    db = SessionLocal()
    try:
        cols = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'price_aggregates' AND column_name = 'listing_type'
        """)).fetchall()
        agg_n = db.execute(text("SELECT COUNT(*) FROM price_aggregates")).scalar()
        scored = db.execute(text("SELECT COUNT(*) FROM listings WHERE deal_score IS NOT NULL")).scalar()
        print(
            f"Done. listing_type column={'yes' if cols else 'NO'}; "
            f"price_aggregates={agg_n}; listings_with_deal_score={scored}",
            flush=True,
        )
    finally:
        db.close()


if __name__ == "__main__":
    if not os.getenv("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is not set")
    run()
