# PDPA PII Leakage Audit — Current Scrapers

**Date:** 2026-04-20
**Scope:** `scraper/ikman.py`, `scraper/lpw.py`, `scraper/lamudi.py`, `scraper/detail_enricher.py`, `scraper/cleaner.py`
**Legal basis:** Sri Lanka Personal Data Protection Act No. 9 of 2022 (PDPA)

## Verdict

**Current implementation is PDPA-safe by design.** No seller phone numbers, email addresses, names, or WhatsApp links are captured or persisted to the database. Phase 1.B work should therefore be **preventive** (schema-level guard rails + documentation) rather than remedial (backfill redaction).

## Evidence

### `scraper/ikman.py`
- Captures only: `title`, `raw_price`, `raw_location`, `raw_size`, `raw_meta`, `property_type`, `listing_type`, listing URL.
- Persists `raw_json={"full_meta": raw_meta}` — the `raw_meta` dict contains ad attribute pairs (bedrooms, land size, condition etc.), not seller contact.
- No extraction of `tel:` / `mailto:` / `wa.me/` / seller name selectors.

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

### `scraper/cleaner.py`
- References `raw.description` at lines 658, 750 — this is the `RawListing.description` ORM field. Currently unpopulated by any scraper (see above). Defensive handling; no live PII path.

## Recommended Phase 1.B actions

1. **Schema guard** — add a CHECK constraint or pre-insert validator rejecting any `raw_json` containing common PII patterns:
   ```sql
   ALTER TABLE raw_listings ADD CONSTRAINT raw_json_no_pii CHECK (
     raw_json::text !~ '(\+?94\d{9}|\d{3}-\d{7}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|wa\.me/)'
   );
   ```
2. **Scraper contract test** — unit test asserting `ikman.py`, `lpw.py`, `lamudi.py` never emit keys matching `/phone|email|seller_name|contact/i` in their output dicts.
3. **Documentation** — add a `SECURITY.md` or `docs/pdpa.md` stating the PII-exclusion policy so future contributors preserve it.
4. **ToS + Privacy Policy pages** on dashboard (`dashboard/src/pages/Legal.tsx`) — still required even without stored PII, to satisfy PDPA controller disclosures around the data we DO hold (asking prices, public addresses).
5. **Retention policy** — decide and document how long `raw_listings` rows are kept; PDPA Section 5(1)(e) requires a defined retention period.

## Non-issues (do not waste cycles)

- No retroactive redaction needed — nothing to redact.
- No grep-and-regex migration against `raw_json` — already empty or `full_meta`-only.
- `listing_snapshots`, `price_aggregates`, `listings` table columns — all non-PII.

## Residual risks

- **If a future change** adds contact-detail scraping (e.g. enriching via the ikman "Show phone" endpoint), this audit is invalidated. The schema CHECK constraint above is the hard guard.
- **Geocoding** — we send address strings to Nominatim. Address of a listed property is not personal data under PDPA (it describes a property, not a data subject), but document this in the privacy policy.
- **Image URLs** — currently stored in `raw_json` for ikman. Images may contain reflections / documents / people. Out of scope for MVP; flag for Phase 6.
