# Ethics & compliance

This project documents **public** JSON endpoints used by
[https://ikman.lk](https://ikman.lk) / `https://api.ikman.lk`. It is **unofficial**
and not endorsed by ikman or Saltside Technologies.

## Rules

1. **Public JSON only** — prefer `api.ikman.lk` over scraping HTML when possible.
2. **Polite rate limits** — default probe delay ≥ 400ms; never hammer production.
3. **No auth abuse** — `GET /v1/ads` (list) and search-saved routes need sessions.
   Do not automate sign-up, credential stuffing, or session theft.
4. **Protect sellers** — `contact_card` often contains names/phones. Redact before
   storing, publishing samples, or exposing in product APIs.
5. **No stability claims** — undocumented APIs change; always re-probe.
6. **Attribution** — when redistributing docs, keep this ethics page and MIT notice.
7. **Respect robots / ToS** — this kit is for engineering education and interoperable
   market research; abuse can get your IP blocked.

## Relationship to property.lk

[property.lk](https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform)
ingests a subset of these endpoints for Sri Lanka asking-price intelligence.
This docs kit is a **sibling** community resource that can live as its own UI
(same pattern as [cse-api-docs](https://github.com/Cookie-Cat21/cse-api-docs)).
