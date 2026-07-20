# ikman.lk API — live status (2026-07-20)

## Verdict

**The public JSON API works in real time.** Integration code (`scraper/ikman_api.py`) is solid, but GitHub Actions was not turning it on — daily/mega scrapes fell back to Playwright HTML via `run_all_scrapers.py`. That wiring gap is fixed in this change set.

## Live probes (this session)

| Endpoint | Result |
|----------|--------|
| `GET https://api.ikman.lk/v1/serp?category=409&page=1` | **200** — ~65.6k property ads |
| Houses for sale `415` | ~19.3k |
| Land for sale `942` | ~31.6k |
| Apartments for sale `937` | ~3.2k |
| House / apt / commercial rent `416` / `938` / `940` | ~3.7k / ~2.3k / ~2.6k |
| Commercial sale `939` | included in DEFAULT_CATEGORIES |
| `GET /v1/ads/{hex_id}` | **200** — beds/baths/size/views/description |

Required headers: `Accept: application/json`, `Application: web`.

## What data we can pull

**From SERP (`/v1/serp`):**

- Ad id (24-char hex), title, slug → URL
- Price (`money.amount`), location + area, category, listing type
- `details[]` strings such as `Bedrooms: 4` (stored into `raw_json` for the cleaner)
- `date` (ISO) — usually **last bump/refresh**, not original list date
- Images, membership / verified flags, `contact_card` (we sanitize PII before storage)

**From detail (`/v1/ads/{id}`):**

- Description (HTML/text)
- Structured `properties`: bedrooms, bathrooms, `size` / `house_size` / `land_size`
- View counts (`statistics.views`)

## How far back?

Treat ikman as **current market inventory**, not a closed-sale archive.

| Probe | Result |
|-------|--------|
| Houses sale page 1 | dates around 2026-07-18 … 2026-07-20 |
| Page 400 | oldest on page ~2026-06-22 (~1 month) |
| Pages 600–700 | **HTTP 500** |
| `sort=date&order=asc` page 1 | oldest sample ~2026-05-21 (~2 months) |

Practical lookback on active inventory: **about weeks to ~2 months**. Deep pagination eventually 500s. Asc sort does **not** unlock multi-year history.

For multi-year price history, rely on **our Postgres snapshots** over time — not a one-shot ikman backfill.

## Gaps found in our wiring

1. **`run_all_scrapers.py` ignored `USE_IKMAN_SERP_API`** — only `run_scraper.py` / scheduler used the API path. Fixed: flag routes to `scrape_ikman_api` + identity bridge.
2. **Daily / mega workflows lacked API flags** — Playwright was the default in CI. Fixed: `USE_IKMAN_SERP_API=1`, `USE_IKMAN_DETAIL_API=1`, `USE_LPW_API=1`.
3. **Size parsing bug** — `"1,816.0 sqft"` / `"3,500.0 sqft"` was truncated at the comma. Fixed in `map_ikman_ad_detail` (strip commas first). Verified live: `"1,011 sqft"` → `1011.0`, `"3,500.0 sqft"` → `3500.0`.

## Recommended ops settings

```bash
USE_IKMAN_SERP_API=1
USE_IKMAN_DETAIL_API=1
IKMAN_API_MAX_PAGES=80   # daily / pipeline
# or 200 for mega
```

With the SERP flag on, coverage mode skips Playwright district walks for ikman and pulls island-wide category SERP instead (usually better coverage). Detail enrichment is slower (one request per ad); turn it on when beds/baths/size completeness matters.

**Full inventory plan** (all ~65k + SERP/detail fields → Postgres): [`FULL_INVENTORY_PLAN.md`](FULL_INVENTORY_PLAN.md).

**Historical sources research** (Wayback / Zenodo / gist — none replace daily scrape): [`HISTORICAL_SOURCES.md`](HISTORICAL_SOURCES.md).

**Max-out ops:** workflow `ikman_max_catchup.yml` (location-sharded SERP) + `ikman_detail_enrich.yml` (detail fields).
