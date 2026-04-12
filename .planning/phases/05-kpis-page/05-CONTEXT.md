# Phase 5: KPIs Page - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Colorize the KPIs page (list + create/edit builder) with the Phase 1 Mist+Blue palette, apply Phase 2-4 premium polish (motion, border accents, detail panel), and verify KPI CRUD plus animated counter rendering end-to-end against Oracle via Playwright MCP.

</domain>

<decisions>
## Implementation Decisions

### List Page Card Treatment
- **D-01:** KPI cards get `motion.div` wrapper with `whileHover={{ y: -2 }}` and stagger entrance animation (`initial={{ opacity: 0, y: 8 }}` with `transition={{ delay: index * 0.05 }}`), matching Phase 2-4 card patterns. Replace current CSS `hover:-translate-y-0.5` with motion equivalent.
- **D-02:** Cards get `border-l-2` accent colored by aggregation type. Map in `style-constants.ts` as `KPI_AGG_COLORS`: SUM=emerald, AVG=blue, COUNT=violet, MIN/MAX=amber, COUNT_DISTINCT=teal. This groups KPIs visually by what they measure — same pattern as chart-type colors.
- **D-03:** `AnimatePresence` crossfade (200ms opacity, `mode="wait"`) on grid/list view toggle, matching Phase 3/4 pattern.
- **D-04:** Filtered empty state ("No KPIs matching...") upgraded from bare `<p>` to `Empty` component with search icon, matching Phase 3/4 pattern.
- **D-05:** KPI list rows get matching `motion.div` wrapper with stagger entrance, `border-l-2` aggregation accent, and icon container upgrade from `bg-muted/50` to `bg-primary/5 border border-primary/10` (matching Phase 2 data source row pattern).

### Builder Wizard Polish
- **D-06:** Match Phase 4 chart builder treatment: accordion step content fadeIn 150ms on open, fadeOut 100ms on close via `motion/react` with `AnimatePresence mode="wait"`. Preview area crossfade 200ms when data/config changes.
- **D-07:** Step completion checkmark scale(0→1) spring animation when a step is fully filled. Matches Phase 4 chart builder step completion pattern.
- **D-08:** Builder preview KPI card gets entrance animation when dataset is selected and data loads — fade + scale spring on the `KpiPreviewCard`.

### Detail Panel Polish
- **D-09:** Full mirror of Phase 4 chart detail panel: Sheet entrance animation (slide + fade via `motion/react`), section header icons (Gauge for KPI overview, Database for dataset info, Hash for metric/aggregation, Settings2 for format/trend/threshold config), sticky footer with Edit + Delete buttons.
- **D-10:** Detail panel Sheet gets threshold-colored `border-l-2` accent — using the live computed threshold level (green/amber/red/muted) from the KPI's current value. This is appropriate in the detail panel context where you're inspecting a specific KPI, unlike the library cards where it would be misleading.

### Colorization & Theme
- **D-11:** Threshold colors already use proper `dark:` variants in `kpi-utils.ts` — `text-green-600 dark:text-green-400`, `text-amber-600 dark:text-amber-400`, `text-red-600 dark:text-red-400`. Verify these survive the palette application with no regressions.
- **D-12:** `KpiPreviewCard` trend arrow colors use explicit `dark:` variants — already correct. No changes needed.
- **D-13:** All KPI page components must use Shadcn CSS variable colors only — no hardcoded hex/rgb/hsl. Every element works in both light and dark mode.

### CRUD & Rendering Verification
- **D-14:** Full KPI lifecycle verified via Playwright MCP against live Oracle: create new KPI → select dataset (step 1) → pick metric column + aggregation (step 2) → configure number format (step 3) → set trend comparison (step 4) → configure thresholds (step 5) → save → verify animated counter renders with real Oracle data → verify threshold color applied correctly → edit KPI → delete KPI. Both light and dark mode.
- **D-15:** Verify all aggregation types produce correct values: SUM, AVG, COUNT, MIN, MAX, COUNT_DISTINCT. Each must compute correctly against real Oracle query results.

### Claude's Discretion
- Exact animation timing and easing curves for builder step transitions
- Aggregation-to-color mapping assignments (suggested SUM=emerald, AVG=blue, COUNT=violet, MIN/MAX=amber, COUNT_DISTINCT=teal but flexible)
- Detail panel section layout and metadata field arrangement
- Builder preview animation specifics (fade vs scale vs slide)
- Whether the aggregation badge on cards gets the accent color treatment too

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — KPI-01 through KPI-05
- `.planning/ROADMAP.md` — Phase 5 details, success criteria, known risks/gotchas

### Prior phase context
- `.planning/phases/01-infrastructure-cutover/01-CONTEXT.md` — Oracle setup, Mist+Blue palette, `--series-1..8` CSS vars, chart-themes.ts
- `.planning/phases/02-settings-page/02-CONTEXT.md` — Premium polish patterns (AnimatedStatusBadge, card hover lift, border-l accent, motion/react conventions, detail panel Sheet, icon container `bg-primary/5`)
- `.planning/phases/03-datasets-page/03-CONTEXT.md` — style-constants.ts shared constants, card stagger entrance, AnimatePresence crossfade, filtered empty state, section header icons
- `.planning/phases/04-charts-page/04-CONTEXT.md` — Chart type color map, builder wizard motion, step completion checkmark, detail panel mirror, help sheet pattern

