# ikman.lk — unofficial API map

**Base:** `https://api.ikman.lk`  
**Also:** HTML pages set `window.apiURL = "https://api.ikman.lk"` and embed `window.initialData` (same shape as SERP/detail).

Header used by the web app (from bundled JS):

```http
Accept: application/json
Application: web
# JS also sends: Application-name: web
```

`Application: web` or `Application-Name: web` / `pwa` is accepted. Some write/list routes then require `Authorization: Bearer <sessionToken>` — we do **not** use those.

## Endpoints (live-probed)

### `GET /v1/serp` — search results (primary)

No auth required for public SERP.

| Param | Example | Notes |
|---|---|---|
| `category` | `409` | Property root. Subcats: houses sale `415`, land sale `942`, house rent `416`, apt sale `937`, … |
| `location` | `1506` | District/city id (Colombo). Omit for island-wide |
| `type` | `for_rent` | `for_sale` / `for_rent` / `to_buy` / `to_rent` |
| `page` | `1` | 1-based |
| `next_page_token` | from prior response | Required for page ≥ 2 in practice |

```bash
curl -sS 'https://api.ikman.lk/v1/serp?category=409&page=1' \
  -H 'Accept: application/json' -H 'Application: web'
```

Response shape:

```json
{
  "pagination": {
    "page": 1, "per_page": 25, "total": 65475, "pages": 2619,
    "next_page_url": "...", "next_page_token": "..."
  },
  "serp": {
    "types": [{"key": "for_sale", "count": 55406}, ...],
    "categories": [{"id": 942, "name": "Land For Sale", "count": 31527}, ...],
    "locations": [{"id": 1506, "name": "Colombo", "count": ...}, ...],
    "results": [ /* ads */ ]
  }
}
```

Each `results[]` item includes: `id`, `slug`, `title`, `type`, `date`, `area`, `location`, `category`, `details[]`, `money`, `url`, `images`, `promotions`, and often `contact_card` (PII).

Sample: [`samples/serp_property.json`](samples/serp_property.json)

**Volume (2026-07-19):** category `409` ≈ 65k ads; `for_sale` ≈ 55k; `for_rent` ≈ 9.7k.

### `GET /v1/ads/{id}` — ad detail

```bash
curl -sS "https://api.ikman.lk/v1/ads/<ad_id>" \
  -H 'Accept: application/json' -H 'Application: web'
```

Returns `{ "ad": { ..., "properties": [...], "description": "...", "statistics": {"views": N} }, "similar_ads": [], "safety_tips": [...] }`.

`properties[]` is the structured attribute list our detail enricher already reads from `window.initialData` (`key`/`label`/`value` for size, bedrooms, etc.).

Sample: [`samples/ad_detail.json`](samples/ad_detail.json)

### `GET /v1/categories`

Full category tree. Property root id **`409`**, slug `property`.

Children (property):

| id | name |
|---:|---|
| 415 | Houses For Sale |
| 416 | House Rentals |
| 937 | Apartments For Sale |
| 938 | Apartment Rentals |
| 942 | Land For Sale |
| 943 | Land Rentals |
| 417 | Land |
| 410 | Apartments |
| 411 | Houses |
| 413 | Room & Annex Rentals |
| 422 | Commercial Property |
| 939 | Commercial Properties For Sale |
| 940 | Commercial Property Rentals |
| 936 | Holiday & Short-Term Rental |
| 941 | New Projects |
| 412 | New Developments |

Sample: [`samples/categories_property.json`](samples/categories_property.json)

### `GET /v1/locations`

District/city tree with `slug`, `geo_region` (e.g. `LK-11`), and polygon geometry on some nodes.

Sample (district roots): [`samples/locations_districts.json`](samples/locations_districts.json)

### Other routes (probed, lower value)

| Path | Result |
|---|---|
| `GET /v1/ads` | `Authentication missing` with `Application-Name: web` |
| `GET /v1/searches` | needs Application name; likely auth |
| `GET /` | 503 (edge, not an API index) |

## HTML fallback

Listing pages still embed `window.initialData` with `serp.ads.data.ads` (slightly different card shape than `/v1/serp` `results`). Detail pages embed `adDetail`. Prefer the HTTP API when available.

## Scraper impact

Replacing Playwright list pagination with `/v1/serp` would remove most ikman CAPTCHA/block surface for **list ingest**. Detail enricher can use `/v1/ads/{id}` with the hex id already stored as `source_id` (confirm id format matches what we persist today — cards use the same hex ids).
