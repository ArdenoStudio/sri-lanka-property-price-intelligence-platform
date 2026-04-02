CREATE EXTENSION IF NOT EXISTS postgis;

-- Raw listings as scraped, before any cleaning
CREATE TABLE raw_listings (
    id              BIGSERIAL PRIMARY KEY,
    source          VARCHAR(20) NOT NULL,        -- 'ikman' | 'lpw' | 'facebook'
    source_id       VARCHAR(100) NOT NULL,        -- original listing ID on source platform
    scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    url             TEXT NOT NULL,
    title           TEXT,
    raw_price       TEXT,                         -- exactly as shown: "Rs. 4,500,000"
    raw_location    TEXT,                         -- exactly as shown: "Nugegoda, Colombo"
    raw_size        TEXT,                         -- exactly as shown: "12 perches"
    property_type   VARCHAR(30),                  -- 'land' | 'house' | 'apartment' | 'commercial'
    listing_type    VARCHAR(10),                  -- 'sale' | 'rent'
    description     TEXT,
    raw_json        JSONB,                        -- full raw scraped object
    is_processed    BOOLEAN DEFAULT FALSE,
    UNIQUE(source, source_id)
);

-- Cleaned, geocoded listings ready for analysis
CREATE TABLE listings (
    id              BIGSERIAL PRIMARY KEY,
    raw_id          BIGINT REFERENCES raw_listings(id),
    source          VARCHAR(20) NOT NULL,
    source_id       VARCHAR(100) NOT NULL,
    scraped_at      TIMESTAMPTZ NOT NULL,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Price (always stored in LKR)
    price_lkr       NUMERIC(15, 2),
    price_per_perch NUMERIC(15, 2),              -- for land listings
    price_per_sqft  NUMERIC(10, 2),              -- for houses/apartments

    -- Location
    raw_location    TEXT,
    district        VARCHAR(50),
    city            VARCHAR(100),
    gn_division     VARCHAR(100),                -- Grama Niladhari division
    lat             DECIMAL(9, 6),
    lng             DECIMAL(9, 6),
    geocode_confidence VARCHAR(10),              -- 'high' | 'medium' | 'low'

    -- Property details
    property_type   VARCHAR(30),
    listing_type    VARCHAR(10),
    size_perches    DECIMAL(10, 2),
    size_sqft       DECIMAL(10, 2),
    bedrooms        SMALLINT,
    bathrooms       SMALLINT,

    -- Quality flags
    is_outlier      BOOLEAN DEFAULT FALSE,
    outlier_reason  TEXT,
    is_duplicate    BOOLEAN DEFAULT FALSE,
    duplicate_of    BIGINT REFERENCES listings(id),

    UNIQUE(source, source_id)
);

-- Aggregated price stats per district per month (materialised weekly)
CREATE TABLE price_aggregates (
    id              BIGSERIAL PRIMARY KEY,
    district        VARCHAR(50) NOT NULL,
    property_type   VARCHAR(30) NOT NULL,
    period_year     SMALLINT NOT NULL,
    period_month    SMALLINT NOT NULL,
    median_price_lkr        NUMERIC(15, 2),
    median_price_per_perch  NUMERIC(15, 2),
    avg_price_lkr           NUMERIC(15, 2),
    p25_price_lkr           NUMERIC(15, 2),
    p75_price_lkr           NUMERIC(15, 2),
    listing_count   INTEGER,
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(district, property_type, period_year, period_month)
);

-- Scrape run log for monitoring
CREATE TABLE scrape_runs (
    id              BIGSERIAL PRIMARY KEY,
    source          VARCHAR(20) NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    finished_at     TIMESTAMPTZ,
    status          VARCHAR(10),                 -- 'running' | 'success' | 'failed'
    listings_found  INTEGER DEFAULT 0,
    listings_new    INTEGER DEFAULT 0,
    error_message   TEXT
);

-- Indexes
CREATE INDEX idx_listings_district ON listings(district);
CREATE INDEX idx_listings_scraped_at ON listings(scraped_at);
CREATE INDEX idx_listings_property_type ON listings(property_type);
CREATE INDEX idx_listings_price_lkr ON listings(price_lkr);
CREATE INDEX idx_raw_listings_is_processed ON raw_listings(is_processed);
CREATE INDEX idx_price_aggregates_district ON price_aggregates(district, period_year, period_month);
