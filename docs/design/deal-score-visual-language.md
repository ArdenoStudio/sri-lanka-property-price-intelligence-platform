# Nilam deal_score visual language

This spec turns `deal_score` from a raw `-100` to `+100` number into a visual system that non-experts can read quickly.

## 1. Design goals

- Explain the score in market language, not analyst language.
- Make positive vs negative direction obvious without relying on purple.
- Keep list views compact and scannable.
- Give detail views enough explanation to build trust.
- Stay readable on light atmospheric surfaces such as mist, ivory, or soft sky gradients.

## 2. Semantic model

`deal_score` is centered on `0`.

- **Positive** = asking price is **lower** than similar listings.
- **Negative** = asking price is **higher** than similar listings.
- **Near zero** = asking price is **close to the usual range**.

### Score bands

| Band | Range | User-facing label | Plain-English meaning |
|---|---:|---|---|
| Much higher | `-100` to `-35` | Much higher than similar homes | The asking price sits well above the usual range for comparable listings. |
| Higher | `-34` to `-10` | A bit higher than similar homes | The asking price is above comparable listings, but not dramatically so. |
| Typical | `-9` to `+9` | Close to the usual range | The asking price is roughly in line with similar listings. |
| Lower | `+10` to `+34` | A bit lower than similar homes | The asking price is below comparable listings without being unusually low. |
| Much lower | `+35` to `+100` | Much lower than similar homes | The asking price sits well below the usual range for comparable listings. |

## 3. Color tokens

### Core band tokens

No purple is used anywhere in the scale. The palette moves from clay -> amber -> slate -> teal -> emerald.

| Token | Hex |
|---|---|
| `deal-score-much-higher-accent` | `#c65a43` |
| `deal-score-higher-accent` | `#c98928` |
| `deal-score-typical-accent` | `#7c8ca3` |
| `deal-score-lower-accent` | `#168b96` |
| `deal-score-much-lower-accent` | `#178661` |

### Light atmospheric surface tokens

Use these when the score sits on a soft, bright, low-contrast background.

| Token | Value |
|---|---|
| `deal-surface-light-bg` | `#ffffffb8` |
| `deal-surface-light-border` | `#64748b24` |
| `deal-surface-light-shadow` | `0 12px 36px rgba(15, 23, 42, 0.08)` |
| `deal-score-much-higher-fg-light` | `#8d321d` |
| `deal-score-much-higher-bg-light` | `#c65a431c` |
| `deal-score-much-higher-border-light` | `#8d321d2e` |
| `deal-score-higher-fg-light` | `#86520e` |
| `deal-score-higher-bg-light` | `#c989281f` |
| `deal-score-higher-border-light` | `#86520e2e` |
| `deal-score-typical-fg-light` | `#526173` |
| `deal-score-typical-bg-light` | `#7c8ca31c` |
| `deal-score-typical-border-light` | `#52617329` |
| `deal-score-lower-fg-light` | `#0d5f67` |
| `deal-score-lower-bg-light` | `#168b961c` |
| `deal-score-lower-border-light` | `#0d5f672b` |
| `deal-score-much-lower-fg-light` | `#0f5f43` |
| `deal-score-much-lower-bg-light` | `#1786611c` |
| `deal-score-much-lower-border-light` | `#0f5f432b` |

### Dark surface tokens

Use these on Nilam's current dark cards.

| Token | Value |
|---|---|
| `deal-score-much-higher-fg-dark` | `#fdc5b6` |
| `deal-score-much-higher-bg-dark` | `rgba(198, 90, 67, 0.14)` |
| `deal-score-much-higher-border-dark` | `rgba(198, 90, 67, 0.28)` |
| `deal-score-higher-fg-dark` | `#f8d48a` |
| `deal-score-higher-bg-dark` | `rgba(201, 137, 40, 0.14)` |
| `deal-score-higher-border-dark` | `rgba(201, 137, 40, 0.28)` |
| `deal-score-typical-fg-dark` | `#d8e1ed` |
| `deal-score-typical-bg-dark` | `rgba(124, 140, 163, 0.12)` |
| `deal-score-typical-border-dark` | `rgba(124, 140, 163, 0.24)` |
| `deal-score-lower-fg-dark` | `#a8edf3` |
| `deal-score-lower-bg-dark` | `rgba(22, 139, 150, 0.14)` |
| `deal-score-lower-border-dark` | `rgba(22, 139, 150, 0.28)` |
| `deal-score-much-lower-fg-dark` | `#b4f2d8` |
| `deal-score-much-lower-bg-dark` | `rgba(23, 134, 97, 0.14)` |
| `deal-score-much-lower-border-dark` | `rgba(23, 134, 97, 0.28)` |

