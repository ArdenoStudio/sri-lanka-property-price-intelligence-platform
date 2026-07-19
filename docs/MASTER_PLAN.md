# Nilam / Property.lk — Master Implementation Plan

**Date:** 2026-07-19  
**Branch context:** UI rework (Cal Sans + Inter) + source-API cutover + product depth for Sri Lanka  
**Method:** Four research waves (≈40 UI · ≈20 planning · ≈20 improvement · ≈20 unbiased) synthesized into one plan of record.

Related docs:

- [source-apis/AUDIT.md](source-apis/AUDIT.md) — API → pipeline mapping & cutover phases  
- [source-apis/ETHICS.md](source-apis/ETHICS.md) — polite ingest & PDPA  
- [source-apis/OBSERVABILITY.md](source-apis/OBSERVABILITY.md) — post-cutover metrics  
- [design/deal-score-visual-language.md](design/deal-score-visual-language.md)  
- [design/nilam-accessibility-p0-sprint-checklist.md](design/nilam-accessibility-p0-sprint-checklist.md)  
- [../tests/API_SCRAPER_CUTOVER_CHECKLIST.md](../tests/API_SCRAPER_CUTOVER_CHECKLIST.md)

---

## 0. One-line north star

Become the **trusted Sri Lanka property intelligence layer** — better deal signals, estimates, and district context than listing portals — with a calm Cal Sans / Inter UI and API-backed ingest that makes those signals denser.

---

## 1. Decisions of record (freeze these)

| Topic | Decision |
|---|---|
| **Brand** | Nilam (product); Property.lk as market shorthand — do not fork two brands in UI |
| **Fonts** | **Cal Sans = display only** (weight 400); **Inter Variable = body/UI**. Load once via Fontsource in `index.css` |
| **Theme** | Keep **dark atmospheric shell** for the main app; avoid purple SaaS gradients and cream+terracotta pivots |
| **Hero budget** | Brand-first Cal Sans mark, one headline, one support line, one CTA group, one full-bleed visual — **no stats strip in hero** |
| **Motion** | Kill ambient chrome (`PageLoader`, `NoiseOverlay`, `CustomCursor`, `ScrollProgressBar`); simplify `RevealSection` / beams |
| **shadcn** | Adopt only **Dialog / Sheet / Select** for now; defer Slider/Tabs packages |
| **Charts** | Keep Recharts; **do not** add Tremor or DaisyUI packages |
| **Images** | OG/share cards only; **no** list/detail hotlink or image proxy for ikman in Phase 1 |
| **Scope freeze** | No chat redesign expansion, no mortgage redesign, no comparison redesign, **no house.lk API** until CF solved — only fix beds/baths drop in `lamudi.py` |
| **Geography** | **Win Sri Lanka first**; no SEA expansion |
| **i18n fonts** | Sinhala/Tamil need Noto (or equivalent) later — Cal Sans/Inter do **not** cover those scripts |

### Feature flags (proposed)

```
USE_LPW_API
USE_IKMAN_SERP_API
USE_IKMAN_DETAIL_API
USE_LIGHT_DS              # opt-in light surfaces only where needed
USE_NEW_LISTINGS_MAP_ESTIMATE
USE_DISTRICT_PROFILES
```

---

## 2. UI library scorecard (bookmark wave)

Steal **patterns**, not stock themes. Prefer layout/interaction ideas over installing whole libraries.

| Source | Use for Nilam? | Steal | Skip |
|---|---|---|---|
| **HyperUI** | Yes (patterns) | Footer, FAQ accordion, filter layouts, clean marketing sections | Daisy-style themed kits |
| **DaisyUI** | No package | — | Component theme coupling fights our tokens |
| **Tremor** | No package | Chart spacing / empty-state patterns conceptually | Dashboard chrome; keep Recharts |
| **Shadcnblocks** | Yes (blocks) | Estimate sheet, filter bar, empty states, dialog compositions | Generic purple SaaS blocks |
| **Cult UI / Hero Color Panels** | Selective | Full-bleed hero atmosphere, brand-forward first viewport | Floating badges / hero overlays |
| **Apple Cards Carousel** | Later | District story carousel *below* fold only | Hero carousels |
| **Animated Beam / React Bits** | Minimal | One purposeful data-flow cue if needed | Ambient particle noise |
| **21st.dev** | Cherry-pick | Individual blocks after a11y review | Entire “featured” dumps |
| **Watermelon UI** | Admin only | Pipeline status density, ops tables | Marketing homepage |
| **Footers / FAQ / Icons** | Yes | Trust footer, FAQ for estimate methodology, Lucide-consistent icons | Icon rows as hero clutter |

