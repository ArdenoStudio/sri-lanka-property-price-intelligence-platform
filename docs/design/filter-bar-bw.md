# FilterBar — property.lk B&W

Single horizontal control strip (scroll on mobile). No cards. Tokens: `--ink` / `--paper` only — **never teal** (`#14b8a6`).

## Fields (required)
| Control | Values | Primitive |
|---------|--------|-----------|
| `type` | All / land / house / apartment / commercial | Segmented pills (`ToggleGroup`) |
| `listing_type` | Sale / Rent (toggle off = any) | Segmented pills (`ToggleGroup`) |
| `district` | All + district list | `Select` / `Popover` + command list |
| `price` | log-range min–max LKR | `Popover` + dual slider (`Slider`) |
| `bedrooms` | Any / 1+ … 5+ | `Popover` + ink chips |

## Active = ink invert
Idle: ink text on paper, hairline border. Active / selected: **paper fill + ink text** (full invert). Selected menu rows and clear affordance use the same invert — no accent color.

## Layout & a11y
Row: type pills · listing pills · district · price · beds · Clear (when dirty). Keyboard: Tab through triggers; Esc closes; focus returns to trigger. Labels announce filter name + current value.

## Out of scope
Source, size, baths, sort, saved-search — keep on existing `Filters` until a later pass.
