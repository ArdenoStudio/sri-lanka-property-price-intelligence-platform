# Ethics & usage

These notes document **public endpoints the listing sites already call from their own web apps**. They are unofficial reverse-engineering notes for our own ingestion pipeline, not a third-party product API.

## Do

- Rate-limit politely (default probe delays ≥1s; production scrapers should stay below browser-like volume).
- Cache categories/locations; they rarely change.
- Treat seller phone/email as PII — store only what the product already needs, redact in docs/samples.
- Re-probe periodically; schemas and tokens rotate.

## Do not

- Brute-force auth, OTP, chat, payment, or account endpoints.
- Replay seller contact / email-seller / create-alert endpoints for spam.
- Publish live JWT/`secure_key` values as if they were our credentials (LPW embeds a site-wide browser key; it may rotate).
- Bypass Cloudflare / captcha for house.lk in ways that violate their terms beyond normal browser automation we already use.

## Legal / ToS

Site terms still apply to the underlying data. This documentation claims no ownership of listing content. Prefer robots.txt-friendly crawl patterns and respect `Disallow` where practical for HTML paths (API hosts are often separate).
