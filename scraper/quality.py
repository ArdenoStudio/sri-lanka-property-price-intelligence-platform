"""Lightweight data-quality checks for the PropertyLK listings warehouse.

These are intentional SQL/Python guards — not a full great-expectations suite.
Run via `python -m scraper.quality` or call `run_quality_checks(db)`.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

# Freshness SLA: hours since last successful scrape before we flag a source.
FRESHNESS_SLA_HOURS = {
    "ikman": 36,
    "lpw": 36,
    "onlineproperty": 72,
    "lamudi": 72,
}

# Soft outlier bands — align with cleaner.detect_outliers sale/rent floors.
SALE_PRICE_MIN = 500_000
SALE_PRICE_MAX = 2_000_000_000


@dataclass
class CheckResult:
    name: str
    status: str  # pass | warn | fail | info
    value: Any
    threshold: Any = None
    detail: Optional[str] = None


def run_quality_checks(db: Session) -> dict[str, Any]:
    """Execute freshness / null / outlier / duplicate checks against live tables."""
    now = datetime.now(timezone.utc)
    checks: list[CheckResult] = []

    inventory = db.execute(
        text(
            """
            SELECT
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE is_duplicate IS TRUE) AS duplicates,
              COUNT(*) FILTER (WHERE is_outlier IS TRUE) AS outliers,
              COUNT(*) FILTER (WHERE price_lkr IS NULL) AS null_price,
              COUNT(*) FILTER (
                WHERE size_perches IS NULL AND size_sqft IS NULL
              ) AS null_size,
              COUNT(*) FILTER (WHERE district IS NULL) AS null_district,
              COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) AS missing_geo
            FROM listings
            """
        )
    ).mappings().first()
    inv = dict(inventory or {})
    total = int(inv.get("total") or 0)

    def rate(n: int) -> Optional[float]:
        if total <= 0:
            return None
        return round(100.0 * n / total, 2)

    dup_rate = rate(int(inv.get("duplicates") or 0))
    checks.append(
        CheckResult(
            name="duplicate_rate_pct",
            status="warn" if (dup_rate or 0) > 15 else "pass",
            value=dup_rate,
            threshold=15,
            detail="Share of listings with is_duplicate=true (cross-source heuristic)",
        )
    )

    null_price = rate(int(inv.get("null_price") or 0))
    checks.append(
        CheckResult(
            name="null_price_pct",
            status="fail" if (null_price or 0) > 25 else ("warn" if (null_price or 0) > 10 else "pass"),
            value=null_price,
            threshold=10,
        )
    )

    null_size = rate(int(inv.get("null_size") or 0))
    checks.append(
        CheckResult(
            name="null_size_pct",
            status="warn" if (null_size or 0) > 40 else "pass",
            value=null_size,
            threshold=40,
            detail="Missing both size_perches and size_sqft",
        )
    )

    null_district = rate(int(inv.get("null_district") or 0))
    checks.append(
        CheckResult(
            name="null_district_pct",
            status="fail" if (null_district or 0) > 20 else ("warn" if (null_district or 0) > 5 else "pass"),
            value=null_district,
            threshold=5,
        )
    )

    missing_geo = rate(int(inv.get("missing_geo") or 0))
    checks.append(
        CheckResult(
            name="missing_geocode_pct",
            status="warn" if (missing_geo or 0) > 50 else "pass",
            value=missing_geo,
            threshold=50,
        )
    )

    outlier_rate = rate(int(inv.get("outliers") or 0))
    checks.append(
        CheckResult(
            name="outlier_rate_pct",
            status="warn" if (outlier_rate or 0) > 20 else "pass",
            value=outlier_rate,
            threshold=20,
        )
    )

    # Extreme sale prices still marked non-outlier (guard drift)
    extreme = db.execute(
        text(
            """
            SELECT COUNT(*) AS n
            FROM listings
            WHERE listing_type = 'sale'
              AND is_outlier IS NOT TRUE
              AND price_lkr IS NOT NULL
              AND (price_lkr < :lo OR price_lkr > :hi)
            """
        ),
        {"lo": SALE_PRICE_MIN, "hi": SALE_PRICE_MAX},
    ).mappings().first()
    extreme_n = int((extreme or {}).get("n") or 0)
    checks.append(
        CheckResult(
            name="unguarded_extreme_sale_prices",
            status="fail" if extreme_n > 0 else "pass",
            value=extreme_n,
            threshold=0,
            detail=f"Sale listings outside [{SALE_PRICE_MIN}, {SALE_PRICE_MAX}] without outlier flag",
        )
    )

    # Freshness SLA per source
    for source, sla_h in FRESHNESS_SLA_HOURS.items():
        row = db.execute(
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
        finished = row["finished_at"] if row else None
        if finished is None:
            checks.append(
                CheckResult(
                    name=f"freshness_{source}",
                    status="fail",
                    value=None,
                    threshold=sla_h,
                    detail="No successful scrape_runs row",
                )
            )
            continue
        if finished.tzinfo is None:
            finished = finished.replace(tzinfo=timezone.utc)
        age_h = (now - finished.astimezone(timezone.utc)).total_seconds() / 3600.0
        checks.append(
            CheckResult(
                name=f"freshness_{source}",
                status="fail" if age_h > sla_h else "pass",
                value=round(age_h, 1),
                threshold=sla_h,
                detail=f"Hours since last success (SLA {sla_h}h)",
            )
        )

    statuses = [c.status for c in checks]
    if "fail" in statuses:
        overall = "fail"
    elif "warn" in statuses:
        overall = "warn"
    else:
        overall = "pass"

    return {
        "generated_at": now.isoformat(),
        "overall": overall,
        "inventory_total": total,
        "checks": [asdict(c) for c in checks],
    }


def main() -> None:
    from db.connection import SessionLocal

    db = SessionLocal()
    try:
        report = run_quality_checks(db)
        import json

        print(json.dumps(report, indent=2, default=str))
        raise SystemExit(0 if report["overall"] != "fail" else 1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
