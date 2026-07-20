# Historical ikman data — public sources research (2026-07-20)

## Short answer

**There is no public database of complete multi-year ikman property listings we can import as a clean market history.** ikman’s own API only exposes **current** ads. A few partial archives and research datasets exist; none replace daily scraping.

---

## What we checked

| Source | Result | Useful for property.lk? |
|--------|--------|-------------------------|
| **api.ikman.lk** | Active inventory only; no sold/archive params; oldest reachable dates ~2 months | Current catalog only |
| **Internet Archive (Wayback CDX)** | Some `/en/ad/*` snapshots exist (samples from 2013–2020+), sparse and mixed categories | Possible opportunistic HTML recovery; not a structured price DB |
| **Common Crawl** | Index exists for web crawls generally; no turnkey ikman property dump | Heavy engineering; incomplete coverage |
| **Zenodo — SL classifieds ad-matching dataset** ([15412356](https://zenodo.org/records/15412356)) | ~54k ad *pairs* from ikman + others; property ≈30%; titles/descriptions for NLP | Academic / NLP — not geo+price time series |
| **Hugging Face — Damika-7 classifieds** | ~92k ads, titles/descriptions, property among sectors | Same — text classification, not market history |
| **Gist kaveenr land dataset** (2019) | ~14.5k land rows: area, location, URL, title, perches, per-perch price | **Best sparse historic land slice** — one-time 2019 snapshot, not maintained |
| **GitHub scrapers** (randikabanura, etc.) | Tools, not published longitudinal DBs; Sheets stay private | No public history to ingest |
| **PropertyGuide / price-index APIs** | Not publicly resolvable / 404 | No |

---

## Practical takeaway

1. **Max current ikman** (location-sharded SERP + detail enrich) — this is the reliable path.
2. **Build history forward** via `listing_snapshots` every day.
3. **Optional one-offs:**
   - Import the 2019 land gist as `source=ikman_archive_2019` (low priority, sparse fields).
   - Spot-check Wayback for specific high-value URLs if needed for research — not for bulk market stats.
4. **Do not depend on** Zenodo/HF sets for price intelligence — wrong schema (paired ad text, anonymized, mixed categories).

---

## Recommended priority

```
P0  Location-sharded SERP catch-up + nightly detail enrich  ← implementing now
P1  Keep snapshots forever; mark listings inactive when unseen
P2  Evaluate 2019 land gist import (optional historical land bench)
P3  Wayback/CC experiments only if a research question needs a specific old ad
```
