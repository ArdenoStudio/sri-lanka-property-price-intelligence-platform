# Empty / loading / error — property.lk B&W mono

Tokens: `--ink` / `--paper` only — **never** teal, amber, red, or green. Calm copy; one CTA max. No cards in the hero; panel = hairline ink border + paper fill (or invert for primary CTA only).

## Shared chrome
| State | Treatment |
|-------|-----------|
| Loading | Ink pulse bars / grid ghosts (opacity only). No spinner color. `prefers-reduced-motion`: static muted blocks. |
| Empty | Eyebrow · short title · one sentence · invert CTA (Clear filters / Open listings / Broaden). |
| Error | Same layout as empty; stronger ink weight on title. No alert hue. Soft fail may keep prior data + one ink banner line. |

## Surfaces
| Surface | Loading | Empty | Error |
|---------|---------|-------|-------|
| **Listings** | 8 card-shaped pulse ghosts in grid | “No listings for this filter set” → Clear filters | Banner above grid if stale data; full empty-layout if hard fail + Retry |
| **Map** | Full-bleed pulse plane in map frame (no legend chips) | “No mapped inventory for this view” → Open listings | Ink copy in frame + Retry; keep chrome, drop colored price dots |
| **Estimate** | Button label “Estimating…” + ink spinner; result slot pulse | Pre-submit: helper line only. Post-submit zero comps: “No comparable listings” → Broaden | Result slot: “Couldn’t estimate — try again” + Retry (no red icon) |

## Out of scope
Detail-page skeleton, ops/pipeline alerts, multi-CTA empty panels.