### KPI frontend (key files to read)
- `frontend/src/components/kpis/kpi-library-list.tsx` — List with grid/list toggle, search, dataset filter, empty states
- `frontend/src/components/kpis/kpi-library-card.tsx` — Card with CountAnimation, threshold colors, aggregation badge, trend subtitle
- `frontend/src/components/kpis/kpi-library-row.tsx` — Row with Gauge icon, aggregation badge, dataset name
- `frontend/src/components/kpis/kpi-library-toolbar.tsx` — Search, dataset filter, view toggle, New KPI button
- `frontend/src/components/kpis/kpi-detail-panel.tsx` — Sheet with live KPI preview, metadata, edit/delete
- `frontend/src/components/kpis/kpi-preview-card.tsx` — Standalone KPI card with CountAnimation + trend arrows
- `frontend/src/components/kpis/kpi-builder.tsx` — 5-step accordion builder (dataset, column, format, trend, thresholds)
- `frontend/src/components/kpis/kpi-builder-preview.tsx` — Live preview in builder
- `frontend/src/components/kpis/delete-kpi-dialog.tsx` — Delete confirmation dialog

### KPI builder steps
- `frontend/src/components/kpis/builder/step-dataset.tsx` — Dataset selection
- `frontend/src/components/kpis/builder/step-column.tsx` — Metric column + aggregation
- `frontend/src/components/kpis/builder/step-format.tsx` — Number format config
- `frontend/src/components/kpis/builder/step-trend.tsx` — Trend comparison config
- `frontend/src/components/kpis/builder/step-thresholds.tsx` — Threshold levels config

### KPI utilities
- `frontend/src/lib/kpi-utils.ts` — computeAggregation, getThresholdLevel, THRESHOLD_STYLES, THRESHOLD_BG_STYLES, getTrendSubtitle
- `frontend/src/lib/kpi-aggregator.ts` — Client-side KPI aggregation for cross-filter
- `frontend/src/components/shared/count-animation.tsx` — Animated counter component (motion/react)

### Hooks
- `frontend/src/hooks/use-managed-kpis.ts` — KPI CRUD hooks (list, get, create, update, delete)
- `frontend/src/hooks/use-managed-datasets.ts` — Dataset list for KPI builder dataset picker

### Shared infrastructure
- `frontend/src/lib/style-constants.ts` — Shared style maps (add KPI_AGG_COLORS here)
- `frontend/src/index.css` — Global palette CSS variables
- `frontend/src/types/managed-kpi.ts` — KPI TypeScript types (RecvizKpi, AggregationType, KpiFormatConfig, TrendConfig, ThresholdConfig)
- `frontend/src/types/formatting.ts` — FormatNumberOptions, FormatType

### Backend
- `backend/app/api/managed_kpis.py` — KPI CRUD endpoints
- `backend/app/db/models/kpi.py` — RecvizKpi ORM model

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CountAnimation` (shared): Animated counter with motion/react — already used in KPI cards and preview. Working correctly.
- `kpi-utils.ts`: THRESHOLD_STYLES with proper `dark:` variants, THRESHOLD_BG_STYLES, computeAggregation, getThresholdLevel — complete utility set.
- `KpiPreviewCard`: Standalone KPI card component with counter, trend arrows, threshold coloring — reusable in builder preview and detail panel.
- `style-constants.ts` (Phase 3): Shared style map home — add KPI_AGG_COLORS alongside CHART_TYPE_COLORS.
- `Empty` component: Already used for "No KPIs yet" empty state — reuse for filtered empty state.
- `motion/react`: Already in project deps, used in page transitions and other phases.

### Established Patterns
- Card hover lift: `motion.div` with `whileHover={{ y: -2 }}` (Phase 2/3/4)
- Border-l accent: `border-l-2 border-l-{color}` on cards/rows (Phase 2/3/4)
- AnimatePresence crossfade: `mode="wait"` with opacity for view toggles (Phase 3/4)
- Stagger entrance: `initial={{ opacity: 0, y: 8 }}` with `transition={{ delay: i * 0.05 }}` (Phase 3/4)
- Section header icons: Lucide icon + primary-tinted accent (Phase 3)
- Detail panel: Sheet with sticky footer, section headers, metadata grid (Phase 2/4)
- Builder accordion motion: fadeIn/fadeOut on step open/close (Phase 4)
- Step completion checkmark: scale(0→1) spring animation (Phase 4)

### Integration Points
- `style-constants.ts`: Add `KPI_AGG_COLORS` mapping aggregation types to Tailwind colors
- `kpi-library-list.tsx`: Wrap card/row renders in motion.div, add AnimatePresence
- `kpi-library-card.tsx`: Add motion wrapper, border-l-2 aggregation accent
- `kpi-library-row.tsx`: Add motion wrapper, border-l-2 accent, upgrade icon container
- `kpi-builder.tsx`: Add motion to accordion step transitions
- `kpi-detail-panel.tsx`: Add Sheet motion entrance, section header icons, threshold accent

</code_context>

<specifics>
## Specific Ideas

- Aggregation type colors give KPIs a unique visual identity in the library — you can scan by "what kind of metric is this" at the card edge, same way chart library shows "what kind of chart" at the card edge
- The 4-column grid works well for KPIs — cards are smaller than chart cards (no thumbnail area). Keep it.
- Threshold colors on the counter value are the right place for live status — the card accent should be aggregation type (stable categorization), not threshold (volatile live value)
- Detail panel IS the right place for threshold-colored accent since you're inspecting a specific KPI
- Builder is simpler than chart builder (5 steps but simpler fields) — same motion treatment but less complexity

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-kpis-page*
*Context gathered: 2026-04-13*
