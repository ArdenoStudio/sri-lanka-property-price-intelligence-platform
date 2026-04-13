-- Add bedroom_bucket column to price_aggregates for comparable-based deal scoring.
-- bedroom_bucket is NULL for broad (all-bedroom) aggregates, or '1','2','3','4','5+' for bucketed.

ALTER TABLE price_aggregates ADD COLUMN IF NOT EXISTS bedroom_bucket VARCHAR(5);

-- Replace the existing broad unique index with a partial one (only applies where bedroom_bucket IS NULL)
DROP INDEX IF EXISTS idx_price_aggregates_main;
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_aggregates_broad
    ON price_aggregates (district, property_type, period_year, period_month)
    WHERE bedroom_bucket IS NULL;

-- New partial unique index for bucketed rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_aggregates_bucketed
    ON price_aggregates (district, property_type, bedroom_bucket, period_year, period_month)
    WHERE bedroom_bucket IS NOT NULL;
