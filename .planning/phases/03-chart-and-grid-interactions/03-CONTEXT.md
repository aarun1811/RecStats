# Phase 3: Chart and Grid Interactions - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Add fullscreen view, chart/grid export (PNG, SVG, CSV, clipboard), manual refresh, and configurable auto-refresh to dashboard panels. Users can export, enlarge, and refresh individual charts and grids from toolbar controls on each panel.

</domain>

<decisions>
## Implementation Decisions

### Chart Toolbar Design
- **D-01:** Hover-reveal icon buttons. Small icons (export, fullscreen, refresh) appear top-right of the chart card on hover. Hidden when not hovering. Clean, uncluttered dashboard appearance that matches the premium feel.
- **D-02:** Icons: download/export (dropdown with PNG, SVG, CSV, clipboard options), fullscreen expand, refresh. Exact icon choices at Claude's discretion (Lucide React library).

### Grid Toolbar
- **D-03:** Config-data-grid panels in dashboards get a full toolbar: CSV export, Excel export, column visibility toggle, density selector (comfortable/normal/compact), and auto-size columns button.
- **D-04:** Delete dead code: `frontend/src/components/grid/data-grid.tsx` and `frontend/src/components/grid/grid-toolbar.tsx` are unused (never imported by any page/route). Remove them. Borrow the toolbar pattern for the new config-data-grid toolbar.

### Fullscreen Chart View
- **D-05:** Modal overlay using Radix Dialog (Shadcn `Dialog` component already available). Chart expands into a centered overlay. Dashboard stays underneath, dimmed. Escape key or backdrop click to dismiss.
- **D-06:** Chart re-renders at the larger modal size with the same data and filter state. Not a screenshot — a live component.
- **D-07:** Fully interactive in fullscreen. Cross-filter clicks and drill-down double-clicks work exactly as they do in the normal dashboard view. Same live component, just bigger.

### Chart Export
- **D-08:** PNG image export via AG Charts `.download()` and ECharts `.getDataURL()` + manual download trigger.
- **D-09:** SVG image export as a secondary option for vector/scalable output. AG Charts supports this natively.
- **D-10:** CSV data export — download the chart's underlying data as a CSV file with column headers and rows.
- **D-11:** Copy to clipboard — chart's underlying data as tab-separated text (paste into Excel/Sheets). Same data as CSV but to clipboard via `navigator.clipboard.writeText()`.
- **D-12:** Export current visual state (WYSIWYG). If cross-filter dimming is active, the exported image includes the dimming. What the user sees is what they get.

### Grid Export
- **D-13:** CSV export via AG Grid Enterprise `exportDataAsCsv()`.
- **D-14:** Excel export via AG Grid Enterprise `exportDataAsExcel()`.

### Manual Refresh
- **D-15:** Dashboard-level manual refresh button. Invalidates TanStack Query cache for all data sources on the dashboard and re-fetches.
- **D-16:** Keep previous data visible during refresh with a subtle loading indicator (small spinner or pulsing border on each card). Uses TanStack Query's `keepPreviousData` / `placeholderData` pattern (already configured). No skeleton reload, no blank states.
- **D-17:** On refresh failure: keep old data visible, show error toast notification ("Refresh failed: [reason]. Showing cached data."). User can retry. Previous data never disappears on error.

### Auto-Refresh
- **D-18:** Both dashboard-wide and per-chart levels. Dashboard config defines a default refresh interval. Individual charts can override with their own interval.
- **D-19:** Default interval: ~10 minutes (per requirements). Available presets: Off, 1m, 5m, 10m, 30m.
- **D-20:** Interval persisted in dashboard config JSON (not localStorage or session-only). Every user viewing the dashboard sees the same default. Per-chart overrides also in config.
- **D-21:** Auto-refresh UI design and placement is Claude's discretion — research should determine the best UX pattern (toolbar dropdown, settings panel, etc.).

### Claude's Discretion
- Auto-refresh UI design and placement (D-21 — research decides best pattern)
- Chart toolbar icon selection and hover animation timing
- Export filename conventions (e.g., `{dashboardName}-{chartTitle}.png`)
- PNG export resolution/DPI (recommend 2x for retina sharpness)
- Grid toolbar layout and component structure
- Whether per-chart refresh override uses a separate UI control or inherits from chart hover menu
- Fullscreen modal sizing (percentage of viewport), animation transition

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Chart wrappers (need ref forwarding for export)
- `frontend/src/components/charts/ag-chart-wrapper.tsx` — AG Charts wrapper. Needs ref exposed for `.download()` / `.toImage()`. Currently no ref forwarded.
- `frontend/src/components/charts/echart-wrapper.tsx` — ECharts wrapper. Has `chartRef` internally but not exported. Needs `getDataURL()` access for PNG/SVG export.
- `frontend/src/components/charts/chart-factory.tsx` — Routes to correct wrapper based on vizType.

