# Phase 2: Cross-Filtering and Drill-Down - Research

**Researched:** 2026-04-05
**Domain:** Client-side interactive data filtering, chart click events, drill-down navigation, CSS grid layout manipulation
**Confidence:** HIGH

## Summary

This phase adds two major interactive features to the existing config-driven dashboard renderer: (1) cross-filtering -- where clicking a chart element instantly filters all other charts on the same dashboard with zero network calls, and (2) drill-down -- where clicking aggregated data navigates through breakdown levels to a raw detail grid powered by the backend.

The existing codebase already has substantial infrastructure for both features. The Zustand filter-store has working cross-filter state management with toggle semantics. The AG Chart wrapper already implements `seriesNodeClick`/`seriesNodeDoubleClick` listeners, `ChartSelection` state, and `itemStyler`-based opacity dimming. The EChart wrapper has click event handling. The drill-store has a working breadcrumb stack model. These existing patterns are sound and should be evolved, not rewritten from scratch.

After thorough research, DuckDB-WASM is **not recommended** for cross-filtering. Its 33MB WASM binary (8-12MB gzipped) is disproportionate to the problem -- cross-filtering on dashboard datasets (typically hundreds to low-thousands of rows of pre-aggregated data) is trivially fast with plain JavaScript `Array.filter()`. DuckDB-WASM's value is for millions of raw rows, which is the domain of the backend, not the client. The existing `cross-filter.ts` utility with simple JS array filtering is the correct approach.

**Primary recommendation:** Evolve the existing filter-store cross-filter state, add column-name-matching dispatch logic, wire click handlers through chart wrappers to the config-driven dashboard renderer, and build per-chart drill state as a new Zustand store. Use plain JS array filtering for cross-filters (no DuckDB-WASM). Use CSS grid `order` property and conditional full-width row rendering for drill-down detail grid insertion.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Toggle single value per click. Click a bar/pie slice/data point to apply a cross-filter on that column+value. Click the same element again to remove it. Only one cross-filter value active per source chart at a time.
- **D-02:** All chart types are clickable cross-filter sources: bar, pie, donut, line points, scatter, heatmap cells, treemap nodes, and AG Grid row clicks.
- **D-03:** KPI cards are display-only -- they consume cross-filters (re-aggregate their values) but never initiate them.
- **D-04:** Opacity reduction for excluded data. Selected/matching elements stay full color; excluded elements fade to ~20-30% opacity. Pie charts: selected slice pulls out slightly + excluded slices fade.
- **D-05:** Cross-filter indicator bar -- Claude's discretion on placement and design, with strong recommendation for a badge-based bar.
- **D-06:** All-to-all by default with per-chart opt-out. When `features.crossFilter` is true, every chart participates automatically. Individual charts opt out with `crossFilter: false`.
- **D-07:** Column name matching -- cross-filters apply automatically to any chart whose data contains the filtered column name. No explicit column mapping.
- **D-08:** KPIs re-aggregate when cross-filters are active.
- **D-09:** Chart-level drill -- each chart drills independently, does NOT affect other charts.
- **D-10:** Config-defined drill hierarchy per chart. Each chart has optional `drillHierarchy` array. Variable number of levels.
- **D-11:** Detail grid slides in below the drilled chart's row. Other charts stay visible. Charts below shift down.
- **D-12:** Detail level fetches raw rows from the backend. Full AG Grid sort/filter/pagination.
- **D-13:** Breadcrumb navigation shows full drill path on the drilled chart's panel.
- **D-14:** Research DuckDB-WASM as potential client-side engine. (Research complete -- see recommendation below.)
- **D-15:** Evaluate legacy cross-filter/drill-down code objectively. (Evaluation complete -- see Legacy Code Evaluation section.)

### Claude's Discretion
- Cross-filter indicator bar design and placement (D-05)
- Whether DuckDB-WASM is viable or if simpler approach is better (research recommends simple JS filtering)
- Animation timings for cross-filter apply/remove transitions
- Breadcrumb component design and interaction
- How intermediate drill levels re-aggregate data (client-side vs backend)
- Detail grid height, pagination defaults, column auto-sizing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTR-01 | Cross-filtering -- click chart segment to filter all other charts; client-side only, zero network calls, instant response | JS Array.filter on cached TanStack Query data; Zustand cross-filter state; AG Charts seriesNodeClick + ECharts click events; column-name matching logic |
| INTR-02 | Cross-filter visual state -- selected items full color, excluded items dimmed; selection bar with active cross-filters and one-click removal | AG Charts itemStyler with fillOpacity; ECharts dispatchAction highlight/downplay; existing CrossFilterBar badge component |
| INTR-03 | Drill-down -- click aggregated data to see breakdown then detail rows; breadcrumb navigation | Per-chart drill store; config-defined drillHierarchy; client-side re-aggregation for intermediate levels; breadcrumb component |
| INTR-04 | Drill-down detail level fetches raw rows from backend via AG Grid with full sort/filter/pagination | Backend data-source query endpoint already exists; new drill-detail query with additional WHERE clauses; AG Grid server-side or client-side row model with backend-fetched data |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Strict TypeScript**: No `any`, no `@ts-ignore`
- **Named exports** for components/hooks/stores (except page default exports)
- **Zustand** for client state, **TanStack Query** for server state -- never store fetched data in Zustand
- **AG Charts** for standard chart types, **ECharts** only for exotic types (Sankey, sunburst, radar, gauge, funnel, graph, parallel)
- **`motion/react`** for animations (NOT `framer-motion`)
- Import from `motion/react`
- **Shadcn CSS variable colors only** -- never hardcode hex/rgb/hsl
- **Desktop-first**, dark mode is first-class
- **kebab-case** file naming for components
- **No barrel exports**
- **Skeleton loading** on every data component
- Filter bar + KPI + chart + grid progressive loading pattern
- AG Grid Quartz theme, AG Charts custom theme reading CSS variables

