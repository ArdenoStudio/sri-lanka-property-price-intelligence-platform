# Unofficial ikman (api.ikman.lk) API Documentation

> Live-probed documentation of ikman.lk public JSON endpoints.
> **Not affiliated with ikman / Saltside.** Data may change without notice.

Same layout as [cse-api-docs](https://github.com/Cookie-Cat21/cse-api-docs) so this
folder can later become its **own repo + docs UI** (GitHub Pages / separate site).

## Why this exists

Community scrapers often hard-code HTML selectors. ikman’s web app already speaks
JSON at `https://api.ikman.lk`. This package:

- Verifies each endpoint with an automated **probe harness**
- Stores **truncated, PII-sanitized samples** + last-verified dates
- Documents **pagination tokens**, **location sharding**, and **hard limits**
- Ships **curl + Python** examples
- States **ethics** up front (rate limits, no auth abuse, redact contact cards)

Internal research that seeded this kit lives in
[`docs/source-apis/ikman/`](../docs/source-apis/ikman/) of the property.lk monorepo.

## Quick start

```bash
cd ikman-api-docs
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Live probe (polite delays; writes samples/ + catalog/last_probe.json)
python3 scripts/probe.py

# Build static site into site/
python3 scripts/build_site.py

# Local preview
python3 -m http.server 8765 --directory site
# open http://127.0.0.1:8765/
```

## Layout

```
catalog/endpoints.yaml   # source of truth
samples/                 # truncated live JSON (PII redacted)
scripts/probe.py         # verifier
scripts/build_site.py    # static HTML docs
docs/                    # ethics, limitations, examples, changelog
examples/                # curl + python
python/                  # thin ikman_lk helper
site/                    # generated (commit for Pages / separate UI)
```

## Required headers

```http
Accept: application/json
Application: web
```

## Endpoints (public reads)

| ID | Method | Path | Notes |
|---|---|---|---|
| `categories` | GET | `/v1/categories` | Property root **409** |
| `locations` | GET | `/v1/locations` | District/city tree |
| `serp_property` | GET | `/v1/serp?category=409` | Primary SERP |
| `serp_houses_sale` | GET | `/v1/serp?category=415` | Houses sale |
| `serp_colombo` | GET | `/v1/serp` + `location=1506` | Sharded example |
| `serp_for_sale` | GET | `/v1/serp` + `type=for_sale` | Type filter |
| `serp_page2` | GET | `/v1/serp` + `next_page_token` | Pagination |
| `ad_detail` | GET | `/v1/ads/{id}` | Detail + `properties[]` |
| `ads_list_auth` | GET | `/v1/ads` | Auth observed (expect 4xx) |

Full shapes + samples: open `site/index.html` after `build_site.py`, or read
[`catalog/endpoints.yaml`](catalog/endpoints.yaml).

## Property category IDs

| id | name |
|---:|---|
| 409 | Property (root) |
| 415 | Houses For Sale |
| 416 | House Rentals |
| 937 | Apartments For Sale |
| 938 | Apartment Rentals |
| 942 | Land For Sale |
| 943 | Land Rentals |
| 413 | Room & Annex Rentals |
| 939 | Commercial Properties For Sale |
| 940 | Commercial Property Rentals |

## Python helper

```bash
cd python
pip install -e .
python smoke.py
```

## Extracting to a separate UI / repo

This directory is intentionally self-contained. To publish like cse-api-docs:

1. Copy `ikman-api-docs/` → new repo (e.g. `ikman-api-docs`)
2. Enable GitHub Pages from `site/` (or wire `pages.yml`)
3. Point the probe workflow at a weekly schedule
4. Keep ethics + MIT license in the root

## Related

- [cse-api-docs](https://github.com/Cookie-Cat21/cse-api-docs) — sibling pattern
- [property.lk platform](https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform) — production consumer (`scraper/ikman_api.py`)

## License

Documentation and harness: [MIT](LICENSE). ikman listing data remains subject to
ikman / Saltside terms; we claim no ownership of their content.
