# property.lk — Frontend Redesign Master Plan

**Goal:** Rebuild the dashboard UI as a strict **black-and-white** editorial product surface.  
**Brand:** `property.lk` (Cal Sans wordmark). Body/UI: Inter Variable.  
**Stack:** Vite + React 19 + Tailwind v4 + framer-motion + recharts + Leaflet + lucide.  
**Method:** 56 research/spec subagents across Ardeno UI bookmark libs + every major surface.

---

## 1. Diagnosis (why it feels bad)

Ranked problems from unbiased audit:

1. **Home is a feature dump** — hero → stats → pipeline → map → trends → filters/listings → about. No single job.
2. **Brand fails the brand test** — `property.lk` lives in the nav; the first viewport leads with “Market Intelligence” + stat cards.
3. **StatsBar is theater** — count-ups, bento tiles, teal bars, live dots before anyone can browse.
4. **Listings are demoted** — money path sits under map/trends/ops chrome.
5. **Teal accent rule is fiction** — `#14b8a6` leaks into focus, sliders, nav, chips, charts.
6. **Generic AI-dark skin** — true black + card chrome + spring motion = interchangeable fintech dashboard.
7. **Cards as the design system** — `.card` / glass / hover lifts everywhere.
8. **Abstract hero** — radial grids, not Sri Lankan place/product.

---

## 2. Design direction

| Decision | Choice |
|---|---|
| Theme | **Dark mono** (`#000` / `#0a0a0a` / white–gray ladder). Ink-on-paper only for print/report. |
| Accent | **White / ink invert** — kill teal as brand accent |
| Semantic color | Encode via **weight, pattern, contrast** — not green/amber/red |
| Cards | Default **no cards**. Rows + hairlines. Cards only when interaction requires a container |
| Hero | Full-bleed plane: brand → one subhead → one line → CTA group. No stats/overlays |
| Fonts | Keep **Cal Sans** (brand/display/prices) + **Inter Variable** (chrome). Report may use Source Serif 4 for print body |
| Motion | 3 sitewide motions only (`enter`, `feedback`, `surface`) — see `dashboard/src/lib/motion.ts` |
| Charts | **Keep recharts** — do not add Tremor |
| Map | Keep Leaflet; **Carto Dark Matter / Positron**; markers by opacity/radius, not hue rainbow |
| Icons | Keep **lucide-react**, stroke 1.5 |

### Token sketch (replace teal)

```
bg: #000 / #0a0a0a / #111
text: #f5f5f5 / #a3a3a3 / #737373 / #404040
border: white @ 8% / 14% / 22%
accent → #fff (ink)
focus → #f5f5f5 outline (no teal)
```

---

## 3. Library research (bookmark swarm)

| Source | Verdict | Use |
|---|---|---|
| **shadcn/ui** | **Adopt (selective)** | Button, Input, Select, Dialog, Sheet, DropdownMenu, Tabs, Slider, Separator, NavigationMenu, Accordion. Init carefully on Vite TW4 — merge tokens, never `--template vite` |
| **DaisyUI** | **Skip** | Theme kits fight editorial B&W |
| **Tremor** | **Skip** | Wrapper tax; keep recharts |
| **HyperUI** | **Copy-adapt** | Nav, footer, FAQ, CTA HTML/Tailwind → React |
| **Cult UI Hero Color Panels** | **Steal craft, not layout** | Optional grayscale dither/panels as atmosphere — never Cult split/badge shell |
| **React Bits** | **Cherry-pick** | BlurText, ScrollReveal, FadeContent, GlareHover (white). Skip neon/Orb/Aurora |
| **21st.dev** | **Evaluate** | Hero Monochrome, filter table, command (phase 2), empty state |
| **Shadcnblocks** | **Inspiration** | Minimal heroes/stats/FAQ/footer — skip aurora/shader blocks |
| **Watermelon UI** | **Skip platform** | Optional one-off copy only |
| **Magic UI Animated Beam** | **Replace** | Grayscale path animation via framer-motion only |
| **Apple Cards Carousel** | **Skip for now** | No hero; maybe later for district profiles |
| **FAQ / Footers (HyperUI)** | **Adopt patterns** | Specs in §5 |
| **Icons** | **Keep Lucide** | |

**Licenses (commercial OK with care):** HyperUI MIT · 21st MIT* · React Bits MIT+Commons Clause (don’t resell kit) · Cult OSS MIT · shadcnblocks needs paid EULA if used.

**NPM ADD:** `class-variance-authority`, Radix peers (via shadcn), `tw-animate-css`; optional later: `vaul`, `cmdk`, `sonner`.  
**NPM AVOID:** MUI/Chakra/Ant/Daisy/Flowbite, second chart/map/motion stacks.

---

## 4. Information architecture

| Route | One job |
|---|---|
| `/` | Brand + promise + CTAs into browse/estimate |
| `/browse` (or `#listings` interim) | Filter → scan listings |
| `/map` (or `#map` interim) | Spatial explore |
| `/listing/:id` | Decide on one property |
| `/estimate` | Price range for inputs |
| `/report` | Shareable/print estimate |
| `/trends` | District movement |
| `/about` | Trust: sources, method, freshness |

**Home keeps only:** Hero · How it works (3 steps) · Trust strip.  
**Demote off home:** Pipeline (→ About/status), Filters/Grid, Map, Trends.

*Interim:* can keep hash sections while routes land; do not keep the current mashup forever.

---

## 5. Component plan

