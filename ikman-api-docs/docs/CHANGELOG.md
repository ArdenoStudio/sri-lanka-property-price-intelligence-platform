# Changelog

## 2026-07-20 — initial catalog

- Ported ikman API map into a **cse-api-docs-shaped** package (`ikman-api-docs/`).
- Catalogued public reads: `/v1/categories`, `/v1/locations`, `/v1/serp` variants,
  `/v1/ads/{id}`, plus auth-observed `/v1/ads`.
- Added polite probe harness, PII sanitization for samples, static site builder,
  curl/python examples, thin `ikman_lk` helper.
- Born from research inside
  [sri-lanka-property-price-intelligence-platform](https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform)
  (`docs/source-apis/ikman/`, `scraper/ikman_api.py`).
