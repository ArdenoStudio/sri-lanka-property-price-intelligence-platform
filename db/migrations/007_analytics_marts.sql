-- Lean analytics marts as Postgres views over cleaned listings + aggregates.
-- No warehouse stack — query these for district benchmarks and source health.

CREATE OR REPLACE VIEW mart_district_benchmarks AS
SELECT DISTINCT ON (pa.district, pa.property_type, pa.bedroom_bucket)
    pa.district,
    pa.property_type,
    pa.bedroom_bucket,
    pa.period_year,
    pa.period_month,
    pa.median_price_lkr,
    pa.avg_price_lkr,
    pa.p25_price_lkr,
    pa.p75_price_lkr,
    pa.median_price_per_perch,
    pa.listing_count,
    pa.computed_at
FROM price_aggregates pa
WHERE pa.median_price_lkr IS NOT NULL
ORDER BY
    pa.district,
    pa.property_type,
    pa.bedroom_bucket NULLS FIRST,
    pa.period_year DESC,
    pa.period_month DESC;

CREATE OR REPLACE VIEW mart_property_type_trends AS
SELECT
    district,
    property_type,
    bedroom_bucket,
    period_year,
    period_month,
    median_price_lkr,
    avg_price_lkr,
    listing_count
FROM price_aggregates
WHERE bedroom_bucket IS NULL
ORDER BY district, property_type, period_year, period_month;

CREATE OR REPLACE VIEW mart_source_inventory AS
SELECT
    source,
    COUNT(*) AS listing_count,
    COUNT(*) FILTER (WHERE is_duplicate IS TRUE) AS duplicate_count,
    COUNT(*) FILTER (WHERE is_outlier IS TRUE) AS outlier_count,
    COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS geocoded_count,
    COUNT(*) FILTER (WHERE price_lkr IS NOT NULL) AS priced_count,
    MIN(first_seen_at) AS earliest_seen,
    MAX(last_seen_at) AS latest_seen
FROM listings
GROUP BY source;

CREATE OR REPLACE VIEW mart_deal_score_coverage AS
SELECT
    district,
    property_type,
    COUNT(*) AS listings,
    COUNT(deal_score) AS with_deal_score,
    ROUND(100.0 * COUNT(deal_score) / NULLIF(COUNT(*), 0), 2) AS deal_score_coverage_pct,
    ROUND(AVG(deal_score)::numeric, 1) AS avg_deal_score
FROM listings
WHERE is_outlier IS NOT TRUE
  AND is_duplicate IS NOT TRUE
GROUP BY district, property_type;
