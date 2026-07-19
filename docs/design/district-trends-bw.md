# DistrictTrends — property.lk B&W chart

Paper ground, ink series. `--ink` / `--paper` only — **never teal** (`#14b8a6`) or green/red deltas. Use shared `chartTheme` (`dashboard/src/lib/chartTheme.ts`); no hardcoded chart hex in the component.

## `chartTheme` (shared with PriceHistoryChart)
| Token | Role |
|-------|------|
| `axis` / `grid` | Muted ink ticks; hairline horizontal grid only |
| `series` / `seriesFill` | Ink stroke; ink→transparent area gradient |
| `forecast` | Dashed muted-ink line (no fill) |
| `tooltip` / `cursor` / `dot` | Paper panel + ink type; muted cursor; paper fill + ink stroke activeDot |

## Chrome
Flat band (no card): eyebrow · district · median + % as ink weight/arrow only. Empty/loading = plain ink copy. Out of scope: regression math, EmptyStatePanel copy, ReportPage charts.