## DuckDB-WASM Viability Assessment

### Verdict: NOT RECOMMENDED for this use case

**Bundle size impact:** [VERIFIED: npm pack @duckdb/duckdb-wasm]
- WASM binary (EH variant): 33MB uncompressed, ~8-12MB gzipped
- JS worker: 755KB
- JS client: 31KB
- Total initial download: ~9-13MB gzipped (compared to entire RecViz frontend currently ~2-3MB)

**Initialization overhead:** [ASSUMED -- specific cold-start benchmarks not found in official docs]
- WASM compile + instantiate: estimated 500ms-2s on first load (hardware dependent)
- Worker thread setup: additional 100-300ms
- Database creation + table registration: 50-200ms per dataset

**The mismatch:** Cross-filtering operates on data already cached by TanStack Query in the browser. This is pre-aggregated dashboard data -- typically 10-500 rows per chart (GROUP BY results). JavaScript `Array.filter()` on 500 rows completes in <0.1ms. DuckDB-WASM's value is for millions of raw rows [CITED: github.com/timlrx/browser-data-processing-benchmarks -- 1M row benchmark shows DuckDB at 0.014ms aggregation vs Arquero at 0.067ms]. For dashboard cross-filtering on pre-aggregated data, the complexity and download cost of DuckDB-WASM is unjustified.

**When DuckDB-WASM WOULD make sense:**
- If cross-filtering required querying raw detail data (millions of rows) client-side
- If the app needed ad-hoc SQL over client-side data (like a client-side data explorer)
- If users downloaded large Parquet files and explored them locally

**None of these apply to RecViz cross-filtering.** The existing `cross-filter.ts` with `applyCrossFilters()` and `rowPassesCrossFilters()` using plain JS array operations is the correct approach.

**Recommendation:** Use plain JavaScript array filtering. If performance becomes an issue with very large datasets in the future, the upgrade path is: (1) Web Worker for filtering computation, (2) then DuckDB-WASM only if JS filtering in a Worker is still too slow. This is an optimization that can be added later without architectural changes.

## Standard Stack

### Core (Already Installed -- No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.11 | Cross-filter + drill state management | Already the project's client state manager [VERIFIED: frontend/package.json] |
| @tanstack/react-query | ^5.90.20 | Server state for drill detail queries | Already the project's server state manager [VERIFIED: frontend/package.json] |
| ag-charts-enterprise | ^13.0.1 | Click events (seriesNodeClick) + itemStyler dimming | Already installed, has the required APIs [VERIFIED: codebase] |
| ag-charts-react | ^13.0.1 | React wrapper for AG Charts | Already installed [VERIFIED: frontend/package.json] |
| ag-grid-enterprise | ^35.0.1 | External filter API + detail grid | Already installed [VERIFIED: frontend/package.json] |
| echarts | ^6.0.0 | Click events + dispatchAction highlight/downplay | Already installed [VERIFIED: frontend/package.json] |
| motion | ^12.34.0 | Cross-filter/drill transitions (AnimatePresence) | Already installed, used for page transitions [VERIFIED: frontend/package.json] |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.563.0 | Icons for cross-filter bar, breadcrumbs | Badge remove icons, drill navigation arrows |
| sonner | ^2.0.7 | Toast for edge cases (filter errors) | Error feedback |

### Not Needed
| Considered | Rejected | Reason |
|------------|----------|--------|
| @duckdb/duckdb-wasm | Too heavy | 33MB WASM binary for filtering 10-500 rows. Plain JS Array.filter is <0.1ms. See DuckDB assessment above. |
| arquero | Unnecessary | Same argument -- data volumes don't justify a columnar library |
| Web Workers (manual) | Premature | JS filtering on cached aggregated data is instant. Worker overhead (serialization) would slow it down for small datasets. |

**Installation:** No new packages needed. All required libraries are already installed.

## Architecture Patterns

