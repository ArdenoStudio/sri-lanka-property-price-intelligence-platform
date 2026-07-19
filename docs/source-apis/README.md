# Unofficial property-source API notes

> Live-probed documentation of public JSON endpoints used by Sri Lankan listing sites.
> **Not affiliated** with ikman, LankaPropertyWeb, OnlineProperty, or house.lk.
> Endpoints and tokens can change without notice.

Inspired by [cse-api-docs](https://github.com/Cookie-Cat21/cse-api-docs): verify what the browser already calls, store truncated samples, and state ethics up front.

## Master plan

For the full product plan of record (UI rework with Cal Sans / Inter, API cutover sequencing, feature flags, and Sri Lanka growth backlog), see **[../MASTER_PLAN.md](../MASTER_PLAN.md)**.

## Deep audit

For how these APIs map onto our `RawListing` → deal score / estimate pipeline, migration risks (especially ikman ids), and a phased cutover plan, see **[AUDIT.md](AUDIT.md)**.

For the post-migration instrumentation plan — fill rates, CAPTCHA-vs-success tracking, deal-score coverage, and Nominatim reduction — see **[OBSERVABILITY.md](OBSERVABILITY.md)**.

## Why this exists

Our scrapers today mostly parse HTML (Playwright for ikman/house.lk, httpx+BS4 for LPW/onlineproperty). Several sources already expose structured JSON that the site itself uses — hitting those is faster, richer, and less brittle than card DOM scraping.

## Verdict (2026-07-19)

| Source | API usable for listings? | Best entry point | Notes |
|---|---|---|---|
| **ikman.lk** | **Yes — strongest** | `https://api.ikman.lk/v1/serp` | Full SERP + ad detail JSON; no browser needed for list/detail |
| **LankaPropertyWeb** | **Yes — strong** | `/api/v3/search2` | JWT + `secure_key` embedded in HTML; includes lat/lon, beds, price |
| **onlineproperty.lk** | **Partial** | `/wp-json/wp/v2/rtcl_listing` | WP REST works (~206 listings). Dedicated `/rtcl/v1/*` returns `DENIED_REST_API` |
| **house.lk** (ex-lamudi) | **No (from this environment)** | — | Cloudflare challenge blocks plain HTTP; keep Playwright |

## Layout

```
docs/source-apis/
├── README.md              # this file
├── ETHICS.md
├── ikman/
│   ├── README.md
│   └── samples/
├── lpw/
│   ├── README.md
│   └── samples/
├── onlineproperty/
│   ├── README.md
│   └── samples/
└── house/
    └── README.md
scripts/
└── probe_source_apis.py   # polite live verifier
```

## Quick probe

```bash
python3 scripts/probe_source_apis.py
```

Writes a short report to stdout and refreshes truncated samples under `docs/source-apis/*/samples/` when probes succeed.

## Integration notes (for scrapers)

- **ikman**: Prefer `api.ikman.lk` over Playwright list pages. Detail enricher can call `GET /v1/ads/{id}` instead of parsing `window.initialData`.
- **LPW**: Prefer `/api/v3/search2` over HTML card parsing — response already has `price`, `rooms`, `bathrooms`, `floor_area`, `land_size`, `lat`, `lon`, `region`.
- **onlineproperty**: Can switch list fetch to WP REST; price/size still live in HTML content until RTCL meta is exposed.
- **house.lk**: No change until CF can be cleared in the runner.

## Last verified

2026-07-19 (manual live probe from cloud agent).
