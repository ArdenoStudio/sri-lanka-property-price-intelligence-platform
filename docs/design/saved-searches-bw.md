# SavedSearches — property.lk B&W

Right drawer → **flat list** (no cards, tiles, tag clouds, or teal `#14b8a6`). Tokens: `--ink` / `--paper` only. Active/selected = ink invert (paper on ink).

## Shell
Header: title “Saved Searches” · count · Close. One sticky save row under header when filters are dirty: primary **Save** / **Update** (invert) + one-line filter summary. Empty: single short line (“Save filters from the bar to reuse them here.”) — no steps, icons, or dashed panels. Status = plain ink text under header, not a tinted banner.

## List row (one job: apply)
Each search is a hairline-separated row, not a card. Primary tap/click on the row **Applies** filters and closes. Show: auto-name (truncate) · one compact summary line (district · type · listing · price · beds — omit empties) · optional muted meta (`Saved {date}` · match baseline). Current fingerprint = invert “Live” label only (no badge chrome).

## Row actions
Trailing icon buttons only (no nested panels): Bell toggle (local watch) · Trash. When watch is on and row is Live and delta > 0: muted “N new” + optional Mark seen. Never nest “New matches” explainer blocks.

## A11y & out of scope
`role="dialog"` + Esc/focus trap; row is a button or activatable listitem; Bell/Trash stop propagation. Keep localStorage-only; no WhatsApp/alerts redesign in this pass.
