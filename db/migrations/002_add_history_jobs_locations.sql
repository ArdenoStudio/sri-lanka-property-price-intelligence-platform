-- Listing snapshots for price/history tracking
CREATE TABLE IF NOT EXISTS listing_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    source          VARCHAR(20) NOT NULL,
    source_id       VARCHAR(100) NOT NULL,
    scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    url             TEXT,
    title           TEXT,
    raw_price       TEXT,
    raw_location    TEXT,
    raw_size        TEXT,
    property_type   VARCHAR(30),
    listing_type    VARCHAR(10),
    raw_json        JSONB,
    fingerprint     VARCHAR(40) NOT NULL,
    UNIQUE(source, source_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_listing_snapshots_source_source_id
    ON listing_snapshots(source, source_id);
CREATE INDEX IF NOT EXISTS idx_listing_snapshots_scraped_at
    ON listing_snapshots(scraped_at);
CREATE INDEX IF NOT EXISTS idx_listing_snapshots_fingerprint
    ON listing_snapshots(fingerprint);

-- Job run logs for non-scraper jobs
CREATE TABLE IF NOT EXISTS job_runs (
    id              BIGSERIAL PRIMARY KEY,
    job_name        VARCHAR(50) NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    status          VARCHAR(10),
    stats           JSONB,
    error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name_time
    ON job_runs(job_name, started_at);

-- Normalized location cache
CREATE TABLE IF NOT EXISTS locations (
    id              BIGSERIAL PRIMARY KEY,
    normalized_key  TEXT UNIQUE NOT NULL,
    district        VARCHAR(50),
    city            VARCHAR(100),
    gn_division     VARCHAR(100),
    lat             DECIMAL(9, 6),
    lng             DECIMAL(9, 6),
    confidence      VARCHAR(10),
    source          TEXT,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_normalized_key
    ON locations(normalized_key);

-- Link listings to locations
ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);
