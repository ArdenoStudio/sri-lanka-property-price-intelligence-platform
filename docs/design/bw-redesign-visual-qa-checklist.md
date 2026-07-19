# property.lk B&W redesign — visual QA acceptance

Pass on **desktop (≥1024)** and **mobile (≤390)** before merge. Fail any unchecked item.

## Surfaces
- [ ] Home, listings/filter strip, listing detail, estimate/report, map, about, saved-searches drawer, empty/loading/error, deal score, district trends, pipeline/ops strip

## Brand test (first viewport)
- [ ] `property.lk` is hero-level (Cal Sans wordmark), not nav-only or an eyebrow
- [ ] Remove the nav: page still reads as property.lk — not a generic dark SaaS shell
- [ ] No headline or secondary mark overpowers the brand wordmark

## Hero budget
- [ ] First viewport = brand + one headline + one support line + one CTA group + one full-bleed visual only
- [ ] No stats strip, schedule, address block, promo chips, overlays, badges, or cards in the hero
- [ ] Hero image/texture is edge-to-edge (not inset card, side panel, or floating media)

## No teal left
- [ ] Zero `#14b8a6` / `#5eead4` / `#0d9488` / `teal` / accent gradients in CSS, components, OG, charts, focus rings, mobile nav
- [ ] UI uses `--ink` / `--paper` (or invert) only — state via weight, pattern, invert — not hue
- [ ] Charts/deal score/deltas are grayscale; no green/amber/red traffic lights

## Desktop + mobile
- [ ] Layout holds: no horizontal clip; filter/ops strips scroll; drawers/sheets usable
- [ ] Type scale and tap targets readable; focus visible on ink/paper
- [ ] Motion: 2–3 intentional enters max; no bounce, glow, or ambient chrome noise