**Property UX principles from the swarm**

1. Deal score must read in plain English (see deal-score visual language).  
2. Estimate needs confidence + comps rationale, not a single magic number.  
3. Map needs a dedicated `GET /map/listings` (cluster-friendly), not paginated `/listings`.  
4. Saved searches = high-intent retention; keep panel calm and scannable.  
5. Data trust layer: “last updated”, source coverage, sample size — near estimates/scores, not in the hero.

---

## 3. Delivery phases

### Phase 0 — Control plane (do first)

1. Add feature flags above (env + scraper config).  
2. Baseline telemetry: scrape success rate, bedroom/size fill rates, deal-score bucket coverage, Nominatim calls/day (see OBSERVABILITY.md).  
3. Lock UI design tokens: `--font-display`, `--font-body`, deal-score bands, dark atmospheric palette.  
4. Finish motion kill-list and a11y P0 checklist items.

**Exit:** Flags exist; baseline dashboard or log snapshot captured; fonts load once.

---

### Phase 1 — Data quality that makes the UI honest

Order is intentional (risk ascending):

| Step | Work | Why first |
|---|---|---|
| **1A** | `scraper/lpw_api.py` behind `USE_LPW_API` | Same `ad_id`; beds/baths/size/lat/lon already structured |
| **1B** | Geocoder short-circuit for LPW lat/lon | Cuts Nominatim cost immediately |
| **1C** | ikman **slug → hex** identity bridge | Prevents duplicate explosion when switching ids |
| **1D** | `USE_IKMAN_SERP_API` list ingest | Beds on SERP; less CAPTCHA |
| **1E** | Cleaner prefers `raw_json.bedrooms` | Deal scores get bedroom buckets without enricher |
| **1F** | `USE_IKMAN_DETAIL_API` for missing size/beds | Retire Playwright detail path after soak |
| **1G** | house.lk beds/baths card fix only | Small quality patch, no API |

Gates: [API_SCRAPER_CUTOVER_CHECKLIST.md](../tests/API_SCRAPER_CUTOVER_CHECKLIST.md).

**Exit:** LPW on API in prod (or shadowed ≥1 week); ikman SERP behind flag with bridge migration complete; bedroom fill rate ↑.

---

### Phase 2 — UI rework that rides better data

Ship in this order so each surface benefits from Phase 1 density:

1. **Design system pass** — Cal Sans headings / Inter body everywhere; remove duplicate Fontsource imports; CSS variables only.  
2. **Listings + deal score chips** — apply deal-score visual language on cards and detail.  
3. **Estimate tool** — confidence, comps reasons, methodology FAQ (HyperUI/Shadcnblocks patterns).  
4. **District profiles** — one job per section: trend, median, sample size, last updated (`USE_DISTRICT_PROFILES`).  
5. **Map** — new map endpoint + clustering; OSM school/hospital layers as **opt-in factual overlays** later.  
6. **Saved searches + alerts UX** — in-app first; WhatsApp share of estimate/deal score as growth wedge.  
7. **Empty / loading / error states** — premium calm states already started; finish consistency.  
8. **Pipeline / admin** — Watermelon-inspired density for ops only.

**Hero / marketing surfaces (if any landings exist):** brand-first, full-bleed, no stats, no cards in hero, no overlays.

**Exit:** Estimate + listings + district views feel like one composition; fonts correct; deal score readable to non-experts.

---

### Phase 3 — Trust & growth loops (Sri Lanka–native)

Prioritized from the unbiased wave; only these enter near-term backlog:

| Priority | Opportunity | Why |
|---|---|---|
| **P0** | WhatsApp share of estimate / deal score (deep link + OG + prefilled text, PDPA-safe) | Decisions already happen on WhatsApp |
| **P0** | Weekly district price digest (email first) + public district pages | SEO + forwardable trust |
| **P1** | Diaspora mode: USD approx + timezone labels + remittance *context* (not FX product) | Overseas buyers are a real segment |
| **P1** | Agent shortlists (not CRM): curated list + shareable client link + interest reactions | Differentiates vs ikman browse |
| **P1** | Branded PDF valuation *summary* (indicative, disclaimer-heavy) | Buyer/family/bank discussion aid |
| **P2** | Open data CSV of district aggregates (lagged, min cell size) | Trust layer, not moat |
| **P2** | Verified bank rate table (manual, source-linked) for mortgage calc | Safer than “live feed” claims |
| **P2** | Evidence badges (“business found”, “last checked”) — never “trusted seller” | Honesty without escrow |
| **P3** | SMS price-drop alerts (opt-in, hard caps; Twilio SL is expensive) | Only after WhatsApp/email prove demand |
| **P3** | Chrome extension deal score on ikman (user-triggered, unaffiliated) | Distribution; legal review required |
| **P3** | Sinhala + Tamil core UI (Noto fonts; Cal Sans stays Latin brand mark) | Local credibility; phase carefully |
| **Defer** | Full PWA, voice Sinhala search, flood risk scores, auction distress marketplace, B2B API, bank widgets, SEA expand, developer inventory unit-level, tourist yield precision | Revisit after Phase 1–2 soak |

**Exit:** At least WhatsApp share + district digest live or in beta; PDF optional.

---

### Phase 4 — Retire & harden

1. Retire Playwright for ikman list/detail after error budgets green.  
2. Keep Playwright only for house.lk (+ emergency flags).  
3. Weekly `scripts/probe_source_apis.py` in CI.  
4. PDPA: strip all `contact_card` / phone/email from persisted payloads (already hardening).  
5. Map clustering + rate limits + scrape observability dashboards.

---

## 4. Architecture target

```
┌──────────────────────────────────────────────────────────┐
│  Ingest (httpx)                                          │
│   LPW search2 · ikman SERP · ikman ads/{id} · OP WP REST │
│   house.lk Playwright (fallback)                         │
└───────────────────────────┬──────────────────────────────┘
                            │ RawListing + Snapshot
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Cleaner (raw_json beds/size) · Geocoder (skip if lat)   │
│  Aggregates · Deal score · Estimate comps                │
└───────────────────────────┬──────────────────────────────┘
                            │ API
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Dashboard (Cal Sans / Inter, dark atmospheric)          │
│  Listings · Estimate · Districts · Map · Saved searches  │
│  Share (WhatsApp/OG) · Report PDF · Ops pipeline         │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Success scorecard

| Area | Metric | Direction |
|---|---|---|
| Ingest | ikman success rate (CAPTCHA aborts) | ↓ aborts |
| Data | % house/apt with bedrooms | ↑ sharply |
| Data | % LPW with lat/lng pre-geocode | → ~100% |
| Cost | Nominatim calls / day | ↓ |
| Product | Deal scores with bedroom bucket (≥5 comps) | ↑ |
| Product | Estimate tier_1 / tier_2 hit rate | ↑ |
| UI | Fonts: Cal Sans display / Inter body only | Pass audit |
| UI | Hero contains no stats / cards / overlays | Pass |
| Growth | WhatsApp share CTR → estimate opens | Track |
| Trust | District digest forwards / organic district SEO | Track |

---

## 6. Explicit non-goals (next two phases)

- Becoming a listing marketplace or escrow.  
- Storing seller phones/emails from SERP for “lead gen”.  
- Installing DaisyUI / Tremor / Watermelon as app-wide kits.  
- Light-theme full pivot or purple gradient restyle.  
- SEA expansion, full CRM, live bank-rate scraping marketed as guarantees.  
- Parcel-level “safe / unsafe” flood scores.  
- house.lk API until Cloudflare session story exists.

---

## 7. Immediate next engineering commits

1. **Phase 0 flags + baseline metrics hooks.**  
2. **Phase 1A:** `scraper/lpw_api.py` + mapping tests + shadow mode.  
3. **UI DS cleanup:** single Fontsource import path; deal-score tokens on cards; finish motion removals.  
4. **WhatsApp share MVP** for estimate/deal-score pages (PDPA-safe OG).  
5. Update this plan when cutover soak numbers land.

---

## 8. Research wave log

| Wave | Agents (target) | Outcome |
|---|---|---|
| 1 — UI libraries & property UX | ~40 | Scorecard in §2; Cal Sans/Inter + dark shell; shadcn subset; hero rules |
| 2 — Planning (API + product + arch) | ~20 | Aligns with AUDIT.md Phases A–D; map endpoint; flags |
| 3 — Improvement / synthesis | ~20 | Decisions of record §1; scope freeze; sequencing §3 |
| 4 — Unbiased opportunities | ~20 | Prioritized backlog §3 Phase 3; defer list |

This document is the plan of record for the UI rework + API cutover + Property.lk usage improvements. Implementation work should reference section numbers when opening PRs.
