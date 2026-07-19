# PipelineStatus / Source Ops — property.lk B&W

One horizontal **ops strip** (scroll on mobile). No cards, aside, summary tiles, or “Signal note”. Tokens: `--ink` / `--paper` only — never teal or traffic-light colors.

## Mono status
`ok` | `running` | `delayed` → ink word + optional filled/hollow/dashed square (same ink). No color pills. Overall = one end label: Healthy / Running / Delayed.

## Row (scrape sources only)
| Cell | Content |
|------|---------|
| Source | Short label (ikman, LPW, …) |
| Status | Mono word above |
| Freshness | Relative `last_success` (primary); title = absolute. Fallback: `last_probe` / `last_run` |
| Listings | Count only (optional `+N` if `last_new_count`) |

Drop: SLA copy, dual absolute clocks, downstream jobs, `listing_count_source` captions.

## Layout & chrome
Hairline top/bottom rules, paper ground. Left: small “Source Ops” mark (not a hero). Right: overall + “Refreshed {generated_at}”. Body = source rows. Skeleton = same strip, ink pulse bars.

## Out of scope
Cleaner / geocoder / aggregates UI; admin Watermelon density stays off the marketing surface.
