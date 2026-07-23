# Methodology

How PropertyLK turns listings into medians, comparables, and deal scores. Matches `api/estimate_logic.py` and `PriceAggregator` in `api/main.py`.

## Cleaning & units

- Prices parsed from `raw_price` → LKR (`DataCleaner.parse_price`). Supports Rs/LKR, millions (`Mn`/`M`), per-perch rates.
- Size → `size_perches` and/or `size_sqft` (`parse_size`); acres → ×160 perches.
- District/city from `raw_location` + title heuristics; API sources may supply lat/lng (confidence `high`).
- Outliers: sale &lt; 500K or &gt; 2B LKR; rent bands; extreme $/perch; absurd size (`detect_outliers`).
- Short-term rentals flagged (`is_short_term`) and excluded from estimate comps.

## Monthly medians (`price_aggregates`)

`PriceAggregator.aggregate()` groups non-outlier, non-short-term listings by **district × property type × listing_type (sale|rent) × calendar month** (and optionally bedroom bucket). Stores true median (`percentile_cont`), avg/p25/p75 and `listing_count`. Re-run via `python run_aggregate.py` or admin `/trigger/process`.

Bedroom buckets: `1`, `2`, `3`, `4`, `5+` when `bedrooms` is present (migration 004). Listing-type grain: migration 008.

Sale and rent are **never mixed** in a median row.

## Deal score

Stamped on listings after aggregates (`api/deal_score.py` + SQL in `PriceAggregator`):

```text
raw = 100 * (1 - price_lkr / market_median_lkr)
deal_score = clamp(raw * sample_confidence(n), -100, 100)
```

- Peers must share **listing_type** (sale vs rent), district, and property type.
- Prefer bedroom-bucket median when that bucket has ≥5 peers; else broad same-market median (≥5).
- `sample_confidence` ramps from n=5 → 1.0 at n=15 (thin samples dampen magnitude).
- Null when: outlier, short-term, unknown listing_type, n&lt;5, no peer median, or price/median ratio outside [0.05, 20] (blocks fake ±100 from cross-market comps).
- Positive → below peer median; negative → above.

This is a **relative same-market signal**, not an appraisal.

## Estimate / comparables API

`estimate_logic.py` ranks comps with tiered filters:

| Tier | Scope |
|---|---|
| 1 | Same district, tight size band, exact bedrooms |
| 2 | Same district, looser size, ±1 bedroom |
| 3 | Same district, relaxed size/beds |
| 4 | National fallback |

Confidence scales with sample size and tier. Short-term and outlier listings are excluded. Display caps: `MAX_DISPLAY_COMPS` / `MAX_ESTIMATE_COMPS`.

## Freshness

- Scrape cadence: daily workflows for primary sources; expected_hours in `/pipeline/status` (24h ikman/LPW, 48h secondary).
- Quality SLA hours in `scraper/quality.py` (`FRESHNESS_SLA_HOURS`).
- Listing “Newest” sort uses `first_seen_at`, not last scrape touch.

## What we do not claim

- No hedonic model, no AVM accuracy warranty, no “true market value”.
- Cross-source duplicates are heuristic flags, not merged entities.
- Synthetic trend backfill (`/trigger/backfill?synthetic_demo_data=true`) is admin-only demo data — not production history.
