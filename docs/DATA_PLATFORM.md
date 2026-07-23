# PropertyLK data platform

Production-minded map of the Sri Lanka property listing pipeline: what exists, what is measured, and what is still thin.

## Phase 0 audit (2026-07-23)

### Actual data flow

```text
Sources (ikman / LPW / house.lk=lamudi / onlineproperty)
        │  scrapers: scraper/{ikman,ikman_api,lpw,lpw_api,lamudi,onlineproperty}.py
        │  orchestration: run_*.py, _*_catchup_runner.py, .github/workflows/*scrape*
        ▼
raw_listings  (+ listing_snapshots on content fingerprint change)
        │  UNIQUE(source, source_id) upsert — idempotent re-scrape
        ▼
cleaner (scraper/cleaner.py → run_clean.py / JobRun clean_listings)
        │  price/size/beds/district normalize + outlier + cross-source dedupe flags
        ▼
listings  (+ locations cache)
        │
        ├─► geocoder (Nominatim / source lat-lng) → lat/lng + geocode_confidence
        │
        └─► PriceAggregator (api/main.py) → price_aggregates + deal_score
                │
                ▼
        FastAPI (api/main.py) + React dashboard (dashboard/)
        Freshness: GET /pipeline/status · metrics: GET /pipeline/metrics
```

### Tables / models (`db/models.py` + migrations 001–007)

| Table | Role |
|---|---|
| `raw_listings` | Immutable-ish ingest; unique `(source, source_id)` |
| `listings` | Canonical cleaned row; unique `(source, source_id)`; SCD-ish via `first_seen_at` / `last_seen_at` |
| `listing_snapshots` | Content history when fingerprint changes (price/title/location/size) |
| `locations` | Normalized city\|district geocode cache |
| `scrape_runs` | Per-source scrape metadata (`status`, found/new/failed, optional `stats` JSON) |
| `job_runs` | Downstream jobs: clean / geocode / aggregates (`stats` JSON) |
| `price_aggregates` | District × type × listing_type (sale|rent) × month (+ optional bedroom bucket) medians |
| Mart views (007) | `mart_district_benchmarks`, `mart_property_type_trends`, `mart_source_inventory`, `mart_deal_score_coverage` |

### Metrics inventory (before → after this hardening)

| Signal | Before | After |
|---|---|---|
| Last scrape / raw+clean counts | `/health`, `/stats` | same |
| Per-source freshness UI | `/public/pipeline` (ikman+lpw only) | `/public/pipeline` + `/pipeline/status` (4 sources + jobs) |
| Duplicate / geocode / success rates | fill-rate helper only (`scraper/metrics.py`) | `/pipeline/metrics` + `/pipeline/quality` |
| Scrape run structured stats | columns found/new only | + `listings_failed`, `stats` JSON (006) |

### Tests / CI

- Unit tests under `tests/` (cleaner, API mapping, estimate logic, PDPA, onlineproperty).
- CI: `.github/workflows/ci.yml` — `pytest tests/` + dashboard `tsc` on PRs; scrape workflows are separate.
- Gaps filled in this effort: pipeline endpoint tests, dedupe pair tests, quality module smoke.

### README overclaims (pre-rewrite)

- “National / intelligence platform” marketing tone and Ardeno hero flex.
- README listed `GET /pipeline/status` while only `/public/pipeline` existed.
- “Real-time” / pipeline dashboard implied more freshness than ops showed (e.g. ikman scrape success lagging weeks while LPW stayed current — see live `/public/pipeline`).
- Migrations listed through 004; 005+ already in tree.

### Honest gaps (still)

- Cross-source dedupe is heuristic (price + location/district), not entity resolution.
- `listing_snapshots` tracks content changes; there is no full SCD2 dimension table.
- house.lk (`source=lamudi`) remains Cloudflare-fragile; onlineproperty cadence is secondary.
- Geocode failure reasons are coarse (`confidence=low`), not a typed error taxonomy.
- Marts are SQL views, not a dbt project (intentionally lean).

See also: [DATA_MODEL.md](./DATA_MODEL.md) · [METHODOLOGY.md](./METHODOLOGY.md) · [RUNBOOK.md](./RUNBOOK.md) · [CASE_STUDY.md](./CASE_STUDY.md)
