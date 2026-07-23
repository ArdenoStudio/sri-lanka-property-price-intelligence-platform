# Data model

Canonical schema for PropertyLK. Field meanings match `db/models.py` and `db/migrations/`.

## Identity & idempotency

| Layer | Natural key | Conflict behavior |
|---|---|---|
| Raw ingest | `(source, source_id)` | `ON CONFLICT DO UPDATE` (scrapers) / `DO NOTHING` on some HTML paths |
| Clean listings | `(source, source_id)` | Upsert price/location/size; bump `last_seen_at` |
| Snapshots | `(source, source_id, fingerprint)` | Insert only when content fingerprint changes |

`source` values in production: `ikman`, `lpw`, `onlineproperty`, `lamudi` (house.lk). Coverage jobs may write `ikman_coverage` into `scrape_runs` only.

## `raw_listings`

As scraped, before normalize.

| Column | Meaning |
|---|---|
| `source` / `source_id` | Platform + listing id (ikman prefers 24-char hex API id) |
| `scraped_at` | Ingest timestamp |
| `url`, `title` | Listing link + headline |
| `raw_price` / `raw_location` / `raw_size` | Source strings, unparsed |
| `property_type` | `land` \| `house` \| `apartment` \| `commercial` (+ rare legacy) |
| `listing_type` | `sale` \| `rent` |
| `raw_json` | Sanitized payload (PII redacted where scrapers apply privacy helpers) |
| `is_processed` | Cleared → cleaner batch; set true after successful upsert |

## `listings` (canonical)

| Column | Meaning |
|---|---|
| `raw_id` | FK to originating raw row (last writer) |
| `first_seen_at` / `last_seen_at` | Listing lifetime; Newest sort uses `first_seen_at` |
| `price_lkr` / `price_per_perch` / `price_per_sqft` | Parsed LKR |
| `district` / `city` / `gn_division` | Normalized location parts |
| `lat` / `lng` / `geocode_confidence` | Coordinates; confidence `high`\|`medium`\|`low` |
| `location_id` | FK → `locations` cache |
| `bedrooms` / `bathrooms` / sizes | Structured attributes |
| `is_outlier` / `outlier_reason` | Price/size guards from cleaner |
| `is_duplicate` / `duplicate_of` | Cross-listing soft match (see below) |
| `deal_score` / `market_median_lkr` | Set by aggregator (bedroom-bucket aware) |
| `is_short_term` | Nightly / holiday rental heuristic |
| `original_price_lkr` | First observed price (deal / drop context) |

### Dedupe key (current)

Implemented in `DataCleaner.detect_duplicates`:

1. Same `price_lkr` + exact `raw_location` within 7 days, different `source_id`.
2. Else same `price_lkr` + `district` + `property_type`, **different `source`**, within 7 days.

Flags only — duplicates are not deleted. This is intentionally weak vs true address matching.

## `listing_snapshots`

SCD-style **content history**: a new row when `build_snapshot_fingerprint(title, price, location, size, type, listing_type, url)` changes. Use for price history on the listing detail API.

## `locations`

| Column | Meaning |
|---|---|
| `normalized_key` | `city|district` lowercase key |
| `lat` / `lng` / `confidence` | Cached geocode |
| `source` | `cleaner`, `geocoder`, `{source}_api`, etc. |

## `scrape_runs`

| Column | Meaning |
|---|---|
| `source` | Scraper identity |
| `started_at` / `finished_at` | Wall clock; duration = difference |
| `status` | `running` \| `success` \| `failed` (legacy rows may be NULL + finished) |
| `listings_found` / `listings_new` / `listings_failed` | Run counters |
| `error_message` | Terminal failure text |
| `stats` | Optional JSON (transport, captcha counters, pages) — migration 006 |

## `job_runs`

Downstream: `clean_listings`, `geocode_listings`, `compute_aggregates`. `stats` holds batch counters.

## `price_aggregates`

Monthly mart grain: `district × property_type × (bedroom_bucket?) × year × month`.

- Broad rows: `bedroom_bucket IS NULL`
- Bucketed rows: `1` / `2` / `3` / `4` / `5+` (migration 004)

## Analytics views (migration 007)

- `mart_district_benchmarks` — latest median per district/type/bucket
- `mart_property_type_trends` — monthly series (broad)
- `mart_source_inventory` — per-source quality tallies
- `mart_deal_score_coverage` — deal_score fill by district/type