### Dashboard components (toolbar integration targets)
- `frontend/src/components/dashboard/config-chart-grid.tsx` — Chart card structure with CardHeader. Hover toolbar icons go here.
- `frontend/src/components/dashboard/config-data-grid.tsx` — Dashboard grid, needs toolbar added (CSV, Excel, columns, density, auto-size).
- `frontend/src/components/dashboard/config-kpi-row.tsx` — KPI row, refresh affects these too.
- `frontend/src/components/dashboard/dashboard-renderer.tsx` — Main renderer, orchestrates all sections. Dashboard-level refresh button goes here.

### Dead code to delete
- `frontend/src/components/grid/data-grid.tsx` — Unused standalone breaks grid. Not imported by any page.
- `frontend/src/components/grid/grid-toolbar.tsx` — Unused toolbar. Borrow pattern then delete.

### Existing patterns to reuse
- `frontend/src/components/ui/dialog.tsx` — Radix Dialog for fullscreen modal
- `frontend/src/components/explorer/chart-builder-dialog.tsx` — Example Dialog usage pattern
- `frontend/src/lib/query-client.ts` — TanStack Query config (staleTime: 5m, gcTime: 30m, keepPreviousData)
- `frontend/src/hooks/use-data-source-query.ts` — Data fetching hook with refetch support

### Cross-filter and drill-down (must coexist with new toolbar)
- `frontend/src/hooks/use-cross-filter.ts` — Cross-filter hook, click handlers on charts
- `frontend/src/hooks/use-drill-down.ts` — Drill-down hook, double-click handlers
- `frontend/src/stores/filter-store.ts` — Cross-filter state
- `frontend/src/stores/drill-store.ts` — Per-chart drill state

### Types (need extension for toolbar/refresh config)
- `frontend/src/types/dashboard-config.ts` — DashboardConfig, DashboardChartConfig, GridConfig types
- `frontend/src/types/chart.ts` — ChartConfig, ChartWrapperProps

### Project context
- `.planning/PROJECT.md` — Project vision, constraints
- `.planning/REQUIREMENTS.md` — INTR-05 through INTR-09 requirements for this phase
- `CLAUDE.md` — Coding conventions, charting rules, tech stack, animation durations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Dialog` component (Radix-based) in `components/ui/dialog.tsx` — ready for fullscreen modal
- `ChartBuilderDialog` — example of Dialog usage with form content
- `GridToolbar` pattern (in dead code) — proven layout for toolbar buttons, can be borrowed before deletion
- AG Grid `exportDataAsCsv()` already used in explorer/query-results.tsx — proven pattern
- Clipboard copy pattern in explorer/query-results.tsx — TSV format via `navigator.clipboard.writeText()`
- TanStack Query `keepPreviousData` already configured — smooth refresh transitions
- `useQueryClient().invalidateQueries()` pattern used in use-saved-views.ts, use-databases.ts

### Established Patterns
- Chart click handlers use 250ms debounce to distinguish single-click (cross-filter) from double-click (drill-down) — toolbar must not interfere
- Stable ref pattern for click handlers to avoid chart re-renders
- Zustand stores for client state, TanStack Query for server state
- Config-driven rendering via DashboardConfig → component tree
- Error panels with retry buttons (ErrorPanel component)
- Toast notifications via Sonner

### Integration Points
- `config-chart-grid.tsx` CardHeader — chart toolbar icons attach here
- `config-data-grid.tsx` — needs new toolbar component above grid
- `dashboard-renderer.tsx` — dashboard-level refresh button/auto-refresh controls
- `DashboardConfig` type — needs `autoRefresh` interval field
- `DashboardChartConfig` type — needs optional `refreshInterval` override field
- Both chart wrappers need `forwardRef` to expose chart instance for export

</code_context>

<specifics>
## Specific Ideas

- Hover-reveal toolbar chosen specifically for premium dashboard feel — dashboards can have 6-10+ charts, always-visible toolbars would create visual noise.
- Fullscreen modal is the same live chart component at a bigger size, not a screenshot or separate render. This means cross-filter and drill-down work without any extra wiring.
- Export WYSIWYG: if cross-filters are dimming segments, the exported PNG/SVG captures that state. Financial users showing "here's what I filtered to" in reports.
- Auto-refresh at both levels (dashboard-wide + per-chart override) because some charts may query slow data sources that shouldn't refresh as frequently as fast ones.
- Keep-previous-data during refresh is critical for a financial dashboard — analysts can't have charts disappearing every 10 minutes.
- Dead code cleanup (data-grid.tsx, grid-toolbar.tsx) keeps the codebase honest. The pattern is preserved in the new config-data-grid toolbar.

</specifics>

<deferred>
## Deferred Ideas

- **Chart style/appearance configuration** — Ability to change chart colors, fonts, axis labels, legend position, etc. This is Phase 6 (Chart Library) scope where users create and configure charts from datasets.

</deferred>

---

*Phase: 03-chart-and-grid-interactions*
*Context gathered: 2026-04-05*
