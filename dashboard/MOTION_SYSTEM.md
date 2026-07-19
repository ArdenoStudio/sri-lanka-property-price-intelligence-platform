# property.lk motion system

Brand is **property.lk**. Motion direction below defines the tighter system for the product UI.

## Goal

Use only 3 intentional sitewide motions:

1. Entrance
2. Hover / focus feedback
3. Page transition

Everything else should either be static, CSS-only utility feedback, or removed.

The current app already has a good low-motion base in `src/components/RevealSection.tsx` and the CSS motion tokens in `src/index.css`. The main issue is motion density: too many independent components animate at once, and Framer Motion is paying a shared bundle cost for interactions that could be handled with CSS.

## The system

### 1) Entrance motion

Use one entrance style across the product:

- Pattern: opacity + translateY
- From: `opacity: 0`, `translateY(12px to 16px)`
- To: `opacity: 1`, `translateY(0)`
- Duration: `320ms to 420ms`
- Ease: `cubic-bezier(0.22, 1, 0.36, 1)`
- Frequency: once per section or route, never per child item

Use it for:

- hero content
- major section wrappers
- modal or drawer content when opened by user action

Do not use it for:

- every card in a grid
- icons
- badges
- repeated stat cells
- decorative sweeps

### 2) Hover / focus motion

Use one interaction pattern:

- Pattern: subtle lift or tint only
- Properties: background-color, border-color, opacity, translateY(-1px to -2px)
- Duration: `120ms to 160ms`
- Ease: same spring-like curve as above

Rules:

- CSS only
- no bounce
- no elastic scale on cards
- no rotating or pulsing icons unless they signal live status or a state change

### 3) Page transition

Replace long branded loading motion with a fast route transition:

- Pattern: short fade or veil between routes
- Duration: `180ms to 240ms`
- Properties: opacity only, or opacity + very small Y shift
- Scope: route change only
- First load: no blocking intro animation

This should communicate continuity without delaying content.

## Keep / kill audit

### Keep

#### Keep: `RevealSection`

- Files:
  - `src/components/RevealSection.tsx`
  - `src/App.tsx`
  - `src/index.css`
- Why:
  - It already matches the desired entrance motion.
  - It is CSS-led and only uses `IntersectionObserver`.
  - It is the best candidate for the single sitewide entrance rule.

#### Keep: card and control hover transitions

- Files:
  - `src/index.css`
  - `src/components/ListingsGrid.tsx`
  - `src/components/StatsBar.tsx`
- Why:
  - Most hover behavior is already subtle and CSS-based.
  - This supports the hover/focus rule with minimal runtime cost.

#### Keep, but classify as utility motion rather than brand motion

- Files:
  - `src/components/ComparisonTray.tsx`
  - `src/components/ComparisonModal.tsx`
  - `src/components/SavedSearches.tsx`
- Why:
  - Enter/exit motion is useful here because these components change layout context.
  - They should share the same timing curve and stay minimal.
  - They are not sitewide brand signatures.

### Kill

#### Kill: `PageLoader`

- File:
  - `src/components/PageLoader.tsx`
- Why:
  - It blocks the app with a default `minDuration` of 1800ms.
  - It adds branding, progress, fade, and overlay motion before content appears.
  - It duplicates atmospheric styling already present elsewhere.
  - It is the wrong place to express brand motion on mobile.

Replace with:

- no blocking intro on first paint
- fast route transition between pages

#### Kill: `NoiseOverlay`

- Files:
  - `src/components/NoiseOverlay.tsx`
  - `src/index.css`
- Why:
  - Full-viewport fixed texture adds visual activity everywhere.
  - It is decorative, not communicative.
  - It competes with content contrast on small screens.
  - The loader also mounts another overlay instance, doubling the effect during intro.

Recommendation:

- desktop only if the brand truly needs it
- off on mobile by default

#### Kill: `ScrollProgressBar`

- Files:
  - `src/components/ScrollProgressBar.tsx`
  - `src/index.css`
- Why:
  - It writes style on every scroll event.
  - It adds constant motion to a page that already has section reveals and sticky nav behavior.
  - It does not add much informational value for this IA.

#### Kill: `CustomCursor`

- File:
  - `src/components/CustomCursor.tsx`
- Why:
  - It runs a continuous RAF loop.
  - It is not currently mounted.
  - It is decorative and desktop-only.
  - It should not be revived in a reduced-motion system.

Recommendation:

- remove the file if it is truly unused

#### Kill: header morphing as brand motion

