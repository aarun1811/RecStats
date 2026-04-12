# Phase 4: Charts Page - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Colorize the Charts page (list + builder wizard), audit and fix hard-coded hex in chart wrappers, render live ECharts thumbnails, expand the builder's appearance step with chart-type-specific config, add chart-type config help (tooltips + help sheet), audit chart config capture/rendering gaps, verify all AG Charts + ECharts types render with the new palette, and investigate/fix console errors.

</domain>

<decisions>
## Implementation Decisions

### Card Accent Color
- **D-01:** Chart cards get `border-l-2` accent colored by chart type, using `--series-1..8` CSS variables from Phase 1. Map chart types to series vars in `style-constants.ts` as `CHART_TYPE_COLORS`.
- **D-02:** Chart type pill on thumbnails gets a color-coded background matching the chart-type series color at low opacity (e.g. `bg-[var(--series-1)]/15`). Replaces current neutral `bg-background/80` pill.
- **D-03:** Cards get `motion/react` hover lift `whileHover={{ y: -2 }}` and stagger entrance animation (50ms per card) — matching Phase 2/3 card treatment.
- **D-04:** `AnimatePresence` crossfade (200ms opacity) on grid/list view toggle — matching Phase 3 pattern.
- **D-05:** Filtered empty state ("No charts matching...") upgraded from bare `<p>` to `Empty` component with search icon — matching Phase 3 pattern.

### Builder Wizard Polish
- **D-06:** Full motion in the 4-step accordion builder: content fadeIn 150ms on open, fadeOut 100ms on close, preview area crossfade 200ms when chart type/mapping changes, step completion checkmark scale(0->1) spring animation. All via `motion/react` with `AnimatePresence mode="wait"`.
- **D-07:** Inline tooltips on every mapping field (Category, Metrics, Color Key, Size Key, etc.) that explain what the field does for THIS specific chart type. Plus a help sheet button that opens a right-side Sheet with chart-type-specific configuration reference (required fields, optional fields, aggregation behavior, example mappings) — mirrors Phase 3 column metadata help sheet pattern.

### Appearance Step Expansion
- **D-08:** Appearance step gains chart-type-specific fields rendered conditionally based on `chartType`:
  - Heatmap: color range (min/max colors)
  - Gauge: min/max value, color band thresholds
  - Treemap: color key column selector, color range
  - Waterfall: positive/negative colors
  - Pie/Donut: inner radius (donut only), label position
  - Scatter: size key column, point shape
  - Default (line, bar, area, etc.): legend + axis toggles (current behavior)

### Hard-Coded Hex Migration
- **D-09:** Gauge semantic colors in `echart-wrapper.tsx` replaced with CSS variable reads: `--chart-negative` (red), `--chart-warning` (amber), `--chart-positive` (green). Define these semantic chart tokens in `index.css` using existing palette values.
- **D-10:** Treemap `colorRange` in `ag-chart-wrapper.tsx` replaced with `--series-1` and `--series-2` CSS variable reads via `getComputedStyle()`.
- **D-11:** Reuse or extend the existing `getCssVar()` helper pattern from `chart-themes.ts` for all CSS variable reads in chart wrappers.

### Stored Chart Config Audit
- **D-12:** Audit all stored chart config JSON in `recviz_charts.config` (via seed data) for stale hex color overrides. Write a migration/seed update to replace hardcoded hex with CSS var references or remove stale overrides so charts pick up palette colors.

### Chart Config Capture/Rendering Audit
- **D-13:** Wave 1 produces a chart-type config reference file documenting: each chart type -> required config fields -> what the builder currently captures -> what the renderer currently applies -> gaps. This audit file drives subsequent waves to fix capture and rendering gaps.
- **D-14:** Subsequent waves fix the identified gaps — ensuring the builder wizard properly captures all config needed for each chart type, and the rendering code (ag-chart-wrapper, echart-wrapper) properly reads and applies all stored config.

### ECharts Thumbnail Gap
- **D-15:** ECharts cards (Sankey, Radar, Gauge, Funnel, Network, Parallel) get live thumbnail rendering in grid cards — same data-fetching + rendering approach as AG Charts cards. EChartWrapper already supports rendering; wire it into the card component.

### Detail Panel
- **D-16:** Full mirror of Phase 2 data-source detail panel: sheet entrance animation (slide + fade via `motion/react`), section header icons (Database, Layers, Calendar, LayoutDashboard, FileText), chart-type-colored `border-l-2` accent on the sheet, sticky footer with Edit + Delete.

### Console Error Investigation
- **D-17:** Investigate the 7 errors and 72 warnings seen on the Charts page. Triage chart-related errors/warnings and fix as part of this phase's discover-and-fix scope (CHRT-07). Non-chart warnings (React, TanStack) logged in USAGE-TRACKER but not fixed.

