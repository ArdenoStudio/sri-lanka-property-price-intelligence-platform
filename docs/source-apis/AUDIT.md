# Deep audit: what these APIs can do for Nilam

**Scope:** Map live-probed source APIs → our `RawListing` → `Listing` → deal score / trends / estimate pipeline.  
**Date:** 2026-07-19  
**Sources:** ikman (`api.ikman.lk`), LPW (`/api/v3/search2`), onlineproperty (WP REST), house.lk (no API yet).

---

## 1. Executive verdict

| Priority | Move | Why it matters |
|---|---|---|
| **P0** | Replace ikman Playwright list scrape with `/v1/serp` | Removes CAPTCHA surface for ~65k property ads; structured district/city/type; beds on SERP for houses/apts |
| **P0** | Replace LPW HTML cards with `/api/v3/search2` | Beds/baths/size/lat/lon already in JSON — biggest quality jump for a source we already scrape |
| **P1** | Replace ikman detail enricher Playwright with `/v1/ads/{id}` | Structured `properties[]` (size, beds, baths) + description; no browser |
| **P1** | Fix ikman `source_id` to API hex id (with slug bridge) | Current trailing-digit / slug ids collide (`"1"`, `"3"`, `"885"`) |
| **P2** | onlineproperty → WP REST list + content parse | Small corpus (~206); modest win (fewer slow HTML category fetches) |
| **P3** | house.lk | No public API until CF session capture; fix discarded beds/baths on cards first |

**Bottom line:** For the two biggest sources (ikman + LPW), we can ingest **list-quality data that is already better than today’s cards**, and for ikman we can enrich detail **without Playwright**. That directly feeds deal scoring (needs bedrooms + district + price), perch pricing (needs size), geocoding (LPW skips Nominatim), and estimate comps (needs size + beds).

---

## 2. What the product actually needs

Pipeline fields that drive money features:

| Downstream | Required fields | Nice-to-have |
|---|---|---|
| Cleaner → `Listing` | `raw_price`, `raw_location`, `raw_size`, `property_type`, `listing_type`, title | description |
| Deal score / aggregates | `price_lkr`, `district`, `property_type`, `bedrooms`, `price_per_perch` | bathroom (unused today) |
| Geocoder | `city` + `district` | source lat/lng |
| `/estimate` comps | size + bedrooms + district + price | city-level, sqft |
| Price history | stable `source_id` + snapshot `raw_price` | posted/`date` from source |

Today’s gaps the APIs close:

1. **Bedrooms sparse** — deal scores often fall back to broad (non-bedroom) medians; ikman SERP already has `Bedrooms: N` for houses/apts; LPW API has `rooms` ~100% on sales.
2. **Size wrong/missing on ikman list** — we stuff category meta into `raw_size`; land SERP has `"8.5 perches"` in `details[]`; house detail has `house_size` / `land_size`.
3. **Geocode cost** — LPW API returns `lat`/`lon` on ~100% of ads.
4. **Identity instability (ikman)** — slug trailing numbers are not unique IDs.

---

## 3. Source-by-source capability matrix

### 3.1 ikman — `api.ikman.lk`

#### List ingest: `GET /v1/serp`

| Our field | API source | Quality vs Playwright today |
|---|---|---|
| `source_id` | `results[].id` (hex) | **Better** — true unique id (see §4) |
| `url` | `results[].url` / slug | Equal |
| `title` | `title` | Equal |
| `raw_price` | `money.amount` or `info` | Better (structured; includes “per perch”, “/month”, “/night”) |
| `raw_location` | `location.name` (+ `area.name` district) | **Much better** — separate city + district ids |
| `raw_size` | `details[]` (land) or detail `properties` | List: land size often present; house floor/land size usually **detail-only** |
| `property_type` | map from `category.id` / name | **Better** than title heuristics |
| `listing_type` | map from `type` (`for_sale`/`for_rent`) | **Better** — also flags short-term via cat `936` or `/night` |
| `description` | detail only | — |
| beds / baths | SERP `details` like `Bedrooms: 3` (~96% houses/apts) | **New at list time** (today needs enricher) |
| lat/lng | not in SERP/detail | Still need geocoder / location id map |
| posted time | `date`, `last_bump_up_date` | New — useful for freshness / trends |

**Category strategy (property tree id `409`):**

