# Post-API scraper observability plan for Nilam

This is the observability spec to ship alongside the API-based source migration.

It is meant to answer four product questions quickly:

1. Are **bedrooms / size / lat-lng fill rates** improving after switching sources to APIs?
2. Is **scrape success** improving because we removed browser/CAPTCHA exposure?
3. Is **deal score coverage** improving at the bedroom-bucket level instead of falling back to broad medians?
4. Are we **reducing Nominatim calls** because sources like LPW already provide coordinates?

The plan below is designed to fit the current codebase:

- per-source run summaries already land in `scrape_runs`
- downstream jobs already land in `job_runs.stats`
- the admin UI already reads `/public/pipeline`
- the relevant stages are `scrape_*` -> `clean_listings` -> `geocode_listings` -> `compute_aggregates`

---

## 1. What success should look like

After the API migration, Nilam should be able to show:

- **ikman**: near-zero CAPTCHA exposure for list ingest, higher bedroom fill on houses/apartments
- **LPW**: major lift in size/bed/bath fill, and a large jump in source-provided lat/lng
- **overall**: more listings with `deal_score`, fewer listings falling back to broad medians, fewer Nominatim calls per fresh listing

If we cannot prove those deltas on a dashboard, the migration is incomplete.

---

## 2. Minimum telemetry model

### 2.1 Run identity

Every scraper/job log line should include:

- `run_id`
- `job_name`
- `source` when applicable
- `stage`
- `started_at`
- `finished_at`
- `duration_ms`
- `status`
- `mode` (`delta`, `backfill`, `coverage`, `detail`, `manual`)
- `code_version` or commit SHA if available

### 2.2 Where to persist it

Use two layers:

1. **Structured logs** for detailed per-page / per-endpoint diagnostics
2. **Run summaries** for dashboarding

Recommended persistence shape:

- keep `JobRun.stats` as the summary payload for downstream jobs
- add a `stats JSON` payload to `ScrapeRun` or create a sibling `scrape_run_metrics` table

Reason: `ScrapeRun` currently only stores `listings_found` and `listings_new`, which is not enough for field coverage, CAPTCHA separation, or API-vs-browser success tracking.

---

## 3. What to log

## 3.1 Source scraper logs

Log one summary event at scraper completion, plus lightweight page/endpoint events during the run.

### Required summary fields per source run

- `source`
- `transport` (`api`, `html`, `browser`)
- `endpoint_family` (`ikman_serp`, `ikman_detail`, `lpw_search2`, `wp_rest`, `houselk_browser`)
- `requests_attempted`
- `requests_succeeded`
- `requests_failed`
- `response_status_counts`
- `rate_limited_count`
- `blocked_count`
- `captcha_detected_count`
- `captcha_bypassed_count`
- `captcha_terminal_fail_count`
- `pages_scanned`
- `all_dupe_stop_count`
- `listings_found`
- `listings_new`
- `listings_updated`
- `zero_yield` boolean
- `error_message` for terminal failures

### Required field-coverage counters at scrape time

Count fields from the raw source payload before cleaning:

- `raw_price_present`
- `raw_location_present`
- `raw_size_present`
- `bedrooms_present_in_source`
- `bathrooms_present_in_source`
- `size_present_in_source`
- `source_latlng_present`
- `description_present`

These should be emitted as counts, not just percentages, so the dashboard can compute rates for any time window.

### Why this matters

This is the only place to cleanly separate:

- API success vs browser success
- normal fetch failures vs CAPTCHA/blocking failures
- field availability from the source vs field extraction later in the pipeline

---

## 3.2 Cleaner job logs

`clean_listings` should keep its current totals and add field-completeness summaries on the cleaned `Listing` rows it just processed.

### Required summary fields

- `processed`
- `passed`
- `outliers`
- `duplicates`
- `null_district_reprocess.checked`
- `null_district_reprocess.fixed`
- `null_district_reprocess.unchanged`

### Add these fill counters on the processed batch

- `price_lkr_filled`
- `district_filled`
- `city_filled`
- `bedrooms_filled`
- `size_any_filled` (`size_perches OR size_sqft`)
- `latlng_filled`
- `source_latlng_used`
- `location_lookup_reused`
- `listing_type_sale`
- `listing_type_rent`

### Important derived rates

