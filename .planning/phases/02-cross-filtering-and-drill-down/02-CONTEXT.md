# Phase 2: Cross-Filtering and Drill-Down - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Add client-side cross-filtering and per-chart drill-down navigation to the existing config-driven dashboard renderer. Users can click chart elements to instantly filter all other charts on a dashboard, and drill from aggregated views down to raw detail rows in AG Grid.

</domain>

<decisions>
## Implementation Decisions

### Cross-Filter Click Behavior
- **D-01:** Toggle single value per click. Click a bar/pie slice/data point to apply a cross-filter on that column+value. Click the same element again to remove it. Only one cross-filter value active per source chart at a time.
- **D-02:** All chart types are clickable cross-filter sources: bar, pie, donut, line points, scatter, heatmap cells, treemap nodes, and AG Grid row clicks. Anything with identifiable data points.
- **D-03:** KPI cards are display-only — they consume cross-filters (re-aggregate their values) but never initiate them. Charts and grids are the only cross-filter sources.

### Cross-Filter Visual Feedback
- **D-04:** Opacity reduction for excluded data. Selected/matching elements stay full color; excluded elements fade to ~20-30% opacity. Pie charts: selected slice pulls out slightly + excluded slices fade.
- **D-05:** Cross-filter indicator bar — Claude's discretion on placement and design, with strong recommendation for a badge-based bar showing active cross-filters with one-click removal (standard pattern in Tableau, Power BI, Looker).

### Cross-Filter Config Model
- **D-06:** All-to-all by default with per-chart opt-out. When `features.crossFilter` is true in dashboard config, every chart participates automatically. Individual charts opt out with `crossFilter: false`. No need to configure explicit relationships between charts.
- **D-07:** Column name matching — cross-filters apply automatically to any chart whose data contains the filtered column name. If Chart A filters on "region" and Chart B's data has a "region" column, the filter applies. If Chart C has no "region" column, it's unaffected. No explicit column mapping config needed.
- **D-08:** KPIs re-aggregate when cross-filters are active. Cross-filtered KPI cards re-query/recalculate to show values for the filtered subset only (e.g., "Total Breaks" becomes "Total Breaks for APAC" when region=APAC is cross-filtered).

### Drill-Down Level Design
- **D-09:** Chart-level drill — each chart drills independently. Clicking a chart to drill does NOT affect other charts on the dashboard. Each chart maintains its own drill state. This matches Tableau/Power BI default behavior.
- **D-10:** Config-defined drill hierarchy per chart. Each chart entry in the dashboard config has an optional `drillHierarchy` array defining its drill columns (e.g., `break_type → aging_bucket → detail`). The number of levels varies per chart. Not a fixed 3- or 4-level model.
- **D-11:** Detail grid slides in below the drilled chart's row. When a chart reaches its deepest drill level, a full-width AG Grid appears directly below the row containing the drilled chart. Other charts stay visible and unchanged. Charts below shift down. Auto-scrolls to keep the detail grid in view.
- **D-12:** Detail level fetches raw rows from the backend — not client-side filtered. Full AG Grid sort, filter, and pagination on backend-fetched data. The drill hierarchy's last level specifies a `dataSourceId` for the detail query.
- **D-13:** Breadcrumb navigation shows the full drill path on the drilled chart's panel (e.g., "Overview > Unmatched > 30-60 days"). User can click any breadcrumb level to navigate back.

### Architecture Direction
- **D-14:** Research DuckDB-WASM as a potential client-side engine for cross-filtering. The hypothesis is that loading chart data into a client-side DuckDB instance enables fast SQL-based cross-filtering without custom JS array filtering. This needs proper research — DuckDB-WASM may or may not be the right approach depending on data volume, browser memory, and integration complexity.
- **D-15:** Existing legacy cross-filter and drill-down code (filter-store crossFilters, drill-store, use-cross-filter hook, use-drill-down hook, cross-filter.ts utilities) should be evaluated during research. The user is open to a full rewrite if research shows a better architecture. Do not assume the legacy code is correct or should be preserved — assess it objectively.

