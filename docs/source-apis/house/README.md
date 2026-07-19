# house.lk (formerly lamudi.lk) — API probe notes

## Result (2026-07-19)

Plain HTTP from this environment hits a **Cloudflare managed challenge** (`Just a moment…`, HTTP 403) for:

- `/`, `/sale/`, `/wp-json/`, `/robots.txt`, `/sitemap_index.xml`

So we could **not** confirm a public WordPress REST or custom JSON API without a real browser session.

`lamudi.lk` / `www.lamudi.lk` returned HTTP 500 on `/wp-json/` (likely retired after rebrand).

## Current approach (unchanged)

`scraper/lamudi.py` already uses Playwright against `https://house.lk` and detail enricher reads schema.org JSON-LD + DOM chips. That remains the right path until:

1. CF allows automated access in our runners, or
2. A browser-captured XHR map (DevTools → Network while logged-out browsing) is recorded and re-probed.

## If re-probing later

After a CF clearance cookie, check:

```bash
curl -sS 'https://house.lk/wp-json/' -H "Cookie: <cf_clearance>"
curl -sS 'https://house.lk/wp-json/wp/v2/' 
# look for custom post types / property routes
```

Also watch Network for GraphQL or `/api/` XHR on `/sale/` pagination.
