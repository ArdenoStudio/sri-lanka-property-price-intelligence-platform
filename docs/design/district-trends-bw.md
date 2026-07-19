# DistrictTrends — property.lk B&W chart

Paper ground, ink series. Tokens: `--ink` / `--paper` only — **never teal** (`#14b8a6`) or green/red deltas. Consume shared `chartTheme` (`dashboard/src/lib/chartTheme.ts`); do not hardcode chart hex in the component.

## `chartTheme` (shared with PriceHistoryChart)
| Token | Role |
|-------|------|
| `axis` / `grid` | Muted ink ticks; hairline horizontal grid only |
| `series` / `seriesFill` | Ink stroke; ink→transparent area gradient |
| `forecast` | Dashed muted-ink line (no fill) |
| `tooltip` | Paper panel, ink type, hairline border |
| `cursor` / `dot` | Muted ink crosshair; paper fill + ink stroke activeDot |

## Chrome
Flat band (no card shell): eyebrow · district name · median + % as ink weight/arrow only (no emerald/red). Empty/loading = plain ink copy, no dashed teal panels.

## Out of scope
Regression math, EmptyStatePanel copy, ReportPage light charts.
