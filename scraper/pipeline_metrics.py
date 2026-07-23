"""Production pipeline metrics computed from Postgres — never invented.

Used by GET /pipeline/status and GET /pipeline/metrics.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from scraper.flags import flag_snapshot

# Sources we actively scrape (order is UI / status order).
KNOWN_SOURCES = ("ikman", "lpw", "onlineproperty", "lamudi")

SOURCE_LABELS = {
    "ikman": "ikman.lk",
    "lpw": "LankaPropertyWeb",
    "onlineproperty": "onlineproperty.lk",
    "lamudi": "house.lk",
}

JOB_DEFS = [
    {
        "name": "scrape_ikman",
        "label": "ikman.lk",
        "kind": "scrape",
        "source": "ikman",
        "expected_hours": 24,
        # Daily ingest uses api.ikman.lk (USE_IKMAN_SERP_API), not Playwright HTML.
        "ingest": "api",
    },
    {
        "name": "scrape_lpw",
        "label": "LankaPropertyWeb",
        "kind": "scrape",
        "source": "lpw",
        "expected_hours": 24,
        "ingest": "api",
    },
    {
        "name": "scrape_onlineproperty",
        "label": "onlineproperty.lk",
        "kind": "scrape",
        "source": "onlineproperty",
        "expected_hours": 48,
        "ingest": "html",
    },
    {
        "name": "scrape_lamudi",
        "label": "house.lk",
        "kind": "scrape",
        "source": "lamudi",
        "expected_hours": 48,
        "ingest": "html",
    },
    {"name": "clean_listings", "label": "Cleaner", "kind": "job", "expected_hours": 24},
    {"name": "geocode_listings", "label": "Geocoder", "kind": "job", "expected_hours": 24},
    {"name": "compute_aggregates", "label": "Aggregates", "kind": "job", "expected_hours": 168},
]


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _status_for(
    now: datetime,
    last_success: Optional[datetime],
    last_running: Optional[datetime],
    expected_hours: int,
) -> str:
    if last_running:
        if now - last_running <= timedelta(hours=expected_hours * 2):
            return "running"
    if last_success:
        if now - last_success <= timedelta(hours=int(expected_hours * 1.5)):
            return "ok"
    return "delayed"


def _pct(num: int, den: int) -> Optional[float]:
    if den <= 0:
        return None
    return round(100.0 * num / den, 2)


def listing_counts_by_source(db: Session) -> tuple[dict[str, int], str]:
    row_clean = db.execute(
        text("SELECT COUNT(*) AS n FROM listings")
    ).mappings().first()
    total_clean = int((row_clean or {}).get("n") or 0)

    if total_clean > 0:
        rows = db.execute(
            text("SELECT source, COUNT(*) AS n FROM listings GROUP BY source")
        ).mappings().all()
        return ({r["source"]: int(r["n"]) for r in rows if r["source"]}, "cleaned")

    rows = db.execute(
        text("SELECT source, COUNT(*) AS n FROM raw_listings GROUP BY source")
    ).mappings().all()
    return ({r["source"]: int(r["n"]) for r in rows if r["source"]}, "raw")


def inventory_freshness(db: Session, source: str) -> Optional[datetime]:
    """Latest touch for a source from listings / raw_listings.

    Used when API ingest didn't write scrape_runs (ikman SERP path historically).
    """
    row = db.execute(
        text(
            """
            SELECT GREATEST(
                (SELECT MAX(last_seen_at) FROM listings WHERE source = :source),
                (SELECT MAX(first_seen_at) FROM listings WHERE source = :source),
                (SELECT MAX(scraped_at) FROM raw_listings WHERE source = :source)
            ) AS ts
            """
        ),
        {"source": source},
    ).mappings().first()
    return _to_utc(row["ts"]) if row and row.get("ts") else None


def _newer(a: Optional[datetime], b: Optional[datetime]) -> Optional[datetime]:
    if a is None:
        return b
    if b is None:
        return a
    return a if a >= b else b


def build_pipeline_status(db: Session) -> dict[str, Any]:
    """Per-source / per-job freshness surface (dashboard + /pipeline/status)."""
    now = datetime.now(timezone.utc)
    listing_counts, listing_count_source = listing_counts_by_source(db)
    jobs: list[dict[str, Any]] = []

    for job in JOB_DEFS:
        if job["kind"] == "scrape":
            source = job["source"]
            last_success_run = db.execute(
                text(
                    """
                    SELECT finished_at, started_at, listings_found, listings_new, status
                    FROM scrape_runs
                    WHERE source = :source
                      AND (
                        status = 'success'
                        OR (status IS NULL AND finished_at IS NOT NULL)
                      )
                    ORDER BY finished_at DESC NULLS LAST
                    LIMIT 1
                    """
                ),
                {"source": source},
            ).mappings().first()
            last_run = db.execute(
                text(
                    """
                    SELECT started_at, finished_at, listings_found, listings_new, status
                    FROM scrape_runs
                    WHERE source = :source
                    ORDER BY started_at DESC
                    LIMIT 1
                    """
                ),
                {"source": source},
            ).mappings().first()
            last_running = db.execute(
                text(
                    """
                    SELECT started_at
                    FROM scrape_runs
                    WHERE source = :source AND status = 'running'
                    ORDER BY started_at DESC
                    LIMIT 1
                    """
                ),
                {"source": source},
            ).mappings().first()
            inv_fresh = inventory_freshness(db, source)
        else:
            inv_fresh = None
            name = job["name"]
            last_success_run = db.execute(
                text(
                    """
                    SELECT finished_at, started_at, status, stats
                    FROM job_runs
                    WHERE job_name = :name AND status = 'success'
                    ORDER BY finished_at DESC NULLS LAST
                    LIMIT 1
                    """
                ),
                {"name": name},
            ).mappings().first()
            last_run = db.execute(
                text(
                    """
                    SELECT started_at, finished_at, status, stats
                    FROM job_runs
                    WHERE job_name = :name
                    ORDER BY started_at DESC
                    LIMIT 1
                    """
                ),
                {"name": name},
            ).mappings().first()
            last_running = db.execute(
                text(
                    """
                    SELECT started_at
                    FROM job_runs
                    WHERE job_name = :name AND status = 'running'
                    ORDER BY started_at DESC
                    LIMIT 1
                    """
                ),
                {"name": name},
            ).mappings().first()

        last_success = _to_utc(last_success_run["finished_at"]) if last_success_run else None
        last_started = _to_utc(last_run["started_at"]) if last_run else None
        running_started = _to_utc(last_running["started_at"]) if last_running else None
        freshness_source = "scrape_runs"
        if job["kind"] == "scrape":
            # Prefer inventory touch for API ingest when scrape_runs lag (ikman).
            merged_success = _newer(last_success, inv_fresh)
            if inv_fresh and (last_success is None or inv_fresh > last_success):
                freshness_source = "inventory"
            last_success = merged_success
            last_started = _newer(last_started, inv_fresh)
        status = _status_for(now, last_success, running_started, job["expected_hours"])

        payload: dict[str, Any] = {
            "name": job["name"],
            "label": job["label"],
            "kind": job["kind"],
            "status": status,
            "last_success": last_success.isoformat() if last_success else None,
            "last_run": last_started.isoformat() if last_started else None,
            "expected_hours": job["expected_hours"],
        }
        if job["kind"] == "scrape":
            payload.update(
                {
                    "source": job["source"],
                    "ingest": job.get("ingest", "html"),
                    "freshness_source": freshness_source,
                    "last_probe": last_started.isoformat() if last_started else None,
                    "listing_count": listing_counts.get(job["source"], 0),
                    "listing_count_source": listing_count_source,
                    "last_found_count": int(last_run["listings_found"] or 0) if last_run else 0,
                    "last_new_count": int(last_run["listings_new"] or 0) if last_run else 0,
                }
            )
        jobs.append(payload)

    overall = "ok"
    if any(j["status"] == "delayed" for j in jobs):
        overall = "delayed"
    elif any(j["status"] == "running" for j in jobs):
        overall = "running"

    return {
        "generated_at": now.isoformat(),
        "overall_status": overall,
        "jobs": jobs,
    }


def compute_pipeline_metrics(db: Session, scrape_window: int = 30) -> dict[str, Any]:
    """Aggregate health metrics for README / ops. All values from SQL."""
    now = datetime.now(timezone.utc)

    counts = db.execute(
        text(
            """
            SELECT
              (SELECT COUNT(*) FROM raw_listings) AS raw_listings,
              (SELECT COUNT(*) FROM listings) AS canonical_listings,
              (SELECT COUNT(*) FROM listings WHERE is_duplicate IS TRUE) AS duplicate_listings,
              (SELECT COUNT(*) FROM listings WHERE is_outlier IS TRUE) AS outlier_listings,
              (SELECT COUNT(*) FROM listings WHERE lat IS NOT NULL AND lng IS NOT NULL) AS geocoded_listings,
              (SELECT COUNT(*) FROM listings
                 WHERE geocode_confidence = 'high') AS geocode_high,
              (SELECT COUNT(*) FROM listings
                 WHERE geocode_confidence = 'medium') AS geocode_medium,
              (SELECT COUNT(*) FROM listings
                 WHERE geocode_confidence = 'low') AS geocode_low,
              (SELECT COUNT(*) FROM listings WHERE price_lkr IS NULL) AS null_price,
              (SELECT COUNT(*) FROM listings
                 WHERE size_perches IS NULL AND size_sqft IS NULL) AS null_size,
              (SELECT COUNT(*) FROM listings WHERE district IS NULL) AS null_district,
              (SELECT COUNT(DISTINCT source) FROM listings) AS sources_in_listings,
              (SELECT COUNT(DISTINCT source) FROM scrape_runs
                 WHERE finished_at > NOW() - INTERVAL '14 days') AS sources_active_14d
            """
        )
    ).mappings().first()
    c = dict(counts or {})

    raw_n = int(c.get("raw_listings") or 0)
    clean_n = int(c.get("canonical_listings") or 0)
    dup_n = int(c.get("duplicate_listings") or 0)
    geo_n = int(c.get("geocoded_listings") or 0)

    by_source_rows = db.execute(
        text(
            """
            SELECT source, COUNT(*) AS n
            FROM listings
            GROUP BY source
            ORDER BY n DESC
            """
        )
    ).mappings().all()
    listings_by_source = {r["source"]: int(r["n"]) for r in by_source_rows}

    # Last success + scrape success rate per source (last N runs)
    per_source: list[dict[str, Any]] = []
    for source in KNOWN_SOURCES:
        runs = db.execute(
            text(
                """
                SELECT status, started_at, finished_at, listings_found, listings_new,
                       error_message,
                       EXTRACT(EPOCH FROM (finished_at - started_at)) AS duration_s
                FROM scrape_runs
                WHERE source = :source
                ORDER BY started_at DESC
                LIMIT :lim
                """
            ),
            {"source": source, "lim": scrape_window},
        ).mappings().all()

        success_n = 0
        failed_n = 0
        durations: list[float] = []
        for r in runs:
            st = (r["status"] or "").lower()
            finished = r["finished_at"] is not None
            if st == "success" or (st in ("", "none") and finished and not r["error_message"]):
                success_n += 1
            elif st == "failed" or r["error_message"]:
                failed_n += 1
            if r["duration_s"] is not None:
                try:
                    durations.append(float(r["duration_s"]))
                except (TypeError, ValueError):
                    pass

        last_success = db.execute(
            text(
                """
                SELECT finished_at
                FROM scrape_runs
                WHERE source = :source
                  AND (
                    status = 'success'
                    OR (status IS NULL AND finished_at IS NOT NULL AND error_message IS NULL)
                  )
                ORDER BY finished_at DESC NULLS LAST
                LIMIT 1
                """
            ),
            {"source": source},
        ).mappings().first()

        last_success_at = _to_utc(last_success["finished_at"]) if last_success else None
        inv_fresh = inventory_freshness(db, source)
        last_success_at = _newer(last_success_at, inv_fresh)
        judged = success_n + failed_n
        median_runtime_s = None
        if durations:
            durations_sorted = sorted(durations)
            mid = len(durations_sorted) // 2
            if len(durations_sorted) % 2:
                median_runtime_s = round(durations_sorted[mid], 1)
            else:
                median_runtime_s = round(
                    (durations_sorted[mid - 1] + durations_sorted[mid]) / 2.0, 1
                )

        per_source.append(
            {
                "source": source,
                "label": SOURCE_LABELS.get(source, source),
                "listings": listings_by_source.get(source, 0),
                "last_success_at": last_success_at.isoformat() if last_success_at else None,
                "ingest": next(
                    (j.get("ingest", "html") for j in JOB_DEFS if j.get("source") == source),
                    "html",
                ),
                "scrape_runs_sampled": len(runs),
                "scrape_success_count": success_n,
                "scrape_failed_count": failed_n,
                "scrape_success_rate_pct": _pct(success_n, judged),
                "median_runtime_seconds": median_runtime_s,
                "last_runtime_seconds": round(durations[0], 1) if durations else None,
            }
        )

    # Downstream job runtimes (last successful clean → geo → agg chain proxy)
    job_runtime = db.execute(
        text(
            """
            SELECT job_name,
                   EXTRACT(EPOCH FROM (finished_at - started_at)) AS duration_s,
                   finished_at
            FROM job_runs
            WHERE status = 'success'
              AND finished_at IS NOT NULL
              AND started_at IS NOT NULL
              AND job_name IN ('clean_listings', 'geocode_listings', 'compute_aggregates')
            ORDER BY finished_at DESC
            LIMIT 30
            """
        )
    ).mappings().all()

    job_durations: dict[str, list[float]] = {}
    last_job_finished: dict[str, Optional[datetime]] = {}
    for r in job_runtime:
        name = r["job_name"]
        if r["duration_s"] is not None:
            job_durations.setdefault(name, []).append(float(r["duration_s"]))
        if name not in last_job_finished:
            last_job_finished[name] = _to_utc(r["finished_at"])

    def _median(vals: list[float]) -> Optional[float]:
        if not vals:
            return None
        s = sorted(vals)
        m = len(s) // 2
        if len(s) % 2:
            return round(s[m], 1)
        return round((s[m - 1] + s[m]) / 2.0, 1)

    pipeline_jobs = {
        name: {
            "last_success_at": last_job_finished.get(name).isoformat()
            if last_job_finished.get(name)
            else None,
            "median_runtime_seconds": _median(job_durations.get(name, [])),
            "samples": len(job_durations.get(name, [])),
        }
        for name in ("clean_listings", "geocode_listings", "compute_aggregates")
    }

    return {
        "generated_at": now.isoformat(),
        "inventory": {
            "raw_listings": raw_n,
            "canonical_listings": clean_n,
            "canonical_note": (
                "listings rows after clean/upsert on (source, source_id); "
                "cross-source duplicates flagged via is_duplicate"
            ),
            "duplicate_listings": dup_n,
            "duplicate_rate_pct": _pct(dup_n, clean_n),
            "outlier_listings": int(c.get("outlier_listings") or 0),
            "sources_in_listings": int(c.get("sources_in_listings") or 0),
            "sources_active_14d": int(c.get("sources_active_14d") or 0),
            "listings_by_source": listings_by_source,
        },
        "geocode": {
            "with_coordinates": geo_n,
            "success_rate_pct": _pct(geo_n, clean_n),
            "confidence_high": int(c.get("geocode_high") or 0),
            "confidence_medium": int(c.get("geocode_medium") or 0),
            "confidence_low": int(c.get("geocode_low") or 0),
            "note": (
                "success = lat/lng present; confidence set by cleaner (district parse) "
                "or source API coords (high) or Nominatim failure (low on locations)"
            ),
        },
        "null_rates": {
            "price_null_pct": _pct(int(c.get("null_price") or 0), clean_n),
            "size_null_pct": _pct(int(c.get("null_size") or 0), clean_n),
            "district_null_pct": _pct(int(c.get("null_district") or 0), clean_n),
        },
        "sources": per_source,
        "downstream_jobs": pipeline_jobs,
        "scrape_window": scrape_window,
        "flags": flag_snapshot(),
    }
