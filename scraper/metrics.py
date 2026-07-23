"""Lightweight scrape/cutover telemetry helpers.

For production inventory / freshness / duplicate rates, prefer
`scraper.pipeline_metrics.compute_pipeline_metrics` (GET /pipeline/metrics).
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from scraper.flags import flag_snapshot


def fill_rate_snapshot(db: Session) -> dict:
    """Return bedroom/size/geo fill rates for recent non-outlier listings."""
    row = db.execute(
        text(
            """
            SELECT
              COUNT(*) AS total,
              COUNT(bedrooms) FILTER (
                WHERE property_type IN ('house', 'apartment')
              ) AS beds_present,
              COUNT(*) FILTER (
                WHERE property_type IN ('house', 'apartment')
              ) AS beds_eligible,
              COUNT(*) FILTER (
                WHERE size_perches IS NOT NULL OR size_sqft IS NOT NULL
              ) AS size_present,
              COUNT(lat) AS geo_present,
              COUNT(*) FILTER (
                WHERE source = 'lpw' AND lat IS NOT NULL
              ) AS lpw_geo,
              COUNT(*) FILTER (WHERE source = 'lpw') AS lpw_total,
              COUNT(*) FILTER (
                WHERE source = 'ikman' AND source_id ~ '^[0-9a-f]{24}$'
              ) AS ikman_hex_ids,
              COUNT(*) FILTER (WHERE source = 'ikman') AS ikman_total
            FROM listings
            WHERE is_outlier IS NOT TRUE
              AND scraped_at > NOW() - INTERVAL '30 days'
            """
        )
    ).mappings().first()
    data = dict(row or {})
    data["flags"] = flag_snapshot()
    return data
