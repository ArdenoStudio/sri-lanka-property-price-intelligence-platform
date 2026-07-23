# Runbook

Operational playbook for PropertyLK ingestion and freshness.

## Quick health

```bash
# Live API (Lambda Function URL — see vercel.json VITE_API_URL)
curl -s "$API/health" | jq .
curl -s "$API/pipeline/status" | jq .
curl -s "$API/pipeline/metrics" | jq .
curl -s "$API/pipeline/quality" | jq .
```

Dashboard strip reads `/public/pipeline` (same payload as `/pipeline/status`).

## Source HTML / API changed

**Symptoms:** scrape success rate drops; `listings_found=0`; mapping tests fail; probe script errors.

**Actions:**

1. Run `python scripts/probe_source_apis.py` and check `docs/source-apis/*/`.
2. Compare fixtures under `docs/source-apis/*/samples/` and `tests/fixtures/`.
3. Prefer API cutover flags in `.env` (`USE_IKMAN_SERP_API`, `USE_LPW_API`, …) over brittle HTML.
4. Update mapping in `scraper/*_api.py` + add a fixture test before redeploying scrapers.
5. Checklist: `tests/API_SCRAPER_CUTOVER_CHECKLIST.md`.

## Geocoder rate-limited / Nominatim failures

**Symptoms:** `job_runs` geocode stats show high `failures`; `missing_geocode_pct` rises in `/pipeline/quality`.

**Actions:**

1. Confirm `NOMINATIM_USER_AGENT` is set to a contactable UA (`.env.example`).
2. Prefer source-provided coordinates (LPW API / ikman detail) — cleaner short-circuits Nominatim when lat/lng present.
3. Re-run `python run_geocode.py` in small batches; respect ≥1 req/s (`RateLimiter` in `scraper/geocoder.py`).
4. Failed locations get `confidence='low'` and are skipped on subsequent passes — fix city/district strings via cleaner, then clear low confidence if retrying.

## Scrape failed partially

**Symptoms:** `scrape_runs.status=failed` or success with unusually low `listings_new`; `/pipeline/status` shows `delayed` for one source.

**Actions:**

1. Inspect latest `scrape_runs` / workflow logs for that source.
2. Re-run source catchup (`_ikman_catchup_runner.py`, `_lpw_catchup_runner.py`, `_houseLk_catchup_runner.py`) or the matching GHA workflow.
3. Raw upserts are idempotent on `(source, source_id)` — safe to re-scrape.
4. Then process: `python run_clean.py && python run_geocode.py && python run_aggregate.py` (or `_process_runner.py`).

## Backfill / reprocess

| Goal | Command |
|---|---|
| Clean unprocessed raw only | `python run_clean.py` |
| Full clean reprocess (destructive to `listings`) | `python reprocess_data.py` — resets `is_processed`, deletes `listings`, re-cleans |
| Geocode missing coords | `python run_geocode.py` |
| Recompute marts + deal scores | `python run_aggregate.py` |
| Trends from snapshots | `python backfill_trends.py` |
| Title → bedroom/size backfill | `scripts/backfill_from_titles.py` |
| Short-term flags | `scripts/backfill_short_term.py` |

Admin API (requires `x-admin-key`): `POST /trigger/process`, `POST /trigger/aggregate`.

## Verify freshness

1. `/pipeline/status` → each scrape source `last_success` within SLA (see quality module).
2. `/pipeline/metrics` → `scrape_success_rate_pct` per source; geocode success rate.
3. `/pipeline/quality` → overall not `fail`.
4. `/stats` → `listings_last_7_days` moving; `last_updated` recent.

## Local stack

```bash
cp .env.example .env
docker compose up -d db
# apply migrations 001–007 via psql or compose init volume
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8080
cd dashboard && npm ci && npm run dev
```

## Ethics / rate limits

See [source-apis/ETHICS.md](./source-apis/ETHICS.md). Keep delays; do not brute-force contact endpoints; treat phones/emails as PII (PDPA tests in `tests/test_pdpa_sanitization.py`).
