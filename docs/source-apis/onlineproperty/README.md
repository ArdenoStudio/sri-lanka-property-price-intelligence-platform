# onlineproperty.lk — unofficial API map

WordPress site using the **RTCL Classified Listing** plugin.

## What works

### `GET /wp-json/wp/v2/rtcl_listing`

Public WP REST collection. **~206** published listings (`X-WP-Total`) as of 2026-07-19.

```bash
curl -sSI 'https://onlineproperty.lk/wp-json/wp/v2/rtcl_listing?per_page=20&page=1'
# X-WP-Total / X-WP-TotalPages for pagination
curl -sS 'https://onlineproperty.lk/wp-json/wp/v2/rtcl_listing?per_page=20&page=1'
```

Returned fields: `id`, `slug`, `link`, `title.rendered`, `content.rendered`, `date`, `modified`, `class_list` (includes `rtcl_category-*` and `rtcl_location-*` slugs).

**Gap vs HTML scraper:** structured price/beds/size are **not** in REST `meta` (null). They appear inside `content.rendered` HTML (and category/location class names). You still need light HTML/text parsing of `content`, but you avoid fetching full category archive pages.

Sample: [`samples/wp_v2_rtcl_listing.json`](samples/wp_v2_rtcl_listing.json)

### Discovery

```bash
curl -sS 'https://onlineproperty.lk/wp-json/' | jq '.namespaces'
# includes: rtcl/v1, wp/v2, ...
```

## What is blocked

### `GET /wp-json/rtcl/v1/*`

Index is visible (`/wp-json/rtcl/v1/` lists 50+ routes including `/listings`, `/categories`, `/locations`), but calls return:

```json
{"code":"DENIED_REST_API","message":"Denied api call","data":{"status":403}}
```

Likely app-key / auth gated for the RTCL mobile API. Not usable anonymously from this probe.

## Scraper impact

Optional: list via `wp/v2/rtcl_listing` + parse `content.rendered` / `class_list` instead of category HTML pages. Volume is small (~200), so either approach is fine. Keep polite timeouts (site is slow).