### Recommended Project Structure (New/Modified Files)
```
frontend/src/
├── stores/
│   ├── filter-store.ts          # MODIFY: evolve cross-filter state for column-name matching
│   └── drill-store.ts           # REWRITE: per-chart drill state (Map<chartId, DrillState>)
├── hooks/
│   ├── use-cross-filter.ts      # REWRITE: column-name matching, no rule-based targeting
│   ├── use-drill-down.ts        # REWRITE: per-chart drill with config-defined hierarchy
│   └── use-drill-detail.ts      # NEW: TanStack Query hook for drill detail backend queries
├── lib/
│   └── cross-filter.ts          # MODIFY: add KPI re-aggregation helper
├── components/
│   ├── dashboard/
│   │   ├── dashboard-renderer.tsx    # MODIFY: wire cross-filter + drill state
│   │   ├── config-chart-grid.tsx     # MODIFY: click handlers, dimming, drill grid insertion
│   │   ├── config-kpi-row.tsx        # MODIFY: consume cross-filters for re-aggregation
│   │   ├── config-data-grid.tsx      # MODIFY: external filter API for cross-filtering
│   │   ├── cross-filter-bar.tsx      # MODIFY: evolve for column-name labels
│   │   ├── drill-breadcrumb.tsx      # NEW: breadcrumb navigation per chart
│   │   └── drill-detail-grid.tsx     # NEW: full-width detail AG Grid
│   └── charts/
│       ├── ag-chart-wrapper.tsx      # MODIFY: wire double-click for drill
│       └── echart-wrapper.tsx        # MODIFY: add dispatchAction dimming
├── types/
│   ├── filter.ts                # MODIFY: update CrossFilter type, remove CrossFilterRule
│   └── dashboard-config.ts      # MODIFY: add drillHierarchy, crossFilter opt-out to chart config
```

### Pattern 1: Cross-Filter Data Flow

**What:** Click events flow from chart wrappers through a centralized dispatch function to Zustand state, then back to all charts via selectors and memoized filtering.

**When to use:** Every chart click that should filter other charts.

```typescript
// Source: Pattern derived from existing codebase architecture [VERIFIED: codebase]

// 1. Chart click → dispatch to store
// In config-chart-grid.tsx or a wrapper component:
const handleCrossFilterClick = useCallback((event: ChartClickEvent) => {
  addCrossFilter({
    sourceChartId: event.chartId,
    column: event.column,
    value: event.value,
  })
}, [addCrossFilter])

// 2. Store toggle logic (already exists in filter-store.ts)
// addCrossFilter already implements toggle: same value = remove

// 3. Consumer charts read cross-filters and filter cached data
// In each chart component:
const crossFilters = useFilterStore((s) => s.crossFilters)
const filteredData = useMemo(() => {
  return applyCrossFilters(rawData, crossFilters, chartId)
}, [rawData, crossFilters, chartId])

// 4. Source chart shows selection highlight
const activeSelection = useMemo((): ChartSelection | undefined => {
  const myFilter = crossFilters.find((f) => f.sourceChartId === chartId)
  if (!myFilter) return undefined
  return { column: myFilter.column, value: myFilter.value }
}, [crossFilters, chartId])
```

### Pattern 2: Column-Name Matching for Cross-Filter Targeting

**What:** Cross-filters apply automatically to any chart whose cached data contains the filtered column name. No configuration needed.

**When to use:** When determining which charts should respond to a cross-filter.

```typescript
// Source: Decision D-07, pattern derived from existing applyCrossFilters [VERIFIED: codebase]

export function applyCrossFilters(
  data: ChartDataResponse | undefined,
  crossFilters: CrossFilter[],
  selfChartId: string,
): ChartDataResponse | undefined {
  if (!data?.data?.length || crossFilters.length === 0) return data

  // Only apply filters from OTHER charts (never self-filter)
  const externalFilters = crossFilters.filter((f) => f.sourceChartId !== selfChartId)
  if (externalFilters.length === 0) return data

  let filtered = data.data
  for (const filter of externalFilters) {
    // Column-name matching: if this chart's data has the column, apply the filter
    if (filtered.length > 0 && filter.column in filtered[0]) {
      filtered = filtered.filter((row) => row[filter.column] === filter.value)
    }
    // If column doesn't exist in this chart's data, filter is simply skipped
  }

  return { ...data, data: filtered, rowCount: filtered.length }
}
```

This is essentially what `cross-filter.ts` already does. The key insight is that the existing implementation already uses column-name matching -- the `use-cross-filter.ts` hook with rule-based targeting is the one that needs to be replaced.

### Pattern 3: Per-Chart Drill State

**What:** Each chart maintains its own independent drill state in a Map structure, replacing the global single-chart drill store.

**When to use:** All drill-down interactions.

```typescript
// Source: Derived from D-09, D-10 decisions [VERIFIED: CONTEXT.md]

interface DrillLevel {
  column: string
  value: string
  label?: string  // For breadcrumb display
}

interface ChartDrillState {
  levels: DrillLevel[]
  hierarchy: string[]  // from config: ['break_type', 'aging_bucket', 'detail']
  detailDataSourceId?: string  // for the final detail level
}

interface DrillStore {
  drills: Map<string, ChartDrillState>
  drillDown: (chartId: string, level: DrillLevel) => void
  drillUp: (chartId: string) => void
  drillToLevel: (chartId: string, levelIndex: number) => void
  resetDrill: (chartId: string) => void
  isAtDetailLevel: (chartId: string) => boolean
}
```

