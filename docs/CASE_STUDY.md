# Case study — operating PropertyLK

Engineering stories from this repo’s scrapers, cutovers, and ops. Format: symptom → root cause → fix → prevention.

## 1. ikman CAPTCHA / browser blocks → public API cutover

**Symptom:** Playwright ikman scrapes hit CAPTCHA and consecutive “blocked” pages; coverage stalled; GHA catchups flaky.

**Root cause:** HTML/browser automation against a bot-challenged surface. Island-wide SERP also hard-fails around page ~450–500 (HTTP 500), so “just paginate more” never reaches the full catalog.

**Fix:** Prefer `api.ikman.lk` SERP + ad detail behind `USE_IKMAN_SERP_API` / `USE_IKMAN_DETAIL_API` (`scraper/ikman_api.py`). Identity bridged from legacy trailing-digit `source_id` to 24-char hex via URL slug. Location-sharded SERP (`IKMAN_API_LOCATION_SHARD`) bypasses the page-500 wall. Portable docs kit in `ikman-api-docs/` + `docs/source-apis/ikman/`.

**Prevention:** Fixture mapping tests (`tests/test_ikman_api_mapping.py`); probe workflow; cutover checklist (`tests/API_SCRAPER_CUTOVER_CHECKLIST.md`); keep browser path as fallback, not primary.

## 2. Nominatim rate limits and thin geocode coverage

**Symptom:** Geocoder job slow or failure-heavy; many listings without lat/lng; heatmap sparse outside Colombo.

**Root cause:** One Nominatim call per unique city/district with a hard ≥1.1s delay; bad location strings burn quota then mark `confidence=low` and never retry.

**Fix:** Location cache table (`locations`); cleaner/_api short-circuit when source provides lat/lng (LPW API, ikman detail); batch geocode by normalized key; dashboard heatmap tolerates district centroids when point density is low.

**Prevention:** Track geocode success in `/pipeline/metrics`; quality check `missing_geocode_pct`; prefer API coordinates over OSM.

## 3. Duplicate listings across sources

**Symptom:** Same property appears on ikman and LPW; deal scores and counts inflate; users see near-identical cards.

**Root cause:** No shared property ID across portals. Title/URL differ; only price and coarse location overlap.

**Fix:** Soft-flag duplicates in cleaner (`is_duplicate` / `duplicate_of`) with a two-pass heuristic (exact `raw_location`+price, then district+type+price cross-source, 7-day window). Idempotent upserts prevent same-source explosion on re-scrape.

**Prevention:** Expose `duplicate_rate_pct` in metrics/quality; unit tests for known pairs; document that this is **not** full entity resolution (see DATA_MODEL.md).

## 4. Schema drift in source payloads

**Symptom:** Size/bedroom fill collapses after a silent upstream change (e.g. ikman size strings with thousands separators `"1,816.0 sqft"` parsing as 816).

**Root cause:** Informal JSON/HTML contracts; scrapers assumed stable field shapes.

**Fix:** Sample fixtures under `docs/source-apis/*/samples/`; explicit mapping functions with regression tests (comma-thousands case covered); observability plan in `docs/source-apis/OBSERVABILITY.md` for field fill rates.

**Prevention:** Mapping tests in CI; probe script; refuse to treat undocumented fields as stable without a fixture.

## 5. Partial pipeline runs and stale job metadata

**Symptom:** Live `/public/pipeline` showed ikman `delayed` for weeks while LPW/geocode/aggregates looked healthy; cleaner `last_success` lagged; README implied a uniformly “live” pipeline. Some `scrape_runs` omitted `status`, so success detection relied on NULL+finished heuristics.

**Root cause:** Independent GitHub Actions for scrape/clean/geocode/aggregate; a failed or skipped upstream job does not block others. Catchup runners historically used machine-specific paths (`_process_runner.py`). Incomplete `scrape_runs` rows weakened monitoring.

**Fix:** `/pipeline/status` + `/pipeline/metrics` + `/pipeline/quality` as the honesty surface; normalize scrape_run writes (`status`, `listings_failed`, optional `stats`); portable `_process_runner.py`; runbook for partial failure recovery.

**Prevention:** Treat delayed sources as first-class in README metrics; never invent freshness; keep scrape workflows separate from unit CI.

---

### Tradeoffs (interview notes)

| Choice | Why | Cost |
|---|---|---|
| Postgres upserts + views | Fits daily scrape volume; operable on Supabase | Not a lakehouse; no time-travel beyond snapshots |
| Soft duplicate flags | Cheap, reversible | False positives/negatives |
| API-first scrapers | Fewer CAPTCHAs | Unofficial APIs; ethics/rate-limit discipline required |
| Deal score vs bedroom median | Interpretable DE signal | Not an AVM |

### If this needed ~10× scale

Shard scrape by district/category (already started for ikman); partition `listings` by scraped month; move Nominatim to a self-hosted instance or paid geocoder; promote marts to incremental jobs; keep the same raw→clean→enrich contract — do not bolt on Kafka for a daily batch product.
