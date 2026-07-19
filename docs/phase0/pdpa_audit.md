# PDPA PII Leakage Audit — Current Scrapers and API Responses

**Date:** 2026-07-19
**Scope:** `scraper/ikman.py`, `scraper/lpw.py`, `scraper/lamudi.py`, `scraper/detail_enricher.py`, `scraper/privacy.py`, `api/main.py`, `scripts/push_raw_to_convex.py`
**Legal basis:** Sri Lanka Personal Data Protection Act No. 9 of 2022 (PDPA)

## Verdict

**Current implementation is PDPA-safe with explicit redaction guard rails.** We do not persist seller phone numbers, email addresses, or names from ikman `contact_card` blocks, and public-facing description responses redact obvious contact channels (phone, email, WhatsApp) before leaving the API.

## Stored-data contract

### `raw_listings`
- Store only listing metadata needed for downstream normalization:
  `source`, `source_id`, `url`, `title`, `raw_price`, `raw_location`, `raw_size`, `property_type`, `listing_type`, `scraped_at`.
- `raw_json` is allowed only for **non-contact metadata** required by the pipeline.
- For ikman specifically, any `contact_card` subtree must be sanitized before persistence. The allowed subset is limited to non-identifying metadata such as:
  - `account_type`
  - `chat_enabled`
  - `delivery_methods`
  - `opt_out`
- Do **not** persist seller names, email addresses, phone numbers, or WhatsApp links in `raw_json`.
- `description` remains unpopulated by current scrapers.

### `listings` / `listing_snapshots`
- Store normalized pricing, location, size, bedroom/bathroom, timestamps, and scoring fields only.
- `listing_snapshots.raw_json` follows the same sanitized contract as `raw_listings.raw_json`.

### Public / external responses
- Public API responses must not expose `raw_json`.
- Any free-text description returned to clients must be redacted for obvious contact channels first.
- External exports (for example Convex sync) must apply the same sanitization/redaction rules as the API.

## Evidence

### `scraper/ikman.py`
- Captures only: `title`, `raw_price`, `raw_location`, `raw_size`, `raw_meta`, `property_type`, `listing_type`, listing URL.
- Persists `raw_json` through `sanitize_ikman_raw_json(...)`.
- Current writes are still `{"full_meta": raw_meta}` plus coverage metadata, but the sanitizer is now the enforced ingress path if future ikman API payloads include `contact_card`.
- No extraction of `tel:` / `mailto:` / `wa.me/` / seller name selectors into first-class columns.

### `scraper/lpw.py`
- Persists `raw_json={}` (empty object).
- Only structured fields (price, location, size, beds, baths, URL) stored.

### `scraper/lamudi.py`
- Persists `raw_json={}` (empty object).
- Same field set as `lpw.py`.

### `scraper/detail_enricher.py`
- Line 147: reads `ad.get("description", "")` to extract numeric size (`size_perches`, `size_sqft`) via regex.
- **Description text is NOT persisted.** Only the parsed integers flow into the `listings` table.
- No other PII surfaces accessed (no contact block, no seller profile page).

### `scraper/privacy.py`
- `sanitize_ikman_raw_json(...)` recursively strips ikman `contact_card` fields down to a safe metadata subset.
- `redact_contact_channels(...)` masks obvious phone numbers, email addresses, and WhatsApp links in outbound text.

### `api/main.py`
- `GET /listings/{listing_id}` now passes `description` through `_public_description(...)` before returning it.
- This keeps any future stored descriptions from leaking direct seller contact details to public clients.

### `scripts/push_raw_to_convex.py`
- Applies the same ikman `raw_json` sanitization and description redaction before exporting records outside the primary database.

## Scraper checklist

1. **Sanitize ikman payloads before insert/update** — run `sanitize_ikman_raw_json(...)` on any data copied from ikman SERP/detail payloads into `raw_json`.
2. **Whitelist what we keep** — prefer `full_meta`, parsed bedrooms/baths, location/category ids, price metadata, and coverage tags; avoid whole-payload dumps by default.
3. **Never persist contact identifiers** — reject or strip `contact_card.name`, `contact_card.email`, `contact_card.phone_numbers`, WhatsApp links, or equivalent seller-contact fields.
4. **Treat free text as risky** — do not persist raw descriptions unless a downstream job truly needs them; if used transiently for parsing, keep only derived structured values.
5. **Keep docs/samples redacted** — repository samples and probe scripts should not retain live seller contact details.

## API response checklist

1. **No public `raw_json`** — keep `raw_json` internal/admin-only.
2. **Redact free text before response** — mask phone, email, and WhatsApp strings in descriptions or other unstructured text.
3. **Do not proxy seller contact** — if a user wants to contact a seller, send them to the source listing URL instead of restating contact details in our API.
4. **Apply the same rules to exports** — Convex, reports, and any new response surface should use the same redaction helpers.
5. **Review new endpoints against this checklist** whenever raw source payloads or free-text fields are added.

## Recommended next actions

1. **Schema guard** — add a CHECK constraint or pre-insert validator rejecting any `raw_json` containing common PII patterns:
   ```sql
   ALTER TABLE raw_listings ADD CONSTRAINT raw_json_no_pii CHECK (
     raw_json::text !~ '(\+?94\d{9}|\d{3}-\d{7}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|wa\.me/)'
   );
   ```
2. **Scraper contract test** — unit test asserting `ikman.py`, `lpw.py`, `lamudi.py` never emit keys matching `/phone|email|seller_name|contact/i` in their output dicts.
3. **Documentation** — keep this audit and `docs/source-apis/ikman/README.md` aligned with the actual storage contract.
4. **ToS + Privacy Policy pages** on dashboard (`dashboard/src/pages/Legal.tsx`) — still required even without stored seller PII, to satisfy PDPA controller disclosures around the data we do hold (asking prices, public locations).
5. **Retention policy** — decide and document how long `raw_listings` rows are kept; PDPA Section 5(1)(e) requires a defined retention period.

## Non-issues (do not waste cycles)

- No retroactive redaction needed — nothing to redact.
- No broad regex migration against stored `raw_json` — current ikman writes are `full_meta` / coverage metadata only, and new sanitizer guards future richer payloads.
- `listing_snapshots`, `price_aggregates`, `listings` table columns — all non-PII.

## Residual risks

- **If a future change** adds contact-detail scraping (e.g. enriching via the ikman "Show phone" endpoint), this audit is invalidated. The schema CHECK constraint above is still the hard guard.
- **Geocoding** — we send address strings to Nominatim. Address of a listed property is not personal data under PDPA (it describes a property, not a data subject), but document this in the privacy policy.
- **Descriptions can still contain non-contact personal details** (for example occupant names typed into the ad body). Current API/export protection only redacts obvious contact channels, not all personal context.
- **Image URLs** — if future ikman API ingestion stores them in `raw_json`, images may contain reflections / documents / people. Out of scope for MVP; flag for Phase 6.