### Pattern 4: Drill-Down Detail Grid Insertion via CSS Grid

**What:** When a chart reaches its deepest drill level, a full-width AG Grid appears directly below the row containing the drilled chart in the CSS grid layout.

**When to use:** Detail level of any drill-down.

The existing `config-chart-grid.tsx` uses a 12-column CSS grid with `gridColumn: span N` and `gridRow: span N` for each chart. To insert a detail grid below a specific row:

```typescript
// Source: CSS Grid specification + existing config-chart-grid layout [VERIFIED: codebase]

// Approach: Render charts normally, then conditionally render a full-width
// detail grid AFTER the chart that triggered drill-down.
// CSS grid auto-placement handles the "push down" behavior naturally.

// In ConfigChartGrid:
{charts.map((chart) => (
  <React.Fragment key={chart.id}>
    <div style={{ gridColumn: `span ${chart.layout.width}` }}>
      <ChartCard chart={chart} />
    </div>
    {isDrilledToDetail(chart.id) && (
      <div style={{ gridColumn: '1 / -1' }}>
        <DrillDetailGrid
          chartId={chart.id}
          drillState={getDrillState(chart.id)}
          appliedFilters={appliedFilters}
        />
      </div>
    )}
  </React.Fragment>
))}
```

**Key insight:** CSS grid auto-placement means inserting a `gridColumn: 1 / -1` (full-width) element between existing grid items will naturally push subsequent items down. No explicit row repositioning needed. The auto-placement algorithm fills grid cells in order, and a full-width element forces a new row.

**Caveat:** If charts use explicit `gridRow` positioning (they currently use `span N` which is relative), the detail grid insertion works seamlessly. If they used absolute row numbers, we would need to recalculate. The current code uses `span` which is compatible.

### Pattern 5: KPI Re-aggregation Under Cross-Filters

**What:** When cross-filters are active, KPI values need to reflect the filtered subset.

**When to use:** Whenever cross-filters change and KPIs are displayed.

Two approaches for D-08:

**Option A (Recommended): Client-side re-aggregation from chart data**
If KPI values can be derived from the same data sources that charts use, re-aggregate from the cross-filtered chart data. This keeps it zero-network-calls and instant.

**Option B: Backend re-query with additional filters**
If KPIs use different data sources or complex server-side aggregation, trigger a new backend query with the cross-filter values as additional filter parameters. This adds a loading state.

Recommendation: Option A for KPIs whose values come from the same data sources as charts (which is the case for `kpi_values` source type charts). Option B as fallback for complex KPIs.

### Anti-Patterns to Avoid
- **Global drill state for multi-chart dashboards:** The old `drill-store.ts` has a single `sourceChartId` -- drilling one chart would break all others. Must be per-chart.
- **Rule-based cross-filter targeting:** The old `use-cross-filter.ts` uses `CrossFilterRule` with explicit `sourceChart -> targetCharts` mapping. This violates D-07 (column-name matching). Remove `CrossFilterRule` entirely.
- **Re-fetching from backend on cross-filter clicks:** Cross-filtering must be client-side only (INTR-01). Never trigger API calls when a cross-filter is applied.
- **Storing cross-filtered data in Zustand:** Derived data from cross-filters should be computed via `useMemo` in components, not stored in Zustand.
- **DuckDB-WASM for pre-aggregated data:** Massive overhead for trivial filtering. See DuckDB assessment.

## Legacy Code Evaluation

### filter-store.ts (Cross-Filter State)
**Verdict: KEEP and evolve**
- The `crossFilters[]` array, `addCrossFilter` (with toggle), `removeCrossFilter`, and `clearCrossFilters` are all solid [VERIFIED: codebase review]
- Toggle semantics in `addCrossFilter` already match D-01 (click same element = remove)
- One fix needed: `removeCrossFilter(chartId, column)` signature -- the current call in `CrossFilterBar` only passes `chartId` (missing column), which works for single-filter-per-chart but should be kept clean
- The store correctly separates cross-filter state from global filter state

### drill-store.ts (Drill State)
**Verdict: REWRITE**
- Current store is global (single `sourceChartId`) -- violates D-09 (per-chart drill)
- Breadcrumb stack pattern is correct conceptually but needs to be per-chart: `Map<string, DrillLevel[]>`
- `drillDown`, `drillUp`, `drillToLevel`, `resetDrill` actions are the right interface but need chartId parameter on every action

### cross-filter.ts (Utility Functions)
**Verdict: KEEP and extend**
- `applyCrossFilters()` already implements column-name matching correctly [VERIFIED: codebase review]
- `rowPassesCrossFilters()` is useful for AG Grid `doesExternalFilterPass` integration
- Add: KPI re-aggregation helper function
- Add: function to check if a chart's data contains any cross-filtered columns (for opt-out check)

