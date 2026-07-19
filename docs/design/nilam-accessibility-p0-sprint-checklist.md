# Nilam rework accessibility P0 sprint checklist

This checklist turns the current WCAG P0 accessibility work into an execution order for the Nilam rework. The order is based on user risk, cross-cutting impact, and how much later work depends on earlier fixes.

## P0 definition of done

- Keyboard-only users can open, use, and close every primary flow without getting stuck.
- Focus is always visible on both dark and light surfaces.
- Modal, sheet, and drawer experiences trap focus and restore it on close.
- New light-theme text and non-text UI meet WCAG contrast minimums.
- The map and charts have equivalent non-visual paths to the same information.

## Ordered sprint checklist

### 1. Contrast audit and fixes for the new light theme

**Why first**
- This is the broadest regression surface in the rework.
- It affects reading, focus visibility, chart legibility, and component tokens used by later tasks.

**Primary scope**
- `dashboard/src/components/ReportPage.tsx`
- `dashboard/src/components/DealScore.tsx`
- `dashboard/src/lib/dealScore.ts`

**Known risk areas from the current code**
- Light report palette uses low-emphasis text on warm light backgrounds, especially small labels and chart copy:
  - `#8f8073`, `#7d7268`, `#72695f`, `#6f665d`
- Report chart labels and axis ticks are small and muted on light backgrounds.
- `DealScore` already has a `surface: 'light'` path, but those light-surface foreground and border tokens need a dedicated contrast pass before wider reuse.

**Acceptance criteria**
- [ ] Small text and body text on light surfaces meet at least 4.5:1 contrast.
- [ ] Large text meets at least 3:1 contrast.
- [ ] Non-text UI indicators, borders, and chart guides that carry meaning meet at least 3:1 where WCAG requires it.
- [ ] Confidence, status, and chart states are not communicated by color alone.
- [ ] Any updated light-theme tokens are documented and reused instead of patching one-off colors.

**Implementation notes**
- Start by defining approved light-surface text tokens and semantic chart colors.
- Fix shared light-surface primitives before touching one-off screens.
- Re-check `ReportPage` chart labels after token changes; they are likely to fail even if surrounding copy passes.

---

### 2. Visible focus rings across all primary controls

**Why second**
- The app already has a global `:focus-visible` rule, so this is a fast, high-impact pass once contrast tokens are stable.
- It also exposes controls that hide or clip focus, which helps the keyboard and dialog work that follows.

**Primary scope**
- `dashboard/src/index.css`
- `dashboard/src/components/Header.tsx`
- `dashboard/src/components/Filters.tsx`
- `dashboard/src/components/ui/MinimalSelect.tsx`
- `dashboard/src/components/MobileNav.tsx`
- `dashboard/src/components/ComparisonModal.tsx`
- `dashboard/src/components/SavedSearches.tsx`
- `dashboard/src/components/ChatWidget.tsx`
- `dashboard/src/components/ReportPage.tsx`

**Known risk areas from the current code**
- Focus styling is global but may not be sufficiently visible on light surfaces.
- Many controls are custom-styled buttons, pills, chips, and popover triggers with minimal local focus treatment.
- Some floating and rounded surfaces may visually clip outlines.

**Acceptance criteria**
- [ ] Every interactive control shows a visible keyboard-only focus state on dark and light themes.
- [ ] Focus rings remain visible against tinted, white, and translucent surfaces.
- [ ] Icon-only buttons have a focus style that is as obvious as text buttons.
- [ ] No component removes focus indication without replacing it.

**Implementation notes**
- Prefer one reusable focus token pair for dark and light surfaces instead of per-component colors.
- Test the report actions, header nav, filter pills, slider thumbs, map-adjacent actions, and dialog close buttons explicitly.

---

### 3. Focus traps and focus return for dialogs, sheets, and drawers

**Why third**
- This is the biggest keyboard blocker after visible focus.
- Several components already act like dialogs but do not appear to trap focus or consistently restore it.

**Primary scope**
- `dashboard/src/components/ComparisonModal.tsx`
- `dashboard/src/components/MobileNav.tsx`
- `dashboard/src/components/ChatWidget.tsx`
- `dashboard/src/components/SavedSearches.tsx`

**Known risk areas from the current code**
- `ComparisonModal`, `MobileNav`, and `ChatWidget` close on `Escape` and lock body scroll, but do not trap tab focus.
- `SavedSearches` behaves like a drawer but currently needs a full dialog semantics pass as well.
- Focus return to the invoking control is not consistently managed.

**Acceptance criteria**
- [ ] Opening a dialog/sheet/drawer moves focus to a meaningful element inside it.
- [ ] `Tab` and `Shift+Tab` stay within the open layer.
- [ ] `Escape` closes the layer unless the control intentionally overrides it.
- [ ] Closing restores focus to the trigger that opened the layer.
- [ ] Background content is not keyboard-reachable while the layer is open.
- [ ] Each layer has correct dialog labelling (`role`, `aria-modal`, heading or label wiring).

**Implementation notes**
- Use one shared focus-trap utility or hook for all overlays instead of four custom implementations.
- Include `SavedSearches` in the same pass even though it was not called out by name; it is the same accessibility class of problem.

---

### 4. Full keyboard support for filter controls

