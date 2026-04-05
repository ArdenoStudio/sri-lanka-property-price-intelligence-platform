-- Migration 003: Add deal score, original price, and market median columns
-- These power the deal score badge, price drop detector, and compare-to-market feature

ALTER TABLE listings ADD COLUMN IF NOT EXISTS original_price_lkr  NUMERIC(15,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_score           NUMERIC(5,1);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS market_median_lkr   NUMERIC(15,2);

-- Backfill original_price_lkr for existing listings that have a price but no original yet
UPDATE listings
SET original_price_lkr = price_lkr
WHERE original_price_lkr IS NULL
  AND price_lkr IS NOT NULL;

-- Index for fast deal score queries
CREATE INDEX IF NOT EXISTS idx_listings_deal_score ON listings(deal_score);