### use-cross-filter.ts (Hook)
**Verdict: REWRITE**
- Uses `CrossFilterRule` with explicit sourceChart->targetCharts mapping [VERIFIED: codebase review]
- This is the WRONG model per D-07 (column-name matching replaces rule-based targeting)
- Replace with a simpler hook that reads cross-filters from store and calls `applyCrossFilters` from `cross-filter.ts`

### use-drill-down.ts (Hook)
**Verdict: REWRITE**
- Hardcoded 4-level depth model (`isDrillDetailMode(depth >= 3)`) [VERIFIED: codebase review]
- Uses global drill state, not per-chart
- `isMetricColumn()` heuristic is fragile (checking for 'count', 'sum', 'avg' in column name)
- `reaggregateByField()` is useful logic but needs to work with config-defined drill hierarchies
- New hook should: accept chartId + drillHierarchy config, maintain per-chart state, know when detail level is reached from config (not hardcoded depth)

### cross-filter-bar.tsx (UI Component)
**Verdict: KEEP and evolve**
- Badge-based design matches D-05 recommendation [VERIFIED: codebase review]
- Hardcoded `COLUMN_LABELS` map should be replaced with dynamic labels from chart data/config
- `removeCrossFilter` call signature needs alignment with updated store
- Add animation for badge appear/disappear (Motion AnimatePresence)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart click events | Custom DOM event listeners on chart canvas | AG Charts `seriesNodeClick` / ECharts `click` event | Chart libraries handle hit testing, datum resolution, series identification |
| Chart element dimming | Custom SVG/Canvas opacity manipulation | AG Charts `itemStyler` with `fillOpacity` / ECharts `dispatchAction('downplay')` | Libraries handle rendering pipeline, animation, and theme integration |
| Grid external filtering | Manual row hiding/DOM manipulation | AG Grid `isExternalFilterPresent` + `doesExternalFilterPass` + `api.onFilterChanged()` | AG Grid handles virtual scrolling, pagination, and performance |
| Full-width grid insertion | Absolute positioning / manual layout calc | CSS Grid `gridColumn: 1 / -1` auto-placement | CSS engine handles reflow, animation can be added via Motion |
| Toggle state management | Custom state diffing | Zustand with toggle logic in `addCrossFilter` | Already implemented, battle-tested in existing store |

**Key insight:** Every major piece of infrastructure for this phase already exists in the installed libraries. No new dependencies needed. The work is wiring and integration, not building from scratch.

## Common Pitfalls

### Pitfall 1: Cross-Filter Infinite Loops
**What goes wrong:** Chart A filters Chart B, Chart B's filtered data triggers a re-render, which somehow re-dispatches a filter event.
**Why it happens:** Click handlers fire on re-render if not properly guarded, or derived state triggers state updates.
**How to avoid:** Cross-filter state lives in Zustand, derived filtered data lives in `useMemo`. Never dispatch `addCrossFilter` from a `useEffect` or derived computation -- only from explicit user click handlers.
**Warning signs:** Console shows rapid state updates, charts flicker, browser becomes unresponsive.

### Pitfall 2: Stale Cross-Filter References After Data Refetch
**What goes wrong:** User applies cross-filter on column "region" = "APAC", then changes a global filter that causes data refetch. New data might not have "APAC" as a value, leaving a cross-filter that matches nothing.
**Why it happens:** Cross-filter values are snapshots from old data.
**How to avoid:** When global filters change (applied filters update), clear all cross-filters. This is the standard behavior in Tableau/Power BI. Add a `useEffect` in dashboard-renderer that calls `clearCrossFilters()` when `appliedFilters` changes.
**Warning signs:** Cross-filter badges show values that don't appear in any chart.

### Pitfall 3: AG Charts seriesNodeClick 250ms Delay vs Double-Click
**What goes wrong:** The existing code uses a 250ms `setTimeout` to debounce single-click from double-click. This makes cross-filtering feel sluggish.
**Why it happens:** Need to distinguish cross-filter (single click) from drill-down (double click) on the same element.
**How to avoid:** Consider using single-click for cross-filter and double-click for drill-down (the existing pattern). The 250ms delay is inherent in any single/double-click disambiguation. Alternative: use different gestures (e.g., click for cross-filter, Ctrl+click or context menu for drill-down) to eliminate delay entirely. The existing codebase already has this debounce pattern and it is an acceptable UX compromise.
**Warning signs:** Users complain about click response feeling slow.

### Pitfall 4: CSS Grid Layout Breaks When Inserting Detail Grid
**What goes wrong:** Inserting a full-width element between grid items disrupts the visual layout of charts with explicit row positioning.
**Why it happens:** CSS grid auto-placement and explicit placement interact in complex ways.
**How to avoid:** Ensure all chart positioning uses relative `span` values (not absolute row/column numbers). The current code already does this correctly. The detail grid uses `gridColumn: 1 / -1` which starts a new implicit row.
**Warning signs:** Charts overlap or jump to unexpected positions when drill detail opens.

