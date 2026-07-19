# LankaPropertyWeb — unofficial API map

**Base:** `https://www.lankapropertyweb.com`  
**Primary:** `GET /api/v3/search2`

The sale/rent/land result pages embed a browser JWT + `secure_key` in the HTML that the frontend uses for search. Live-probed 2026-07-19.

## Auth (site-embedded)

From `/sale/index.php` (and related result pages):

| Param | Value observed | Notes |
|---|---|---|
| `token` | JWT with payload `{"LPW":"lpw_api_key"}` | Embedded in page HTML; may rotate |
| `secure_key` | `2JIOMXS` | Embedded alongside token |
| `site` | `LPW` | |

Do not treat these as secret credentials we own — they are public in the page source. Re-extract from HTML if calls start failing.

## `GET /api/v3/search2` — listing search

```bash
TOKEN='<from page>'
curl -sS "https://www.lankapropertyweb.com/api/v3/search2?\
token=${TOKEN}&site=LPW&secure_key=2JIOMXS&lang=en&\
type=sales&start_point=0&limit=30&is_results_page=Y&\
pic_limit=Y"
```

### Useful query params

| Param | Values | Notes |
|---|---|---|
| `type` | `sales`, `rentals`, `land` | Others (`apartments`, `condo`, `commercial`) returned empty `203` |
| `property_type` | e.g. `House`, `Apartment` | Optional refine |
| `location` | e.g. `Colombo` | Text/location filter |
| `keywords` / `searchbox` | free text | Present in embedded URL |
| `min_price` / `max_price` | numeric | |
| `no_of_bedrooms` | | |
| `land_min` / `land_max` | | |
| `floor_min` / `floor_max` | | |
| `start_point` | offset | Pagination offset |
| `limit` | page size | e.g. 30 |
| `is_results_page` | `Y` | Used by site |
| `ad_id` | single id | Returns one ad when set |

### Counts (2026-07-19)

| `type` | `result_count` |
|---|---:|
| `sales` | ~10,062 |
| `rentals` | ~7,766 |
| `land` | ~4,728 |

### Response fields (per ad)

High-value vs HTML scrape:

- `ad_id`, `link`, `heading_main`, `property_type`, `type`
- `price` (numeric string), `price_str`, `price_type`, `price_sqft`, `price_month`
- `rooms`, `bathrooms`, `floor_area`, `land_size`, `land_units`
- `city`, `main_city`, `area`, `region`, `street`
- **`lat`, `lon`** (already geocoded)
- `description`, `pics[]`, `verified`, flags (`is_hot_deals`, etc.)

Sample: [`samples/search2_sales.json`](samples/search2_sales.json)

## Other `/api/v3/*` seen in HTML

| Path | Role |
|---|---|
| `/api/v3/CreateAlert/createAlerts` | email alerts (do not abuse) |
| `/api/v3/Register` | account |
| `/api/v3/emailAlert/*` | alert mgmt |
| `/api/v3/pushToken` | push |
| `/api/v3/GetSliderResults/getResultSliderAll` | homepage slider (400 without full params) |

No dedicated public “get property by id” route found; use `search2&ad_id=` or the HTML detail page.

## Scraper impact

`scraper/lpw.py` can move from HTML card parsing to `search2` pagination (`start_point` += `limit`). Lat/lon from the API may reduce Nominatim load for LPW rows.