| Goal | Call pattern |
|---|---|
| Full dump | `category=409` — ~65k ads, ~2,619 pages @ 25/page |
| Sale houses | `415` (~19k) |
| Sale land | `942` (~31k) |
| Sale apt | `937` (~3k) |
| Rent house/apt | `416` / `938` |
| Commercial | `939` / `940` |
| Short-term (filter out) | `936` (~411) — mark `is_short_term` early |
| Annex / room | `413` |
| District slice | `location=<district_id>` e.g. Colombo `1506` |

Pagination needs `page` + `next_page_token` from prior response.

**SERP alone is enough for:**
- Land sale pricing (size in `details`, price often per perch)
- House/apt **bedroom bucketing** without detail visit (~96%+ on sampled pages)
- Correct sale vs rent vs nightly

**Still need detail (`GET /v1/ads/{id}`) for:**
- House/apt floor size & land size (`house_size`, `land_size`, `size`)
- Full description (outlier / short-term text signals)
- Address string, furnished/completion (apts)
- View counts (optional analytics)

Detail response `properties[]` matches what `detail_enricher._extract_ikman` already parses from `window.initialData`.

#### Volume / rate reality

| Mode | Approx calls | Notes |
|---|---|---|
| Daily delta (sort by date, stop on known ids) | tens–low hundreds | Prefer bump/date ordering; stop after N pages of all-dupes (current pattern) |
| Full property backfill | ~2.6k SERP pages | At 2 req/s ≈ ~20+ min SERP-only; polite 1 req/s safer |
| Enrich all houses missing size | up to ~19k detail GETs | Batch only rows with null `size_*`; cache aggressively |

No API key. Header `Application: web`. Do not hit auth’d routes (`/v1/ads` list, chat, etc.).

---

### 3.2 LankaPropertyWeb — `/api/v3/search2`

| Our field | API field | Coverage (sample n=40) |
|---|---|---|
| `source_id` | `ad_id` | Same as today (`data-ad-id`) — **safe migration** |
| `url` | `link` | |
| `title` | `heading_main` / `seo_heading` | |
| `raw_price` | `price` + `price_str` + `price_type` | sales 100%; rentals 95%; land 97.5% |
| beds | `rooms` | sales/rentals ~100%; land 0% |
| baths | `bathrooms` | sales ~98%; rentals ~80% |
| floor size | `floor_area` (“985 sqft”) | sales ~95%; rentals 100% |
| land size | `land_size` + `land_units` | land 100%; sales houses ~28% |
| city | `city` / `main_city` / `area` | 100% |
| region | `region` (e.g. Western) | map → district via cleaner |
| **lat/lng** | `lat`, `lon` | **~100%** — can set `Listing.lat/lng` + skip Nominatim |
| property_type | `property_type` | House / Apartment / Commercial / Bare Land / … |
| listing_type | `type` param + `seo_propty_type` | `sales` / `rentals` / `land` |

**Types to poll:** `sales` (~10k), `rentals` (~7.7k), `land` (~4.7k).  
Pagination: `start_point` + `limit` (site uses 30).  
Filters we can use for thin districts: `location`, `keywords`, `property_type`, price/size bounds.

**Token:** JWT + `secure_key` scraped from HTML once per run (already public in page). Re-extract if 401/empty.

**Detail page:** still optional — list API is richer than our current LPW detail enricher (which only scrapes a property table). Prefer API; HTML detail only if a field is missing.

**LPW is the cleanest “flip the scraper” win** — same `ad_id`, denser attributes, free geocodes.

---

### 3.3 onlineproperty — WP REST

| Endpoint | Usable? | For us |
|---|---|---|
| `/wp-json/wp/v2/rtcl_listing` | Yes (~206 total) | id, title, link, HTML `content.rendered`, category/location via `class_list` |
| `/wp-json/rtcl/v1/listings` | **No** — `DENIED_REST_API` | Would have been the structured path |

**Practical use:** paginate WP REST instead of category HTML; regex price/size from content (same as today). Not a strategic priority vs ikman/LPW.

---

### 3.4 house.lk

No API from this environment (Cloudflare). Immediate code fix unrelated to APIs: **stop dropping beds/baths** already parsed in `LamudiScraper._parse_listings` before `_upsert`. Later: capture Network XHR behind a real browser session and re-probe.