- File:
  - `src/components/Header.tsx`
- Why:
  - The fixed nav already has strong presence.
  - Scroll-linked border radius, padding, logo scale, and tagline collapse create persistent motion near the top of the viewport.
  - This is especially noticeable on mobile and during quick scrolls.

Recommendation:

- keep the sticky header
- remove or drastically simplify the scroll morph
- keep only static state shifts if needed

#### Kill: footer blueprint reveal + stagger

- File:
  - `src/components/Footer.tsx`
- Why:
  - The footer is carrying its own animated blueprint grid, parent reveal, and staggered children.
  - This is a lot of motion for a low-priority area.
  - It adds bundle cost for a section that can feel premium while static.

Recommendation:

- keep the layout and art direction
- make it static

#### Kill: chart sweep reveal

- File:
  - `src/components/DistrictTrends.tsx`
- Why:
  - The gradient sweep plus chart entrance animation is ornamental.
  - Data viz already has enough visual complexity.
  - Motion in charts should clarify change, not decorate load.

Recommendation:

- keep the chart
- remove the sweep
- keep any chart animation very short, or disable on mobile

#### Kill: repeated dropdown mount animations

- Files:
  - `src/components/ui/MinimalSelect.tsx`
  - `src/components/Filters.tsx`
  - `src/components/CurrencySwitcher.tsx`
  - `src/components/Header.tsx` tooltip
- Why:
  - The same enter/exit recipe appears across many small controls.
  - Each one is acceptable on its own; together they create motion noise.
  - These interactions do not justify a shared `vendor-motion` chunk on the landing route.

Recommendation:

- replace with CSS opacity/translate transitions where possible
- reserve JS motion for modal, tray, or route context changes

## Framer Motion audit

Current state:

- Framer Motion is imported in 13 components under `src/components`.
- The production build emits `dist/assets/vendor-motion-*.js` at about:
  - `133.91 kB` raw
  - `44.01 kB` gzip

Interpretation:

- This is too expensive for a system that wants only 2 to 3 intentional motions.
- If the sitewide system becomes CSS-first, Framer Motion can either:
  - disappear from the landing route, or
  - be limited to genuinely spatial components such as modal or tray surfaces

## Mobile performance budget

These are the constraints Nilam should hold itself to on mobile:

- Initial route animation JS budget:
  - target `0 kB`
  - hard ceiling `<= 20 kB gzip`
- Continuous animation budget:
  - `0` always-on RAF loops after first paint
  - `0` decorative scroll-linked transforms outside essential UI
- Full-screen decorative layers:
  - `0` on mobile
  - at most `1` on desktop
- Simultaneous animated elements above the fold:
  - max `3`
- Duration caps:
  - hover/focus: `120ms to 160ms`
  - entrance: `320ms to 420ms`
  - page transition: `180ms to 240ms`
  - modal/drawer utility motion: `220ms to 280ms`
- Animated properties:
  - allow: `opacity`, `transform`
  - avoid: `height`, `filter`, `backdrop-filter`, `box-shadow`, `background-size`, complex SVG effects
- Reduced motion:
  - all non-essential motion off
  - allow instant state changes or very short opacity fades only

## Cal Sans reveals

There is no Cal Sans usage in the current codebase; typography is still centered on Geist in `src/index.css`.

If Nilam adopts Cal Sans, use it as a reveal surface, not as a general UI font.

### Recommended use

Use Cal Sans only for:

- hero headline
- route title or page transition wordmark
- occasional section heading where brand emphasis matters

### Reveal behavior

- one line or two lines max
- reveal the whole line or word group
- no per-character stagger
- no marquee or looping motion
- duration `320ms to 420ms`
- pair with a slight upward fade only

### Implementation guidance

- self-host the font
- keep body UI in Geist
- do not animate letter-spacing, font-weight, or blur
- treat Cal Sans as a static display asset with one entrance reveal

## Suggested implementation order

1. Remove `PageLoader` from the default route flow.
2. Remove `NoiseOverlay` and `ScrollProgressBar` from the app shell.
3. Simplify `Header` and `Footer` to mostly static surfaces.
4. Replace repeated Framer dropdown animations with CSS transitions.
5. Keep `RevealSection` as the single sitewide entrance pattern.
6. Add a short route transition if brand continuity still feels needed.

## Success criteria

The site should feel:

- quieter
- more premium
- more editorial
- less "tech demo"
- faster on mobile

If motion is working, users should remember the information hierarchy and typography, not the animation system.