### Pitfall 5: KPI Re-aggregation Accuracy
**What goes wrong:** Cross-filtered KPI values don't match what a manual calculation would show.
**Why it happens:** KPIs may use different data sources than charts, or use server-side aggregations (e.g., COUNT DISTINCT) that can't be replicated by client-side SUM.
**How to avoid:** For KPIs derived from chart data (`kpi_values` source type), re-aggregate from the same cross-filtered data. For KPIs with independent data sources, either (a) fetch the KPI data source, apply the same cross-filter, re-aggregate, or (b) show a small indicator that KPI values are approximate under cross-filtering.
**Warning signs:** KPI "Total" doesn't equal the sum of visible chart segments.

### Pitfall 6: Drill-Down State Persisting Across Dashboard Navigation
**What goes wrong:** User drills into a chart, navigates to another dashboard, comes back -- the drill state is still active.
**Why it happens:** Zustand stores persist across route changes unless explicitly cleared.
**How to avoid:** Reset all drill state when dashboard `config.id` changes. Add cleanup in `DashboardRenderer` useEffect.
**Warning signs:** User sees a detail grid when they expect the overview.

## Code Examples

### AG Charts Click Events (seriesNodeClick)
```typescript
// Source: Existing ag-chart-wrapper.tsx [VERIFIED: codebase] + AG Charts docs [CITED: ag-grid.com/charts/react/events/]

// The existing code already has this pattern:
listeners: {
  seriesNodeClick: (event: { datum: Record<string, unknown> }) => {
    if (!event.datum) return
    const payload: ChartClickEvent = {
      chartId,
      column: categoryKey,
      value: event.datum[categoryKey] as string | number,
      row: event.datum,
    }
    // Single click → cross-filter (with debounce for double-click disambiguation)
    clickHandlerRef.current?.(payload)
  },
  seriesNodeDoubleClick: (event: { datum: Record<string, unknown> }) => {
    if (!event.datum) return
    // Double click → drill-down
    dblClickHandlerRef.current?.({
      chartId,
      column: categoryKey,
      value: event.datum[categoryKey] as string | number,
      row: event.datum,
    })
  },
}

// nodeClickRange can be set to 'nearest' for easier clicking:
// This is useful for line charts where exact node hitting is hard
```

### AG Charts itemStyler for Cross-Filter Dimming
```typescript
// Source: Existing ag-chart-wrapper.tsx makeItemStyler [VERIFIED: codebase]
// + AG Charts stylers docs [CITED: ag-grid.com/charts/react/stylers/]

// Already implemented in the codebase:
function makeItemStyler(
  categoryKey: string,
  selection: ChartSelection | undefined,
) {
  if (!selection) return undefined
  return (params: { datum: Record<string, unknown> }) => {
    const val = params.datum[categoryKey]
    if (val === selection.value) {
      return { fillOpacity: 1, strokeWidth: 2 }
    }
    return { fillOpacity: 0.25, strokeWidth: 0 }  // D-04: ~20-30% opacity
  }
}

// For pie/donut "pull out" effect (D-04), use outerRadiusOffset in itemStyler:
// Note: AG Charts does not have a per-sector offset via itemStyler.
// Alternative: use sectorSpacing + enlarged strokeWidth on selected sector
// to create visual separation effect. [ASSUMED -- AG Charts API may have changed]
```

### ECharts Click Events and Highlight/Downplay
```typescript
// Source: ECharts handbook [CITED: apache.github.io/echarts-handbook/en/concepts/event/]

// Click event params structure:
// {
//   componentType: 'series',
//   seriesType: 'sankey' | 'radar' | 'sunburst' | etc,
//   seriesIndex: number,
//   name: string,          // category/node name
//   dataIndex: number,     // index in data array
//   data: object,          // raw data item
//   value: number | array,
//   color: string
// }

// Existing echart-wrapper.tsx already handles clicks:
const onEvents = useMemo(() => {
  if (!onChartClick) return undefined
  return {
    click: (params: { name?: string; value?: unknown; data?: Record<string, unknown> }) => {
      onChartClick({
        chartId,
        column: data?.columns[0] ?? '',
        value: (params.name ?? params.value ?? '') as string | number,
        row: (params.data ?? {}) as Record<string, unknown>,
      })
    },
  }
}, [onChartClick, chartId, data?.columns])

// For programmatic dimming, use dispatchAction:
// chartInstance.dispatchAction({ type: 'downplay', seriesIndex: 0 })  // dim all
// chartInstance.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: N })  // highlight one

// To get chartInstance from echarts-for-react:
// Use ref: <ReactEChartsCore ref={chartRef} ... />
// chartRef.current.getEchartsInstance().dispatchAction(...)
```

### AG Grid External Filter API for Cross-Filtering Grids
```typescript
// Source: AG Grid docs [CITED: ag-grid.com/react-data-grid/filter-external/]

// isExternalFilterPresent: called once per filter change detection
// doesExternalFilterPass: called once per row during filtering

// In config-data-grid.tsx:
const crossFilters = useFilterStore((s) => s.crossFilters)
const gridRef = useRef<AgGridReact>(null)

// Notify grid when cross-filters change
useEffect(() => {
  gridRef.current?.api?.onFilterChanged()
}, [crossFilters])

// Grid props:
<AgGridReact
  ref={gridRef}
  isExternalFilterPresent={() => crossFilters.length > 0}
  doesExternalFilterPass={(node) => {
    return rowPassesCrossFilters(
      node.data as Record<string, unknown>,
      crossFilters.filter((f) => f.sourceChartId !== gridId),
    )
  }}
  // ... other props
/>

// IMPORTANT: isExternalFilterPresent and doesExternalFilterPass only work
// with Client-Side Row Model (which is what ConfigDataGrid already uses).
```