**Why fourth**
- Filters are a core user journey.
- The current filter bar relies on custom popovers and chip controls that look elegant but are still pointer-first in places.

**Primary scope**
- `dashboard/src/components/Filters.tsx`
- `dashboard/src/components/ui/MinimalSelect.tsx`

**Known risk areas from the current code**
- Custom select and dropdown triggers do not expose full combobox/listbox or menu-button keyboard behavior yet.
- Open state is driven by click/outside-click handlers, with limited keyboard handling.
- Range sliders need explicit keyboard QA and value announcement checks.
- Rooms and property/listing type pills need predictable tab order and clear selected state announcements.

**Acceptance criteria**
- [ ] All filter triggers are reachable and operable with keyboard alone.
- [ ] `Enter`/`Space` open controls; `Escape` closes them.
- [ ] Arrow-key navigation works inside option lists where appropriate.
- [ ] Selected values and expanded/collapsed state are announced correctly.
- [ ] Range sliders are keyboard-operable and expose useful accessible names and values.
- [ ] Clearing filters and opening saved searches work without pointer input.

**Implementation notes**
- Decide whether each custom control should behave as a menu button, listbox, or dialog; do not mix patterns.
- If a mobile filter popup behaves like a bottom sheet, reuse the dialog trap work from item 3.

---

### 5. Accessible alternative to the district map

**Why fifth**
- The map is currently a discovery aid, but it cannot be the only effective path to district exploration.
- After filters are keyboard-safe, add a non-map path that reaches the same district actions.

**Primary scope**
- `dashboard/src/components/MapSection.tsx`
- `dashboard/src/App.tsx` (district selection wiring)

**Known risk areas from the current code**
- District selection is primarily mouse-driven through `CircleMarker` interactions.
- Tooltips and popups are visual, hover-first affordances.
- The current copy tells users to click the map, which is not enough for keyboard or screen-reader users.

**Acceptance criteria**
- [ ] A keyboard-accessible list or table presents the same district choices as the map.
- [ ] The alternative view includes district name, listing volume, and average price where available.
- [ ] Selecting a district from the alternative view triggers the same filter behavior as clicking the map.
- [ ] The map section clearly describes the alternative path.
- [ ] The map is supplementary, not the only way to use district discovery.

**Implementation notes**
- The fastest P0 path is usually a synchronized district list under or beside the map, not full keyboard-enablement of Leaflet markers.
- Keep the list sorted in a useful way, such as selected district first and then listing volume.

---

### 6. Text alternatives and summaries for charts

**Why sixth**
- This is still P0 because charts communicate key insights, but it depends on the earlier contrast and focus work to avoid rework.
- Once interaction flows are usable, add equivalent text for non-visual users.

**Primary scope**
- `dashboard/src/components/DistrictTrends.tsx`
- `dashboard/src/components/PriceHistoryChart.tsx`
- `dashboard/src/components/ReportPage.tsx`

**Known risk areas from the current code**
- `DistrictTrends` and `PriceHistoryChart` rely on visual axes, tooltip inspection, and color/line treatment.
- The report chart explains its encoding visually, but lacks a direct text summary that communicates the same takeaway.
- Sparkline usage in listing cards is purely visual today.

**Acceptance criteria**
- [ ] Each chart has a concise text summary of the main takeaway.
- [ ] Screen readers can access key values without needing hover/tooltips.
- [ ] Forecast versus historical data is explained in text, not only line style.
- [ ] Report charts include a narrative summary or adjacent data block that mirrors the plotted meaning.
- [ ] Decorative sparklines are either hidden from assistive tech or paired with equivalent text already visible nearby.

**Implementation notes**
- For P0, prefer adjacent summaries and hidden descriptive text over attempting full SVG/chart keyboard interaction.
- Reuse computed metrics already present in the components to avoid maintaining duplicate logic.

## Suggested sprint sequencing

### Day 1: audit and tokens
- [ ] Audit light-theme text, chart, and semantic colors.
- [ ] Lock approved light-theme contrast tokens.
- [ ] Identify any focus ring color changes required by those token decisions.

### Day 2: focus visibility
- [ ] Apply consistent focus ring treatment to shared controls.
- [ ] QA keyboard traversal through header, report actions, filter bar, comparison tray, and listing cards.

### Day 3: overlay accessibility
- [ ] Implement shared dialog focus-trap behavior.
- [ ] Roll it through comparison, mobile nav, chat, and saved searches.
- [ ] Verify focus return paths.

### Day 4: filter keyboard completion
- [ ] Normalize keyboard behavior for custom selects, dropdowns, pills, and sliders.
- [ ] Verify announcements for current value, open state, and selected state.

### Day 5: map and chart alternatives
- [ ] Add map-adjacent district list/table alternative.
- [ ] Add chart summaries and non-visual text equivalents.
- [ ] Run final keyboard and screen-reader smoke tests across the full browse flow.

## Final P0 QA pass

- [ ] Keyboard-only pass: home -> filters -> map alternative -> listings -> comparison -> report -> chat.
- [ ] Screen-reader smoke test on one desktop browser.
- [ ] Mobile screen-reader smoke test for the bottom-sheet and drawer patterns.
- [ ] Contrast spot-check on all new light-theme surfaces and report charts.
- [ ] Regression check that no overlay leaves background content tabbable.