### Claude's Discretion
- Exact animation timing and easing curves for builder step transitions
- Chart-type to `--series-N` mapping assignments (which type gets which series number)
- Help sheet content depth and organization for chart-type config reference
- ECharts thumbnail sizing and interaction blocker approach
- How to handle chart types beyond 8 when mapping to `--series-1..8` (cycle or use semantic tokens)
- Exact chart-type-specific appearance field implementations (UI component choices)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — CHRT-01 through CHRT-08
- `.planning/ROADMAP.md` — Phase 4 details, success criteria, known risks/gotchas

### Prior phase context
- `.planning/phases/01-infrastructure-cutover/01-CONTEXT.md` — Oracle setup, Mist+Blue palette, `--series-1..8` CSS vars, chart-themes.ts rewiring, AG Grid token bridge
- `.planning/phases/02-settings-page/02-CONTEXT.md` — Premium polish patterns (AnimatedStatusBadge, card hover lift, border-l accent, motion/react conventions, detail panel Sheet treatment)
- `.planning/phases/03-datasets-page/03-CONTEXT.md` — style-constants.ts extraction, card stagger entrance, AnimatePresence crossfade, column metadata help sheet, filtered empty state upgrade, section header icons

### Chart components (key files to read)
- `frontend/src/components/charts/chart-factory.tsx` — AG Charts vs ECharts routing by vizType
- `frontend/src/components/charts/ag-chart-wrapper.tsx` — AG Charts rendering, treemap colorRange hex at line 159
- `frontend/src/components/charts/echart-wrapper.tsx` — ECharts rendering, gauge hex at lines 144-146
- `frontend/src/components/charts/chart-builder.tsx` — 4-step accordion wizard with preview
- `frontend/src/components/charts/builder/step-appearance.tsx` — Current appearance options (legend, axis toggles only)
- `frontend/src/components/charts/builder/step-mapping.tsx` — Column mapping step
- `frontend/src/components/charts/chart-library-list.tsx` — Grid/list view with cards, toolbar, detail panel
- `frontend/src/components/charts/chart-library-card.tsx` — Card with live thumbnail, chart type pill
- `frontend/src/components/charts/chart-library-row.tsx` — List view row
- `frontend/src/components/charts/chart-detail-panel.tsx` — Right-side Sheet with chart preview + metadata
- `frontend/src/components/charts/chart-library-toolbar.tsx` — Search, filters, view toggle, New Chart

### Shared infrastructure
- `frontend/src/lib/chart-themes.ts` — CSS variable reads for chart colors, HEX_FALLBACKS
- `frontend/src/lib/style-constants.ts` — Shared style maps (BACKEND_COLORS, STATUS_STYLES, column role/type colors)
- `frontend/src/index.css` — Global palette CSS variables including `--series-1..8`
- `frontend/src/types/managed-chart.ts` — Chart type definitions, ChartAppearance, ChartColumnMapping

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `chart-themes.ts`: Already has `getComputedStyle()` CSS var reading pattern with HEX_FALLBACKS — extend for gauge/treemap hex replacement
- `style-constants.ts`: Shared style map home from Phase 3 — add CHART_TYPE_COLORS here
- `Empty` component: Already used in chart-library-list.tsx for "No charts yet" — reuse for filtered empty state
- `ChartFactory`: Clean routing between AG Charts and ECharts — no changes needed to factory itself
- `motion/react`: Already in project deps, used extensively in Phase 2/3 — apply same patterns
- `chart-type-icon.tsx`: Has `CHART_DISPLAY_NAMES` map — extend with color mappings

### Established Patterns
- Card hover lift: `whileHover={{ y: -2 }}` via `motion.div` (Phase 2/3)
- Border-l accent: `border-l-2 border-l-{color}` on cards/rows (Phase 2/3)
- AnimatePresence crossfade: `mode="wait"` with opacity for view toggles (Phase 3)
- Stagger entrance: `initial={{ opacity: 0, y: 8 }}` with `transition={{ delay: i * 0.05 }}` (Phase 3)
- Section header icons: Lucide icon + primary-tinted accent (Phase 3)
- Help sheet: Right-side Sheet with organized sections and icons (Phase 3 column metadata)
- Detail panel: Sheet with sticky footer, section headers, metadata grid (Phase 2)

### Integration Points
- `index.css`: Add `--chart-negative`, `--chart-warning`, `--chart-positive` semantic tokens
- `style-constants.ts`: Add `CHART_TYPE_COLORS` mapping chart types to `--series-N` vars
- `chart-themes.ts`: Extend `getCssVar()` helper or add semantic chart color reads
- `step-appearance.tsx`: Expand with conditional chart-type-specific fields
- `step-mapping.tsx`: Add inline tooltips on field labels
- Builder: Add help sheet button in mapping step header

</code_context>

<specifics>
## Specific Ideas

- Chart-type color mapping uses `--series-1..8` CSS variables from Phase 1 (not Tailwind utility colors)
- Wave 1 of planning should produce a chart config audit file documenting required vs captured vs applied config per chart type — this drives subsequent implementation waves
- Builder help sheet mirrors Phase 3 column metadata help sheet pattern
- ECharts thumbnails should render live charts, not static icons

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-charts-page*
*Context gathered: 2026-04-13*