### Dashboard Config Schema Extensions
```typescript
// Source: Derived from D-06, D-07, D-10 decisions [VERIFIED: CONTEXT.md]

// Additions to DashboardChartConfig:
interface DashboardChartConfig {
  // ... existing fields ...
  crossFilter?: boolean        // D-06: opt-out (default true when features.crossFilter enabled)
  drillHierarchy?: string[]    // D-10: e.g. ['break_type', 'aging_bucket']
  drillDetailDataSourceId?: string  // D-12: data source for raw detail rows
}

// Corresponding backend JSON config additions:
// "charts": [{
//   "id": "breaks-by-type",
//   "title": "Breaks by Type",
//   "type": "bar",
//   "source_type": "query",
//   "sources": [{ "data_source_id": "tlm_breaks_summary" }],
//   "drill_hierarchy": ["break_type", "aging_bucket"],
//   "drill_detail_data_source_id": "tlm_breaks_detail",
//   "layout": { "col": 0, "row": 0, "width": 6, "height": 2 }
// }]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rule-based cross-filter targeting (explicit source->target mapping) | Column-name matching (automatic) | This phase (D-07) | Simpler config, no maintenance of relationship mappings |
| Global drill state (one chart at a time) | Per-chart drill state (Map) | This phase (D-09) | Multiple charts can be drilled independently |
| Fixed 4-level drill depth | Config-defined variable hierarchy | This phase (D-10) | Each chart defines its own drill depth |
| AG Charts `formatter` for styling | AG Charts `itemStyler` with `highlightState` param | AG Charts v12+ (2025) | More granular control over highlight/dim states |
| ECharts manual opacity in options | ECharts `dispatchAction('highlight'/'downplay')` | ECharts 5+ | Cleaner API, respects chart state management |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DuckDB-WASM cold start is 500ms-2s | DuckDB Assessment | LOW -- even if faster, the 33MB download is the real blocker. Recommendation unchanged. |
| A2 | AG Charts does not support per-sector outerRadiusOffset in itemStyler for pie/donut | Code Examples | MEDIUM -- if it does, the "pull out" effect (D-04) for pie selection becomes easier. Fallback: use strokeWidth + fillOpacity for visual distinction. |
| A3 | Dashboard chart data is typically 10-500 rows (pre-aggregated) | DuckDB Assessment | LOW -- even at 10K rows, JS Array.filter is <5ms. Recommendation unchanged. |
| A4 | CSS grid auto-placement with `gridColumn: 1 / -1` insertion pushes subsequent items down correctly when existing items use `span` positioning | Architecture Patterns | LOW -- this is standard CSS grid behavior. Can verify with a quick prototype. |
| A5 | Intermediate drill levels can be re-aggregated client-side from cached data | Architecture Patterns | MEDIUM -- depends on data shape. If drill hierarchy columns aren't in the already-fetched aggregated data, a backend query is needed for intermediate levels too. |

## Open Questions

1. **Intermediate drill-level data source**
   - What we know: The final detail level fetches raw rows from backend (D-12). The overview level uses existing chart data.
   - What's unclear: Do intermediate drill levels (e.g., "Breaks by Type" -> "Breaks by Aging Bucket for type=Unmatched") need a backend query, or can they be derived from the overview data?
   - Recommendation: If the overview data includes all dimensions in the drill hierarchy, client-side re-aggregation works. If not, add `drillSources` to config that maps each intermediate level to a data source with additional group-by columns. Start with client-side and fall back to backend if needed.

2. **Cross-filter + drill interaction**
   - What we know: Cross-filters affect all charts (D-06). Drill is per-chart (D-09).
   - What's unclear: When a chart is drilled, should cross-filters still apply to it? Should the drilled chart's drill filters propagate as cross-filters to other charts?
   - Recommendation: Cross-filters apply to drilled charts (the drill narrows further). Drill filters do NOT propagate as cross-filters (drill is local to the chart). This matches Tableau behavior.

3. **KPI re-aggregation when data sources differ**
   - What we know: KPIs can have multiple sources with different data source IDs (e.g., `tlm_automatch` + `reconmgmt_manual`).
   - What's unclear: When cross-filter column exists in one KPI source but not another, how to handle?
   - Recommendation: Apply cross-filter to sources that have the column, leave others unfiltered. Sum the results. Show a subtle indicator if partial filtering was applied.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && pnpm vitest run --reporter=verbose` |
