-- Flag short-term/vacation rentals so they can be excluded from price aggregations.
-- These listings (holiday villas, Airbnb-style stays) are priced per night or per day
-- but appear in the same feed as monthly rentals, skewing district medians upward.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_short_term BOOLEAN DEFAULT FALSE;

-- Sparse index — only short-term listings are a small minority
CREATE INDEX IF NOT EXISTS idx_listings_is_short_term ON listings (is_short_term) WHERE is_short_term = TRUE;
