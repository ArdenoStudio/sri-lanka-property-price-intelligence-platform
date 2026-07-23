-- Split price_aggregates and deal scores by listing_type (sale vs rent).
-- Legacy rows mixed both markets and produced fake +100 deal scores on rents.

ALTER TABLE price_aggregates
    ADD COLUMN IF NOT EXISTS listing_type VARCHAR(10);

-- Wipe mixed medians; next PriceAggregator.aggregate() rebuilds typed rows.
DELETE FROM price_aggregates;

-- Clear untrustworthy scores until recomputed against sale/rent peers.
-- Only rewrite rows that still have a score (full-table NULL times out on large DBs).
UPDATE listings
SET deal_score = NULL,
    market_median_lkr = NULL
WHERE deal_score IS NOT NULL
   OR market_median_lkr IS NOT NULL;

DROP INDEX IF EXISTS idx_price_aggregates_broad;
DROP INDEX IF EXISTS idx_price_aggregates_bucketed;

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_aggregates_broad
    ON price_aggregates (district, property_type, listing_type, period_year, period_month)
    WHERE bedroom_bucket IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_aggregates_bucketed
    ON price_aggregates (district, property_type, listing_type, bedroom_bucket, period_year, period_month)
    WHERE bedroom_bucket IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_price_aggregates_listing_type
    ON price_aggregates (listing_type);

-- Marts include listing_type so benchmarks never mix sale/rent.
CREATE OR REPLACE VIEW mart_district_benchmarks AS
SELECT DISTINCT ON (pa.district, pa.property_type, pa.listing_type, pa.bedroom_bucket)
    pa.district,
    pa.property_type,
    pa.listing_type,
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
  AND pa.listing_type IN ('sale', 'rent')
ORDER BY
    pa.district,
    pa.property_type,
    pa.listing_type,
    pa.bedroom_bucket NULLS FIRST,
    pa.period_year DESC,
    pa.period_month DESC;

CREATE OR REPLACE VIEW mart_property_type_trends AS
SELECT
    district,
    property_type,
    listing_type,
    bedroom_bucket,
    period_year,
    period_month,
    median_price_lkr,
    avg_price_lkr,
    listing_count
FROM price_aggregates
WHERE bedroom_bucket IS NULL
  AND listing_type IN ('sale', 'rent')
ORDER BY district, property_type, listing_type, period_year, period_month;

CREATE OR REPLACE VIEW mart_deal_score_coverage AS
SELECT
    district,
    property_type,
    listing_type,
    COUNT(*) AS listings,
    COUNT(deal_score) AS with_deal_score,
    ROUND(100.0 * COUNT(deal_score) / NULLIF(COUNT(*), 0), 2) AS deal_score_coverage_pct,
    ROUND(AVG(deal_score)::numeric, 1) AS avg_deal_score
FROM listings
WHERE is_outlier IS NOT TRUE
  AND is_duplicate IS NOT TRUE
GROUP BY district, property_type, listing_type;