| Full suite command | `cd frontend && pnpm vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTR-01 | applyCrossFilters filters rows by column-name matching | unit | `cd frontend && pnpm vitest run src/lib/cross-filter.test.ts -t "applyCrossFilters"` | No -- Wave 0 |
| INTR-01 | addCrossFilter toggles (add/remove) correctly | unit | `cd frontend && pnpm vitest run src/stores/filter-store.test.ts -t "crossFilter"` | No -- Wave 0 |
| INTR-01 | Cross-filter skips charts without matching column | unit | `cd frontend && pnpm vitest run src/lib/cross-filter.test.ts -t "skips"` | No -- Wave 0 |
| INTR-01 | Cross-filter excludes self-chart from filtering | unit | `cd frontend && pnpm vitest run src/lib/cross-filter.test.ts -t "self"` | No -- Wave 0 |
| INTR-02 | makeItemStyler returns correct opacity for selected/unselected | unit | `cd frontend && pnpm vitest run src/components/charts/ag-chart-wrapper.test.ts` | No -- Wave 0 |
| INTR-03 | Per-chart drill state: drillDown/drillUp/drillToLevel | unit | `cd frontend && pnpm vitest run src/stores/drill-store.test.ts` | No -- Wave 0 |
| INTR-03 | Drill hierarchy from config determines max depth | unit | `cd frontend && pnpm vitest run src/hooks/use-drill-down.test.ts` | No -- Wave 0 |
| INTR-04 | Drill detail query constructs correct filters | unit | `cd frontend && pnpm vitest run src/hooks/use-drill-detail.test.ts` | No -- Wave 0 |
| INTR-04 | Backend data-source query with drill filters | unit | `cd backend && python -m pytest tests/test_query_engine.py -k "drill"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && pnpm vitest run --reporter=verbose`
- **Per wave merge:** Full frontend + backend test suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/lib/cross-filter.test.ts` -- covers INTR-01 (applyCrossFilters, rowPassesCrossFilters, column matching, self-exclusion)
- [ ] `frontend/src/stores/filter-store.test.ts` -- covers INTR-01 (addCrossFilter toggle, removeCrossFilter, clearCrossFilters)
- [ ] `frontend/src/stores/drill-store.test.ts` -- covers INTR-03 (per-chart drill state management)
- [ ] `frontend/src/hooks/use-drill-down.test.ts` -- covers INTR-03 (hierarchy-based drill depth)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in scope (deferred to v2) |
| V3 Session Management | No | No sessions in scope |
| V4 Access Control | No | No access control in scope |
| V5 Input Validation | Yes | Pydantic models for drill detail query filters; TypeScript types for cross-filter values |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via drill filter values | Tampering | Drill filters pass through QueryEngine `_build_sql` which uses parameterized `{{values}}` template with quote escaping [VERIFIED: query_engine.py] |
| Cross-site scripting via cross-filter display values | Tampering | React's JSX auto-escaping prevents XSS in cross-filter bar badge text [VERIFIED: React default behavior] |
| Denial of service via large drill detail queries | DoS | Existing `DEFAULT_MAX_ROWS = 10_000` limit in QueryEngine [VERIFIED: query_engine.py] |

## Sources

### Primary (HIGH confidence)
- Codebase review of all files listed in CONTEXT.md canonical_refs -- cross-filter store, drill store, chart wrappers, config types, dashboard renderer
- [AG Charts Events docs](https://www.ag-grid.com/charts/react/events/) -- seriesNodeClick, seriesNodeDoubleClick, nodeClickRange
- [AG Charts Stylers docs](https://www.ag-grid.com/charts/react/stylers/) -- itemStyler, highlightState parameter
- [AG Charts Series Highlighting docs](https://ag-grid.com/charts/react/series-highlighting/) -- highlight configuration, unhighlightedSeries opacity
- [AG Grid External Filter docs](https://ag-grid.com/react-data-grid/filter-external/) -- isExternalFilterPresent, doesExternalFilterPass
- [ECharts Event Handbook](https://apache.github.io/echarts-handbook/en/concepts/event/) -- click params, dispatchAction highlight/downplay
- npm pack @duckdb/duckdb-wasm -- actual WASM binary sizes verified locally

### Secondary (MEDIUM confidence)
- [Browser Data Processing Benchmarks](https://github.com/timlrx/browser-data-processing-benchmarks) -- DuckDB vs Arquero vs SQLite performance on 1M rows
- [DuckDB-WASM GitHub discussions](https://github.com/duckdb/duckdb-wasm/discussions/1469) -- bundle size concerns, ~17MB default build

### Tertiary (LOW confidence)
- Medium articles on DuckDB-WASM + React dashboards -- promotional content, no hard benchmarks
- MotherDuck blog on DuckDB-WASM -- conceptual, no performance metrics

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and proven in codebase
- Architecture: HIGH -- patterns derived from existing working code + official API docs
- DuckDB assessment: HIGH -- verified actual binary sizes, cross-referenced benchmarks
- Pitfalls: HIGH -- derived from codebase analysis of actual integration points
- Legacy code evaluation: HIGH -- every file read and analyzed line-by-line
- Drill detail grid CSS layout: MEDIUM -- standard CSS grid behavior but untested with this specific layout

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- no fast-moving dependencies)