- `bedroom_fill_rate = bedrooms_filled / eligible_house_apartment_processed`
- `size_fill_rate = size_any_filled / eligible_processed`
- `lat_fill_rate = latlng_filled / processed`

For bedrooms, treat houses and apartments as the primary denominator. Land/commercial can be shown separately or excluded from the headline metric.

---

## 3.3 Detail enrichment logs

Even after API list ingest, Nilam still needs to know whether detail enrichment is adding meaningful value.

For `enrich_details` log:

- `visited`
- `enriched`
- `errors`
- `bedrooms_added`
- `bathrooms_added`
- `size_perches_added`
- `size_sqft_added`
- `raw_location_updated`
- `price_reconstructed_from_size`

This lets Nilam prove whether ikman detail API work is worth continuing once SERP coverage improves.

---

## 3.4 Geocoder logs

`geocode_listings` is where Nilam proves Nominatim reduction.

Current stats already include `total`, `cache_hits`, `api_calls`, and `failures`. Extend them with:

- `candidate_listings_without_lat`
- `candidate_locations_without_lat`
- `source_latlng_shortcuts`
- `location_rows_reused`
- `new_location_rows_created`
- `nominatim_queries_attempted`
- `nominatim_queries_succeeded`
- `nominatim_queries_failed`
- `coords_written_to_listings`
- `coords_written_from_cache`
- `coords_written_from_source`
- `coords_written_from_nominatim`

### Headline reduction metrics

- `nominatim_calls_per_100_new_listings`
- `source_latlng_share = coords_written_from_source / total_coords_written`
- `nominatim_share = coords_written_from_nominatim / total_coords_written`

LPW should move strongly toward source-provided coordinates.

---

## 3.5 Aggregate / deal-score logs

`compute_aggregates` currently logs aggregate count, but the business question is coverage quality.

Add these summary fields:

- `broad_groups_computed`
- `bucketed_groups_computed`
- `bucketed_groups_with_min_sample`
- `eligible_listings_for_deal_score`
- `listings_with_deal_score`
- `listings_resolved_with_bucket_median`
- `listings_resolved_with_broad_fallback`
- `listings_missing_market_median`
- `eligible_house_apartment_with_bedrooms`
- `eligible_house_apartment_without_bedrooms`

### Core deal-score coverage rates

- `deal_score_coverage = listings_with_deal_score / eligible_listings_for_deal_score`
- `bucket_resolution_rate = listings_resolved_with_bucket_median / eligible_listings_for_deal_score`
- `broad_fallback_rate = listings_resolved_with_broad_fallback / eligible_listings_for_deal_score`
- `missing_median_rate = listings_missing_market_median / eligible_listings_for_deal_score`

The key win from API scrapers is not just "more deal scores"; it is "more deal scores from the correct bedroom bucket".

---

## 4. What to dashboard

Use one admin dashboard with four sections.

## 4.1 Source health

Per source, show for the last 7/30 days:

- runs succeeded / failed
- listings found / new
- zero-yield runs
- blocked runs
- CAPTCHA-detected runs
- avg duration
- request success rate

### Must-have visual

A stacked bar for each source run outcome:

- success
- failure
- blocked/CAPTCHA
- zero-yield

This makes "scrape success vs CAPTCHA" obvious instead of burying it in logs.

---

## 4.2 Data completeness

Show fill rates by **source** and **day** for:

- bedrooms
- size
- lat/lng
- district

Recommended cuts:

- overall
- houses + apartments only
- by source (`ikman`, `lpw`, `onlineproperty`, `lamudi`)

### Must-have visual

Before/after migration trend lines:

- `bedroom_fill_rate`
- `size_fill_rate`
- `lat_fill_rate`

This is the cleanest proof that API ingestion improved downstream data quality.

---

## 4.3 Deal-score coverage

Show:

- `% of eligible listings with deal_score`
- `% resolved by bedroom bucket median`
- `% resolved by broad fallback`
- `% unresolved`

Add slices by:

- district
- property type
- bedroom bucket
- source

### Must-have visual

A funnel:

1. clean non-outlier listings
2. with district + property_type + price
3. with bedrooms
4. resolved by bedroom bucket
5. resolved only by broad fallback
6. with final `deal_score`

This reveals whether bedroom fill is actually translating into better market comparisons.

---

## 4.4 Geocoding efficiency

Show:

- total listings needing coords
- source coords used
- location cache hits
- Nominatim calls
- Nominatim failures
- Nominatim calls per 100 new listings

Break out by source.

### Must-have visual

A weekly trend:

- source-provided coordinates
- cache-resolved coordinates
- Nominatim-resolved coordinates

If the LPW API migration worked, the Nominatim line should visibly fall.

---

## 5. Suggested alert thresholds

Keep alerts simple and product-facing.

### Source alerts

- scraper success rate < 90% over 24h
- any API source with `zero_yield = true` for 2 consecutive runs
- `captcha_detected_count > 0` on an API list scraper
- blocked/CAPTCHA rate > 10% on browser-only sources

### Quality alerts

- bedroom fill rate drops by > 10 percentage points day-over-day
- size fill rate drops by > 10 percentage points
- lat/lng fill rate drops by > 15 percentage points

### Business-impact alerts

- deal score coverage drops by > 10 percentage points week-over-week
- bucket resolution rate drops below 50% for houses/apartments
- broad fallback rate rises above baseline by > 15 percentage points

### Cost/ops alerts

- Nominatim calls per 100 new listings rises above migration baseline
- geocoder backlog grows for 3 consecutive runs

---

## 6. Recommended API / schema work

This is the leanest implementation path.

### 6.1 Persist richer scraper summaries

Add one of:

- `scrape_runs.stats JSON`
- or a new `scrape_run_metrics` table keyed by `scrape_run_id`

Store the counters listed in section 3.1.

### 6.2 Expand `/public/pipeline`

Keep the current freshness table, but add optional summary payloads for:

- latest fill rates by source
- latest CAPTCHA / blocked counts
- latest deal-score coverage
- latest Nominatim usage

### 6.3 Add one deeper admin endpoint

Example:

- `GET /admin/observability/summary?days=30`

It should return already-aggregated time-series values so the dashboard does not compute business metrics in the browser.

---

## 7. Nilam checklist

## P0: instrumentation

- [ ] Add stable `run_id` to every scraper and downstream job
- [ ] Standardize structured completion events for `scrape_*`, `clean_listings`, `enrich_details`, `geocode_listings`, and `compute_aggregates`
- [ ] Persist downstream summary counters in `JobRun.stats`
- [ ] Add `stats JSON` to `ScrapeRun` or create a dedicated scraper metrics table

## P0: headline metrics

- [ ] Track `bedroom_fill_rate` by source and day
- [ ] Track `size_fill_rate` by source and day
- [ ] Track `lat_fill_rate` by source and day
- [ ] Track `deal_score_coverage`
- [ ] Track `bucket_resolution_rate`
- [ ] Track `nominatim_calls_per_100_new_listings`

## P0: scrape reliability

- [ ] Separate `failed`, `blocked`, `captcha`, and `zero_yield` outcomes
- [ ] Log `captcha_detected_count` even when the run later succeeds
- [ ] Show API vs browser transport on each source run
- [ ] Alert if an API source starts showing CAPTCHA events

## P1: dashboards

- [ ] Add a source-health panel beside the existing pipeline recency table
- [ ] Add a completeness panel for bedrooms / size / lat-lng
- [ ] Add a deal-score coverage funnel
- [ ] Add a geocoding efficiency panel with source-vs-Nominatim split

## P1: rollout verification

- [ ] Record a pre-migration 7-day baseline for each metric
- [ ] Compare post-migration week 1 vs baseline
- [ ] Confirm LPW reduced Nominatim dependency
- [ ] Confirm ikman API reduced CAPTCHA/block incidents
- [ ] Confirm deal-score bucket resolution improved, not just total listing count

## P2: follow-up analysis

- [ ] Break completeness by district and property type
- [ ] Break deal-score coverage by bedroom bucket
- [ ] Measure detail-enricher incremental value after API cutover
- [ ] Decide whether browser enrichment remains worth its runtime cost

---

## 8. Recommended first dashboard version

If Nilam only ships one version this week, make it:

1. **Top row:** source success, blocked/CAPTCHA, listings found/new
2. **Second row:** bedroom fill, size fill, lat fill by source
3. **Third row:** deal score coverage + bucket vs fallback split
4. **Fourth row:** source coords vs cache vs Nominatim

That version is enough to tell whether the API migration worked operationally and whether it improved the product's money features.
