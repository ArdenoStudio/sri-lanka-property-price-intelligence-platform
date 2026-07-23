-- Enrich scrape_runs with failure counts + structured stats JSON.
-- Duration is derived as finished_at - started_at (no separate column).

ALTER TABLE scrape_runs
    ADD COLUMN IF NOT EXISTS listings_failed INTEGER DEFAULT 0;

ALTER TABLE scrape_runs
    ADD COLUMN IF NOT EXISTS stats JSONB;

COMMENT ON COLUMN scrape_runs.listings_failed IS
    'Rows that failed parse/upsert during the run (best-effort; older runs may be 0/NULL).';
COMMENT ON COLUMN scrape_runs.stats IS
    'Optional structured counters: transport, captcha_*, field fill, pages_scanned, etc.';
