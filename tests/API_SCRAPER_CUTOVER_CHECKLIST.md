# API scraper cutover + UI rework testing checklist

Scope: scraper cutover work described in `docs/source-apis/AUDIT.md`, plus UI changes around the estimate and pipeline-status surfaces.

## Required gates

- [ ] **Field-mapping unit coverage**
  - Add fixture-driven mapping tests for every new API-backed scraper path.
  - Prefer one focused file per source, for example:
    - `tests/test_lpw_api_mapping.py`
    - `tests/test_ikman_api_mapping.py`
    - `tests/test_onlineproperty_api_mapping.py` if WP REST is adopted
  - For each source fixture, assert canonical output fields used downstream:
    - `source`
    - `source_id`
    - `url`
    - `title`
    - `raw_price`
    - `raw_location`
    - `raw_size`
    - `property_type`
    - `listing_type`
    - `bedrooms` or the raw field that cleaner should prefer later
    - short-term flags when the source exposes rent-per-night or holiday categories
  - Cover the risky mapping edges called out in the audit:
    - ikman `type` -> `sale` / `rent`
    - ikman category / details -> `property_type`, bedrooms, size hints
    - LPW structured `price`, `rooms`, `floor_area`, `land_size`, `lat`, `lon`
    - onlineproperty REST `content.rendered` / `class_list` fallback parsing

- [ ] **Cleaner fixture refresh**
  - Keep fixtures minimal, source-specific, and readable.
  - Expand `tests/fixtures/` with truncated JSON or HTML payloads that represent:
    - sale house
    - sale land
    - long-term rent
    - short-term / nightly rental
    - missing-bedrooms or missing-size records
  - Reuse fixture data in both mapping tests and cleaner tests instead of repeating inline strings.
  - Extend `tests/test_cleaner.py` only where cleaner behavior actually changes:
    - district / city normalization
    - bedroom extraction fallback
    - size parsing fallback
    - short-term detection
    - outlier behavior for API-sourced price formats

- [ ] **Probe smoke**
  - Keep the live probe script as the operational smoke entry point:
    - `python3 scripts/probe_source_apis.py`
  - Add a small test file such as `tests/test_probe_source_apis_smoke.py` for non-network guardrails:
    - token extraction helpers
    - expected endpoint URLs
    - response-shape assumptions that should fail loudly if the script is rewritten incorrectly
  - Manual or CI smoke should confirm the current expectations from docs:
    - ikman public API returns `200`
    - LPW HTML bootstrap still exposes token + `secure_key`
    - onlineproperty `wp/v2/rtcl_listing` returns `200`
    - onlineproperty `rtcl/v1/listings` remains denied, and that denial is handled as expected
    - house.lk remains explicitly non-blocking for this cutover path

- [ ] **API estimate regression**
  - Keep `tests/test_estimate_logic.py` as the main regression file for tiering and ranking.
  - Keep `tests/test_estimate_endpoint_source.py` as the AST-level guard against accidental query regressions.
  - Add one response-contract regression test file, for example `tests/test_estimate_api_contract.py`, that checks:
    - `listing_type` validation still rejects non-`sale` / non-`rent`
    - short-term and outlier listings are excluded from estimate comps
    - ranked comparables are returned with:
      - `similarity_score`
      - `match_reasons`
      - `days_on_market`
      - `matched_criteria`
      - `match_tier`
      - confidence metadata
    - nationwide fallback still works when district is omitted
    - better bedroom / size data from API-backed scrapers improves, rather than breaks, tier selection
  - Treat this as the main regression gate for the cutover because better source data will directly affect estimate tiers and comparable counts.

## Optional UI smoke

- [ ] **Playwright smoke for the estimate flow** *(optional; no frontend E2E harness is configured today)*
  - Only add if the UI rework is large enough to justify a browser gate.
  - Suggested scenarios:
    - `/estimate` loads and form controls render
    - selecting property type + listing type + district enables submit
    - a mocked successful estimate response renders:
      - estimate band
      - confidence copy
      - comparable cards
    - a mocked empty response renders the "no comparable listings" state
    - a mocked error renders the failure state

- [ ] **Visual smoke** *(optional)*
  - Use only if layout stability matters for the rework.
  - Focus on:
    - estimate hero + form above the fold
    - result cards with median / low / high values
    - pipeline-status table with healthy and delayed rows
  - Keep this to a tiny snapshot set; avoid broad screenshot sprawl.

- [ ] **Pipeline status UI smoke** *(optional but useful if `PipelineStatus.tsx` changed)*
  - Mock `/public/pipeline` and verify:
    - source summary counts render
    - last probe / last success timestamps render
    - delayed rows are visually distinct
    - listing count source copy stays correct for `raw` vs `clean`

## Recommended file-level plan under `tests/`

- [ ] Keep and extend:
  - `tests/test_cleaner.py`
  - `tests/test_estimate_logic.py`
  - `tests/test_estimate_endpoint_source.py`
  - `tests/test_onlineproperty.py`
- [ ] Add if cutover work lands:
  - `tests/test_lpw_api_mapping.py`
  - `tests/test_ikman_api_mapping.py`
  - `tests/test_probe_source_apis_smoke.py`
  - `tests/test_estimate_api_contract.py`
- [ ] Add only if onlineproperty switches to API list ingestion:
  - `tests/test_onlineproperty_api_mapping.py`

## Release checklist

- [ ] Field-mapping tests pass for each cutover source.
- [ ] Cleaner tests cover any new source-specific raw formats.
- [ ] Estimate logic and endpoint regression tests pass.
- [ ] Probe smoke is run at least once against live endpoints before cutover.
- [ ] UI smoke passes if the estimate or pipeline-status experience changed materially.
- [ ] Optional visual smoke is reviewed only for screens touched by the rework.
- [ ] No test duplicates existing behavior without guarding a cutover risk.