---

## 4. Critical migration risk: ikman `source_id`

Today (`scraper/ikman.py`):

```text
id_match = re.search(r"-(\d+)$", url)  → source_id = digits OR full slug
```

Observed on live SERP pages:

- Many slugs have **no** trailing digits → `source_id` = full slug (OK-ish)
- Many trailing digits are **not** unique (`"1"`, `"2"`, `"3"`, `"63"`, `"885"`) → **cross-listing collisions** / silent `ON CONFLICT DO NOTHING` drops
- API hex ids (`6a2cb4d3…`) are the real primary key

**Recommended identity model:**

| Store | Value |
|---|---|
| `source_id` | API `id` (hex) going forward |
| `raw_json.slug` | slug for URL rebuild + legacy join |
| `raw_json.legacy_source_id` | old digit/slug id when remapping |

**Bridge for existing rows:** match on normalized URL path `/en/ad/{slug}` (we already store `url`). One-off UPDATE joining API backfill by slug → rewrite `source_id` + child `listings` / `listing_snapshots` (or dual-write period).

Until this bridge runs, **do not** naively upsert API hex ids alongside old digit ids — you will duplicate the world.

---

## 5. Field mapping recipes (implementation-ready)

### ikman SERP → `RawListing`

```
source          = "ikman"
source_id       = results[].id
url             = results[].url  (force https)
title           = results[].title
raw_price       = results[].money.amount or results[].info
raw_location    = "{location.name}, {area.name}"   # city, district
raw_size        = " | ".join(details)             # or land size line only
property_type   = CATEGORY_MAP[category.id]       # 415→house, 942→land, 937→apartment, 939/940→commercial
listing_type    = "rent" if type in (for_rent,to_rent) else "sale"
raw_json        = full result (+ beds/baths parsed)
description     = null until detail
```

Parse beds/baths from `details[]` into `raw_json` so cleaner/`process_all` can be taught to read them (today cleaner only regexes title/`raw_size`).

**Cleaner follow-up (small):** if `raw_json.bedrooms` present, prefer it over title regex — unlocks deal-score bedroom buckets without waiting for enricher.

### ikman detail → enricher replacement

```
GET /v1/ads/{source_id}
→ properties[] key in {bedrooms,bathrooms,size,house_size,land_size}
→ description, money.amount, location/area, statistics.views
```

Same write path as `DetailEnricher` onto `Listing`.

### LPW search2 → `RawListing` + optional geo short-circuit

```
source_id     = ad_id
raw_price     = price_str or "Rs {price}" ; keep price_type in raw_json
raw_location  = "{city}, {main_city}" or city
raw_size      = floor_area or f"{land_size} {land_units}"
property_type = map House→house, Apartment→apartment, *Land*→land, Commercial→commercial
listing_type  = rent if type==rentals else sale
raw_json      = {rooms, bathrooms, lat, lon, region, price, price_type, ...}
```

**Geocoder short-circuit:** if `lat`/`lon` valid, set `Listing.lat/lng`, `geocode_confidence='high'`, `source='lpw_api'` on `locations` — skip Nominatim.

---

## 6. Product capabilities unlocked

### A. Coverage & freshness
- Island-wide ikman property in one category feed (no 25 district Playwright loops for basic coverage).
- Explicit rent vs sale vs short-term categories (today rentals are heuristic-mixed).
- LPW complete dump in ~10k+7.7k+4.7k rows with offset pagination — hours → minutes of HTTP.

### B. Deal score & trends quality
- Bedroom-bucket aggregates become meaningful for ikman houses/apts at **list time**.
- Land `price_per_perch` from SERP `money.amount` (“Rs X per perch”) + size in details — less enricher dependency.
- Fewer outliers from mis-typed sale/rent.

### C. Estimate API
- More comps with both size + beds → more tier_1 / tier_2 matches in `estimate_logic.py`.
- LPW sqft + beds improve apartment estimates immediately.

### D. Maps / geocoding
- LPW: near-zero Nominatim for that source.
- ikman: still geocode, but `location.id` / district id can seed a static lookup table from `/v1/locations` (centroids from polygons) as a **medium-confidence** fallback before Nominatim.

