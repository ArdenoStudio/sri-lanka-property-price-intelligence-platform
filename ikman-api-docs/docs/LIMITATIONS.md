# Limitations

Live-probed constraints of `api.ikman.lk` (property vertical). Re-run
`python3 scripts/probe.py` after major site changes.

## Active inventory only

- SERP returns **currently listed** ads.
- There is **no** public sold / archive / deleted feed.
- Reachable `date` values typically span **weeks to ~2 months**, not years.
- `sort=date&order=asc` still only walks the same short window.

## Deep pagination fails

- Default page size ≈ **25**.
- Island-wide (or large district) SERPs often **HTTP 500** around page **450–500**,
  even with a valid `next_page_token`.
- Full catalog ingest must **location-shard** (district → city children when
  `pagination.pages` is huge).

## Pagination token

- Page 1 works with `category` (+ optional `location` / `type`).
- Page ≥ 2 almost always needs `next_page_token` from the prior response.
- Soft operational limit: prefer sharding before ~350 pages per shard.

## Incomplete attributes on SERP

- Beds / baths / size often appear as free-text `details[]` strings — or not at all.
- Floorsize / rich attributes usually require `GET /v1/ads/{id}` (`properties[]`).
- No lat/lng in the JSON we see; geocode from location names/ids separately.

## Identity & churn

- Ad ids are **24-char hex** strings.
- Ads vanish without a delete webhook — detect via “not seen in SERP”.
- `date` / `last_bump_up_date` often reflect bumps, not original post time.

## Auth-gated routes

| Path | Notes |
|---|---|
| `GET /v1/ads` | Authentication missing without Bearer |
| `GET /v1/searches` | Likely auth |

Documented as observed-only. Do not automate login.

## Unofficial

Endpoints, params, and payloads can change without notice. Treat this catalog as
a living probe, not a vendor contract.