### Kill
- Decorative purple/indigo beam chrome (restyle or delete `DataFlowBeam`)
- `RevealSection` no-op wrapper
- `ListingDetail` re-export shim (fold)
- Teal `modern-mobile-menu` accents (fold into MobileNav)
- Public-facing dense Pipeline dashboard chrome (→ thin trust strip)

### Rewrite
- `StatsBar` → post-hero type strip (no bento cards) or remove from fold-1
- `About` → one purpose block + optional grayscale beam
- `DealScore` → mono weight/pattern (`docs/design/deal-score-bw.md`)
- `DistrictTrends` / `PriceHistoryChart` → shared `chartTheme`
- Filter dual-slider chrome → ink track

### Keep + restyle
- Header / Footer / MobileNav / CurrencySwitcher
- Filters → FilterBar (`docs/design/filter-bar-bw.md`)
- ListingsGrid → **ListingRow** (not cards)
- ListingDetailPage (`docs/design/listing-detail-page-bw.md`)
- MapSection, Comparison*, Estimate, Mortgage, EMI, Report, SavedSearches, Share, Chat (demote FAB)

### New
- `HeroSection` *(seeded — see §8)*
- FAQ accordion (6 questions — sources, deal score, estimate vs asking, not a valuation, refresh cadence, how estimate works)
- Shared `chartTheme`, empty/loading/error primitives (`docs/design/empty-loading-error-bw.md`)
- Command palette → **phase 2**

Detail specs live under `docs/design/*-bw.md`.

---

## 6. Phased delivery

### Phase 0 — Foundation *(in progress on this branch)*
- Design tokens: kill teal → ink
- `motion.ts` system + spring kill-list
- `HeroSection` full-bleed brand hero
- Spec pack in `docs/design/`
- Early EstimateTool / ReportPage B&W passes (continue in Phase 4)

### Phase 1 — Shell
- Header / Footer / MobileNav / Currency → ink invert active
- Focus rings white; safe-area mobile nav
- Home = Hero only (+ thin trust strip)
- Demote StatsBar + Pipeline from first viewport

### Phase 2 — Browse
- FilterBar + ListingRow
- Listing detail mono layout
- Map grayscale tiles + mono markers
- DistrictTrends / PriceHistory shared theme
- DealScore mono encoding

### Phase 3 — Tools
- Estimate / Mortgage / EMI alignment
- Comparison tray/modal
- SavedSearches flat list
- Report print ink/paper finalize
- Chat demoted (toolbar / filter-adjacent, no glow FAB)

### Phase 4 — Structure & polish
- Split IA routes (`/browse`, `/map`, `/trends`, `/about`)
- FAQ + About rewrite
- shadcn primitives init (careful merge)
- A11y P0 + visual QA checklist (`docs/design/bw-redesign-visual-qa-checklist.md`)
- Performance budgets (lazy routes, hero image ≤200KB, chart/map chunks)
- Remove leftover cards/glows/teal via `rg '#14b8a6'`

**Migration:** section-by-section behind `VITE_NEW_UI` / `?ui=new`; Vercel previews per PR — not one big-bang flip.

---

## 7. Hero & visual

**Primary:** Licensed Sri Lanka property atmosphere photo, graded to B&W, full-bleed, soft vignette, ken-burns.  
**Fallback:** Current abstract B&W texture (no layout change).  
**Skip:** Map silhouette as hero.

Hero budget only: **property.lk** · Market Intelligence · one sentence · Browse + Map CTAs.

---

## 8. What’s already seeded (this branch)

| Artifact | Status |
|---|---|
| `docs/MASTER_PLAN_UI.md` | This document |
| `docs/design/*-bw.md` | Spec pack from swarm |
| `HeroSection.tsx` + App wire | Seed — still need StatsBar demotion |
| `lib/motion.ts` + spring removals | Seed |
| EstimateTool / ReportPage B&W | Partial — finish in Phase 3 |
| `@fontsource-variable/source-serif-4` | Added for report print body |

---

## 9. Acceptance (ship bar)

- Brand test: remove nav → first viewport still reads **property.lk**
- Zero teal in product chrome (`#14b8a6` / `#5eead4` gone from UI)
- Hero has no cards/stats/overlays
- Listings readable as rows; deal score without traffic-light hues
- Mobile: filters clear of bottom nav; map height ~240–280px
- `prefers-reduced-motion` honored
- Charts/maps have text alternatives
- Qualitative: users reach listing or estimate without “where do I start?”

---

## 10. Explicit non-goals

- Fly.io / ops UI redesign (Source Ops stays GitHub Actions)
- Marketplace features (tours, agent lead forms, listing carousels in hero)
- DaisyUI / Tremor / full Watermelon adoption
- Dual light+dark theme (print report is the only ink-on-paper surface)
- Command palette in MVP

---

## Swarm index (56 agents)

Component audits · library evals (shadcn, Daisy, Tremor, HyperUI, Cult, React Bits, 21st, Shadcnblocks, Watermelon, Magic Beam, Apple Cards) · FAQ/footer/icons · tokens/type/IA/mobile · ListingRow/FilterBar/Hero specs · cmdk/a11y/perf · Better Design Tips · detail/estimate/report/map/pipeline/chat/motion · shadcn risk · unbiased critique · competitor patterns · phases · kill list · npm · hero image · empty states · currency · saved searches · deal score · trends · about · visual QA · migration · copy · dark-vs-light · licenses · success metrics.