## 4. Typography tokens

| Token | Value | Usage |
|---|---|---|
| `deal-score-eyebrow` | `11px / 600 / tracking 0.16em / uppercase` | Section label: "Deal score" |
| `deal-score-list-pill` | `10px / 600` | Compact list and compare pills |
| `deal-score-value-hero` | `40px / 700 / tabular nums` | Main score in detail view |
| `deal-score-detail-title` | `15px / 600` | "A bit lower than similar homes" |
| `deal-score-body` | `13px / 400 / relaxed` | Support sentence and legend intro |
| `deal-score-legend-title` | `11px / 600` | Each legend row title |
| `deal-score-legend-range` | `10px / tabular nums` | Range labels like `+10 to +34` |

### Numeric treatment

- Always use **tabular figures** for score values and ranges.
- Always show the sign for positive values in dense contexts: `+18`.
- Show `%` whenever the numeric score appears without surrounding explanatory copy.

## 5. Component variants

### A. `deal-score-pill / list`

**Use in:** listing cards, search results, compact recommendation rows.

**Rules**

- Compact capsule, always one line.
- Dot + short phrase.
- Copy should say what it means, not what the system calls it.
- Examples:
  - `18% below similar`
  - `12% above similar`
  - `Typical range`

**Why this treatment works**

- Fast to scan beside price.
- No chart required.
- Still understandable without opening the listing.

### B. `deal-score-pill / compare`

**Use in:** comparison tray, comparison table cells, tight side panels.

**Rules**

- Shortest possible version.
- Signed value plus one-word direction.
- Examples:
  - `+22% below`
  - `-14% above`
  - `0% Typical`

### C. `deal-score-card / detail`

**Use in:** listing detail hero, report sidebars, modal summaries.

**Structure**

1. Eyebrow: `Deal score`
2. Large numeric value
3. Short factual title: `A bit lower than similar homes`
4. Support sentence: `This asking price is about 18% below similar Nilam listings.`
5. Diverging meter with center marker at `0`
6. Legend

**Why this treatment works**

- Puts the interpretation next to the number.
- Replaces vague marketing labels like "great deal."
- Makes the center point obvious.

### D. `deal-score-rail / list accent`

**Use in:** left rail or top border of cards when a score exists.

**Rules**

- Use the band accent only.
- Keep width thin (`2px`) so price remains primary.
- Never rely on the rail alone; pair it with text on at least one visible state.

## 6. Legend copy for non-experts

Use this exact intro copy wherever a full legend is shown:

> Positive scores mean the asking price is lower than similar listings. Negative scores mean it is higher. Zero means it is close to the typical range.

Legend rows:

- **Much higher than similar homes** — The asking price is well above the usual range for comparable listings.
- **A bit higher than similar homes** — The asking price is above comparable listings, but not dramatically so.
- **Close to the usual range** — The asking price is roughly in line with similar listings.
- **A bit lower than similar homes** — The asking price is below comparable listings without being unusually low.
- **Much lower than similar homes** — The asking price is well below the usual range for comparable listings.

## 7. Implementation in this repo

Shared components live in:

- `dashboard/src/components/DealScore.tsx`

Current usage:

- `ListingsGrid.tsx` -> compact list pill + colored rail
- `ListingDetail.tsx` -> detail card + legend
- `ComparisonModal.tsx` -> dense compare pill
- `ComparisonTray.tsx` -> dense compare pill
- `EstimateTool.tsx` -> dense compare pill
- `ShareButton.tsx` -> plain-English summary text

## 8. Copy guardrails

Prefer:

- "lower than similar homes"
- "higher than similar homes"
- "typical range"
- "compared with similar listings"

Avoid:

- "great deal"
- "bad deal"
- "overpriced"
- "underpriced"

Those labels sound more absolute and less trustworthy than the data supports.