### E. Price history / drops
- Stable hex ids + frequent SERP polls → cleaner `listing_snapshots`.
- `last_bump_up_date` vs `date` can distinguish bump spam from new listings.
- Detail `statistics.views` optional engagement signal (not in schema today).

### F. What we still cannot do with these APIs
- house.lk structured ingest without CF.
- onlineproperty structured price/size (RTCL v1 denied).
- Seller contact / chat (out of scope; PII — do not store phones from ikman `contact_card` unless product requires it).
- Official ToS-blessed bulk redistribution — treat as internal ingestion, polite rates.
- Perfect cross-source dedup (still price+district heuristics).

---

## 7. Recommended architecture

```
┌─────────────────────────────────────────────────────────┐
│  probe / ingest workers (httpx)                         │
│   ikman: serp pages → optional ads/{id}                 │
│   lpw:   search2 offsets (token from HTML once/run)     │
│   op:    wp/v2/rtcl_listing (optional)                  │
└───────────────────────┬─────────────────────────────────┘
                        │ upsert RawListing + Snapshot
                        ▼
┌─────────────────────────────────────────────────────────┐
│  cleaner (teach raw_json beds/size; LPW geo hint)       │
│  geocoder (skip if lat/lng present)                     │
│  aggregates + deal_score                                │
│  detail enricher: httpx ikman /v1/ads only for nulls    │
└─────────────────────────────────────────────────────────┘
```

Keep Playwright **only** for house.lk (and ikman emergency fallback if API 5xx).

---

## 8. Phased work plan (technical slices)

### Phase A — LPW API scraper (lowest risk)
1. New `scraper/lpw_api.py` (or flag on existing) calling `search2` for sales/rentals/land.
2. Map fields; upsert with **update-on-conflict** (current main LPW behavior).
3. Pass lat/lon into cleaner/geocoder short-circuit.
4. Shadow-run vs HTML scraper; compare counts and bed fill rate; cut over.

### Phase B — ikman identity + SERP
1. Add slug↔hex bridge migration for existing `raw_listings` / `listings` / snapshots.
2. Implement `scraper/ikman_api.py`: paginate categories `415,942,937,416,938,939,940` (+ optional `409`).
3. Persist hex `source_id`; parse beds from `details` into `raw_json`.
4. Teach cleaner to prefer `raw_json.bedrooms`.
5. Keep Playwright path behind env flag for rollback.

### Phase C — ikman detail via API
1. Point `DetailEnricher` ikman branch at `GET /v1/ads/{id}`.
2. Only enqueue listings missing size/beds.
3. Retire Playwright for ikman when error rate stable.

### Phase D — polish
1. `/v1/locations` → static district/city table with rough centroids.
2. onlineproperty WP REST optional.
3. Weekly `scripts/probe_source_apis.py` in CI (like cse-api-docs).
4. house.lk: fix beds/baths upsert; CF XHR map later.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| LPW token / `secure_key` rotates | Extract from HTML each run; alert on empty result_count |
| ikman API rate limits / 503 | Backoff; cache categories/locations; stop-after-dupes |
| ikman `next_page_token` semantics change | Probe script; fall back to page-only if needed |
| Duplicate rows during id migration | Bridge by URL slug first; unique index stays `(source, source_id)` |
| Storing seller phones from SERP | Strip `contact_card` before `raw_json` persist (PDPA) |
| ToS / blocking | Polite RPS; identifiable UA; no auth abuse; HTML fallback |
| Land type LPW intermittent 522 | Retry; don’t fail whole job |

---

## 10. Success metrics (after cutover)

| Metric | Target direction |
|---|---|
| ikman scrape `status=success` rate | ↑ (fewer CAPTCHA aborts) |
| `% listings with bedrooms` (house/apt) | ↑ sharply |
| `% listings with size_perches/sqft` | ↑ |
| `% LPW with lat/lng` before geocoder | → ~100% |
| Nominatim calls / day | ↓ |
| Deal scores using bedroom bucket (≥5 comps) | ↑ |
| Estimate tier_1/tier_2 hit rate | ↑ |
| Wall time for daily ikman+LPW ingest | ↓ |

---

## 11. Suggested next commit (not in this audit)

Implement Phase A (LPW API) first — no identity migration, highest attribute density, geocode win. Then Phase B/C for ikman.

This document is analysis only; scrapers unchanged until those phases land.