### Claude's Discretion
- Cross-filter indicator bar design and placement (D-05 — lean toward badge bar)
- Whether DuckDB-WASM is viable or if a simpler approach (JS filtering, Web Workers) is better — research decides
- Animation timings for cross-filter apply/remove transitions
- Breadcrumb component design and interaction
- How intermediate drill levels re-aggregate data (client-side vs backend)
- Detail grid height, pagination defaults, column auto-sizing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing cross-filter and drill-down code (evaluate, may rewrite)
- `frontend/src/stores/filter-store.ts` — Zustand store with crossFilters[], addCrossFilter, removeCrossFilter, clearCrossFilters
- `frontend/src/stores/drill-store.ts` — Zustand store with drill breadcrumb stack, drillDown/drillUp/drillToLevel
- `frontend/src/lib/cross-filter.ts` — applyCrossFilters() and rowPassesCrossFilters() utility functions
- `frontend/src/hooks/use-cross-filter.ts` — Hook with rule-based targeting (sourceChart → targetCharts mapping — this approach is being REPLACED by column-name matching)
- `frontend/src/hooks/use-drill-down.ts` — Hook with 4-level depth model and client-side re-aggregation — evaluate whether this approach fits the new per-chart model
- `frontend/src/components/dashboard/cross-filter-bar.tsx` — Badge-based UI for active cross-filters with removal buttons
- `frontend/src/types/filter.ts` — CrossFilter, CrossFilterRule, DrillLevel, DrillState type definitions

### Config-driven dashboard system (integration target)
- `frontend/src/components/dashboard/dashboard-renderer.tsx` — Main renderer that needs cross-filter and drill-down integration
- `frontend/src/components/dashboard/config-chart-grid.tsx` — Chart grid that needs click handlers and dimming
- `frontend/src/components/dashboard/config-kpi-row.tsx` — KPI row that needs to respond to cross-filters
- `frontend/src/components/dashboard/config-data-grid.tsx` — Data grid that needs cross-filter and drill-detail support
- `frontend/src/types/dashboard-config.ts` — DashboardConfig type with DashboardFeatures.crossFilter/drillDown booleans and DashboardChartConfig

### Chart wrappers (click event integration)
- `frontend/src/components/charts/ag-chart-wrapper.tsx` — AG Charts wrapper needing click event handlers
- `frontend/src/components/charts/echart-wrapper.tsx` — ECharts wrapper needing click event handlers
- `frontend/src/components/charts/chart-factory.tsx` — Chart factory routing to correct wrapper

### Backend (drill-down detail endpoint)
- `backend/app/api/data_sources.py` — Data source query endpoint used for chart data, will also serve drill detail queries
- `backend/app/services/query_engine.py` — Query execution service

### Project context
- `.planning/PROJECT.md` — Project vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` — INTR-01 through INTR-04 requirements for this phase
- `CLAUDE.md` — Coding conventions, tech stack reference, project structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `filter-store.ts`: Already has crossFilters state and actions — may be reusable if architecture stays Zustand-based
- `drill-store.ts`: Breadcrumb stack model is solid — but needs to become per-chart instead of global
- `cross-filter-bar.tsx`: Badge-based UI component — good starting point for the indicator bar
- `cross-filter.ts`: Simple row filtering logic — may be replaced by DuckDB-WASM or may stay for simple cases
- AG Charts and ECharts both support click events natively — research exact APIs

### Established Patterns
- Zustand stores for client state, TanStack Query for server state — new cross-filter/drill code should follow this split
- Config-driven rendering via DashboardConfig → component tree
- `DashboardFeatures.crossFilter` and `DashboardFeatures.drillDown` booleans already in config type

### Integration Points
- `dashboard-renderer.tsx` — orchestrates all dashboard sections, needs to wire cross-filter state
- `config-chart-grid.tsx` — renders chart grid, needs click handlers + dimming + drill-down grid insertion
- `config-kpi-row.tsx` — renders KPIs, needs to respond to cross-filter state changes
- AG Grid's `isExternalFilterPresent` / `doesExternalFilterPass` APIs for grid cross-filtering

</code_context>

<specifics>
## Specific Ideas

- DuckDB-WASM as client-side query engine for cross-filtering — user wants this researched as a potential approach for faster client-side data operations. Not a hard requirement — research should evaluate feasibility vs simpler alternatives.
- Existing legacy cross-filter/drill-down code quality is uncertain — user is comfortable with a full rewrite if research recommends it. Don't preserve code just because it exists.
- Cross-filter must feel instant — no loading spinners when clicking chart elements. Client-side filtering is the requirement (INTR-01: "zero network calls, instant response").
- The slide-down detail grid pattern (grid appears below the drilled chart's row, pushes content down) was chosen specifically because dashboards can have 10+ charts and 2+ existing grids — appending to the bottom would bury the detail view.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-cross-filtering-and-drill-down*
*Context gathered: 2026-04-05*
