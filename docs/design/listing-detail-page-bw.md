# ListingDetailPage — property.lk B&W

Paper page, ink type. Tokens: `--ink` / `--paper` only — **never teal**, amber, emerald, or per-type hues. No multi-hue chips; type / sale|rent / amenities = hairline ink pills (active = invert).

## Section order
1. Back · 2. Stale notice (if any) · 3. **Price hero** + deal score · 4. Specs row · 5. Mortgage teaser · 6. Amenities · 7. Description · 8. Price history · 9. Rental yield (sale house/apt) · 10. Map · 11. Similar rows

## Price hero
`h1` = asking price (`font-price-hero`, clamp). Under: title, location line, optional ink price-drop line. CTAs: invert primary “View source” + outline Share. No colored type chips.

## Deal score
Sibling to hero (right on `lg`, below on mobile). Band label + % in ink weight only — no clay/teal/emerald fills. Typical band = muted ink; extremes = stronger ink weight / invert badge, same two tokens.

## Mortgage teaser
Sale + `price_lkr` only: one EMI line under hero CTAs (`EMITeaser` hero). Full `MortgageCalculator` is the next major block — not a card stack of promos.

## Map
Full-width OSM embed, ink border, grayscale/inverted filter. Fallback: plain location text, no accent link color.

## Similar rows
Horizontal scroll on mobile; `sm+` 2–3 columns. Each row/card: price · place · optional deal % as ink numeral — **no** type-color or green deal chips.
