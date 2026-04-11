"""
Backfill bedrooms and size from listing titles for existing rows
that are still missing those fields.

Run from project root:
    python -m scripts.backfill_from_titles

Uses single-query bulk UPDATE (VALUES list) — no executemany, no per-row
SELECT.  A fresh connection is opened for every fetch+update cycle so
Supabase idle-timeout can't kill a long-running transaction.
"""
import re
import time
import sys
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from db.connection import SessionLocal

BATCH = 150   # keep each tx well under 60 s


# ── parsers ──────────────────────────────────────────────────────────────────

def parse_bedrooms(title: str) -> int | None:
    t = (title or "").lower()
    m = re.search(r"(\d+)\s*(?:bed(?:room(?:ed)?)?s?|br\b|bhk)", t)
    if m:
        n = int(m.group(1))
        return n if 1 <= n <= 20 else None
    if "studio" in t:
        return 1
    return None


def parse_size(title: str, raw_size: str = "") -> tuple[float | None, float | None]:
    t = ((title or "") + " " + (raw_size or "")).lower()
    if "acre" in t:
        m = re.search(r"(\d+\.?\d*)\s*acre", t)
        if m:
            return float(m.group(1)) * 160.0, None
    m = re.search(r"([\d,]+\.?\d*)\s*(?:perch(?:es)?|p\b)", t)
    if m:
        return float(m.group(1).replace(",", "")), None
    m = re.search(r"([\d,]+\.?\d*)\s*(?:sq\.?\s*ft|sqft)", t)
    if m:
        return None, float(m.group(1).replace(",", ""))
    return None, None


# ── DB helpers ────────────────────────────────────────────────────────────────

def run_query(sql: str, params: dict | None = None) -> list:
    """Fresh connection, run one query, return rows, close."""
    for attempt in range(3):
        db = SessionLocal()
        try:
            result = db.execute(text(sql), params or {})
            rows = result.fetchall()
            db.commit()
            return rows
        except Exception as e:
            try: db.rollback()
            except Exception: pass
            if attempt < 2:
                print(f"  fetch retry {attempt+1}: {e}", flush=True)
                time.sleep(4)
            else:
                raise
        finally:
            try: db.close()
            except Exception: pass
    return []


def bulk_update(col: str, pairs: list[tuple[int, float]]) -> bool:
    """
    Single UPDATE using a VALUES list:
        UPDATE listings SET col = v.val
        FROM (VALUES (id,val), ...) AS v(id, val)
        WHERE listings.id = v.id
    """
    if not pairs:
        return True

    # Build VALUES string — cast id to int, val to numeric
    values_sql = ", ".join(f"({int(lid)}::int, {float(val)}::numeric)" for lid, val in pairs)
    sql = f"""
        UPDATE listings
        SET {col} = v.val
        FROM (VALUES {values_sql}) AS v(id, val)
        WHERE listings.id = v.id
    """
    for attempt in range(3):
        db = SessionLocal()
        try:
            db.execute(text(sql))
            db.commit()
            return True
        except Exception as e:
            try: db.rollback()
            except Exception: pass
            if attempt < 2:
                print(f"  update retry {attempt+1} ({col}): {e}", flush=True)
                time.sleep(4)
            else:
                print(f"  FAILED update ({col}): {e}", flush=True)
                return False
        finally:
            try: db.close()
            except Exception: pass
    return False


# ── main ──────────────────────────────────────────────────────────────────────

def run():
    beds_updated = size_updated = processed = 0
    offset = 0

    print("Starting backfill...", flush=True)

    while True:
        rows = run_query("""
            SELECT l.id, r.title, r.raw_size
            FROM listings l
            LEFT JOIN raw_listings r ON r.id = l.raw_id
            WHERE (l.bedrooms IS NULL OR (l.size_perches IS NULL AND l.size_sqft IS NULL))
              AND r.title IS NOT NULL
            ORDER BY l.id
            LIMIT :lim OFFSET :off
        """, {"lim": BATCH, "off": offset})

        if not rows:
            break

        bed_pairs:   list[tuple[int, float]] = []
        perch_pairs: list[tuple[int, float]] = []
        sqft_pairs:  list[tuple[int, float]] = []

        for lid, title, raw_size in rows:
            n = parse_bedrooms(title)
            if n:
                bed_pairs.append((lid, n))

            p, s = parse_size(title, raw_size or "")
            if p:
                perch_pairs.append((lid, p))
            elif s:
                sqft_pairs.append((lid, s))

        ok1 = bulk_update("bedrooms",    bed_pairs)
        ok2 = bulk_update("size_perches", perch_pairs)
        ok3 = bulk_update("size_sqft",   sqft_pairs)

        if ok1: beds_updated  += len(bed_pairs)
        if ok2 or ok3: size_updated += len(perch_pairs) + len(sqft_pairs)

        processed += len(rows)
        print(f"  {processed} rows done | beds: {beds_updated} | size: {size_updated}", flush=True)

        offset += BATCH
        time.sleep(0.2)

    print(f"\nDone.  Processed: {processed} | Bedrooms filled: {beds_updated} | Size filled: {size_updated}", flush=True)


if __name__ == "__main__":
    run()
