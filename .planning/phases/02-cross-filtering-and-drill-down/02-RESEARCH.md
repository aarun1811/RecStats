# Phase 2: Cross-Filtering and Drill-Down - Research

**Researched:** 2026-04-05 (updated with corrected client-side engine analysis)
**Domain:** Client-side interactive data filtering, KPI re-aggregation, chart click events, drill-down navigation, CSS grid layout manipulation
**Confidence:** HIGH

## Summary

This phase adds two major interactive features to the existing config-driven dashboard renderer: (1) cross-filtering -- where clicking a chart element instantly filters all other charts on the same dashboard with zero network calls, and (2) drill-down -- where clicking aggregated data navigates through breakdown levels to a raw detail grid powered by the backend.

The core technical challenge is KPI re-aggregation under cross-filters. KPIs use different formulas -- SUMs, ratios (match rate = automatch_items / total_items * 100), percentages (breaks as % of total_items). You cannot derive these from pre-aggregated KPI values; you must re-run the aggregation on the filtered subset. This is the same problem Tableau solves with Hyper and Power BI solves with VertiPaq -- both load data into an in-memory engine and re-compute aggregations when cross-filters change.

**The critical data volume question, answered:** RecViz dashboards query Oracle/Hive via Superset with GROUP BY clauses (e.g., by agent_code, set_id, stmt_date, bran_code). The data returned to the browser is the grouped result set, not millions of raw transaction rows. For a typical dashboard with filters narrowing to one TLM instance and a date range, the per-data-source row count is estimated at 1,000-50,000 rows depending on granularity. At these volumes, plain JavaScript array filtering plus manual aggregation completes in under 5ms even at 100K rows (verified via benchmark on this machine). DuckDB-WASM, Perspective, and Arquero all add significant download/initialization overhead that is not justified for this data scale. The previous research was wrong about the *reason* (it assumed 10-500 rows of pre-aggregated data) but the *conclusion* (plain JS is sufficient) holds even with the corrected framing.

**Primary recommendation:** Use a **Cross-Filter Data Layer** pattern: when a dashboard loads, cache all chart and KPI source data in a normalized in-memory store (keyed by data source ID). When cross-filters change, re-filter and re-aggregate from this cache using plain JS. KPI formulas execute as JavaScript functions over the filtered data. No WASM engine needed. A Web Worker is the upgrade path if data volumes grow beyond 100K rows per data source (which would indicate a need to add an intermediate aggregation level on the backend anyway).

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
- **D-14:** Research DuckDB-WASM as potential client-side engine. (Research complete -- see Client-Side Engine Assessment below.)
- **D-15:** Evaluate legacy cross-filter/drill-down code objectively. (Evaluation complete -- see Legacy Code Evaluation section.)

### Claude's Discretion
- Cross-filter indicator bar design and placement (D-05)
- Whether DuckDB-WASM is viable or if simpler approach is better (research recommends plain JS -- see detailed assessment)
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
| INTR-01 | Cross-filtering -- click chart segment to filter all other charts; client-side only, zero network calls, instant response | Cross-Filter Data Layer: cache per-data-source rows, re-filter + re-aggregate via JS; Zustand state; AG Charts seriesNodeClick + ECharts click; column-name matching |
| INTR-02 | Cross-filter visual state -- selected items full color, excluded items dimmed; selection bar with active cross-filters and one-click removal | AG Charts itemStyler with fillOpacity; ECharts dispatchAction highlight/downplay; existing CrossFilterBar badge component |
| INTR-03 | Drill-down -- click aggregated data to see breakdown then detail rows; breadcrumb navigation | Per-chart drill store; config-defined drillHierarchy; client-side re-aggregation for intermediate levels; breadcrumb component |
| INTR-04 | Drill-down detail level fetches raw rows from backend via AG Grid with full sort/filter/pagination | Backend data-source query endpoint already exists; new drill-detail query with additional WHERE clauses; AG Grid with backend-fetched data |
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

## Client-Side Engine Assessment

### The Correct Framing of the Problem

RecViz is a BI tool for 12,000+ reconciliations across Citi's GRU. Dashboards display data from Oracle/Hive databases containing thousands to millions of records per reconciliation. KPIs have diverse formulas:

- **Simple SUM:** Total Items = SUM(total_items) across data sources
- **Ratio:** Match Rate = automatch_items / total_items * 100
- **Percentage of reference:** Breaks as % of Total Items
- **Multi-source aggregation:** Total Items = SUM from tlm_automatch + SUM from reconmgmt_manual

When a user cross-filters (e.g., clicks "APAC" on a region bar chart), ALL KPIs must recompute using only the APAC subset. You cannot simply filter the pre-computed KPI value "Total Items = 50,000" to get "Total Items for APAC" -- you must re-sum the individual rows that belong to APAC. For ratio KPIs like Match Rate, you must re-sum both numerator (automatch_items for APAC rows) and denominator (total_items for APAC rows) and then divide.

This is the same pattern Tableau uses Hyper for, and Power BI uses VertiPaq for. Both are in-memory columnar engines that re-run aggregation queries when slicers/filters change.

### What Data Actually Reaches the Browser

Examining the actual SQL queries in `backend/app/config/data_sources/`:

**tlm_automatch.json** query:
```sql
SELECT b.agent_code, b.local_acc_no AS set_id, mf.bran_code, i.stmt_date, mf.corr_acc_no,
       COUNT(CASE WHEN i.flag_2 IN (0,1,11) THEN 1 END) AS total_items,
       COUNT(CASE WHEN th.last_action_owner IN ('SYSTEM','system','AUTONET') AND i.flag_2 = 1 THEN 1 END) AS automatch_items
FROM bank b JOIN ... WHERE 1=1 {{filters}}
GROUP BY b.agent_code, b.local_acc_no, mf.bran_code, i.stmt_date, mf.corr_acc_no
```

The browser receives **the GROUP BY result set**, not raw transaction rows. The granularity is per (agent_code, set_id, branch, date, corr_account). For a typical dashboard query:

| Scenario | Estimated Rows | Reasoning |
|----------|---------------|-----------|
| Single TLM instance, 1 day, all recons | 500-5,000 | ~100 agent_codes * ~10 set_ids * 1 date * ~5 branches (many combinations sparse) |
| Single TLM instance, 7 days, all recons | 3,000-30,000 | Same as above * 5-7 business days |
| Single TLM instance, 30 days, all recons | 10,000-100,000 | Same * 20-22 business days |
| All TLM instances (if supported), 30 days | 30,000-300,000 | 3 instances * above |

[ASSUMED -- exact row counts depend on production data distribution; estimates based on schema cardinality]

### Candidate Evaluation

#### 1. DuckDB-WASM

**Bundle size:** [VERIFIED: npm pack @duckdb/duckdb-wasm 1.33.1-dev20.0]
- EH variant WASM: 32.7MB uncompressed, **7.3MB gzipped**
- JS worker: 755KB uncompressed, 184KB gzipped
- JS client: 31KB uncompressed, 8KB gzipped
- **Total network download: ~7.5MB gzipped** (first load, cached after)

**Initialization:** Requires WASM compile + worker setup. Cold start estimated at 500ms-2s depending on hardware [ASSUMED -- no official benchmarks found, based on Motif Analytics real-world report of DuckDB WASM running ~4x slower than native]. The DuckDB Shell demo claims 3.2MB transfer because it uses CDN-served assets with extension lazy-loading [CITED: github.com/duckdb/duckdb-wasm].

**Performance on 1M rows:** On aggregation (count, mean, total): 0.014ms. On GROUP BY: 0.163ms [CITED: timlrx.com/blog/the-best-in-browser-data-processing-framework-is-sql -- 1M Bandcamp sales dataset benchmark].

**Memory limit:** WASM in Chrome is hard-capped at 4GB [CITED: v8.dev/blog/4gb-wasm-memory]. Practical limit with data overhead is ~2-3GB of actual data.

**Pros:**
- Full SQL engine -- can express any KPI formula as SQL
- Columnar storage -- excellent compression and scan performance
- Well-maintained by DuckDB Labs
- Can query Parquet files directly (future use)

**Cons:**
- 7.5MB gzipped download is 3-4x the entire RecViz frontend (~2MB)
- Cold start latency adds noticeable delay to first dashboard load
- Requires managing WASM worker lifecycle, data serialization into DuckDB tables
- Corporate on-prem environment may have issues with CDN loading; must self-host WASM binary
- Overkill for the actual data volume (1K-100K grouped rows)

**Verdict: NOT RECOMMENDED for this phase.** The performance advantage only matters at millions of rows. RecViz's cross-filter datasets are grouped result sets in the 1K-100K range. The 7.5MB download and cold-start overhead are not justified.

#### 2. Perspective (FINOS)

**Bundle size:** [VERIFIED: npm pack @finos/perspective 3.8.0]
- Server WASM: 2.2MB uncompressed, **2.2MB gzipped** (already compressed)
- JS WASM: 212KB uncompressed, 206KB gzipped
- Worker: 5.7KB, Client: 31.9KB
- **Total network download: ~2.5MB gzipped**

**Capabilities:** Built-in aggregations including WEIGHTED_MEAN, PCT_SUM_PARENT, PCT_SUM_GRAND_TOTAL, plus expression language for computed columns [CITED: deepwiki.com/finos/perspective/2.3-pivoting-and-aggregation]. Has streaming support, pivot tables, and a Web Worker architecture.

**Pros:**
- Smaller than DuckDB (2.5MB vs 7.5MB)
- Purpose-built for BI-style analytics (pivot, aggregate, filter)
- Expression language can define KPI formulas
- View abstraction naturally maps to cross-filter scenarios (create filtered views)
- Developed by JP Morgan (financial services pedigree)

**Cons:**
- Still 2.5MB for functionality achievable in plain JS at these data volumes
- Tightly coupled architecture -- designed as a complete rendering+engine solution
- Using it as a headless engine (without perspective-viewer) is possible but not the primary use case
- Adds a significant C++/WASM dependency to debug when things go wrong
- Limited community compared to DuckDB

**Verdict: NOT RECOMMENDED for this phase.** Closer to the sweet spot than DuckDB (purpose-built for BI, smaller) but still unnecessary overhead for 1K-100K grouped rows. Worth revisiting if RecViz later needs client-side pivot tables or if data volumes grow significantly.

#### 3. Arquero (Observable)

**Bundle size:** [VERIFIED: npm view arquero 8.0.3]
- Total package: 2.7MB unpackaged (JS only, no WASM)
- Gzipped estimate: ~105KB [CITED: timlrx.com/blog -- "Arquero at 105kB"]

**Performance on 1M rows:** Aggregation: 0.067ms. GROUP BY: 1.05ms [CITED: timlrx.com/blog -- benchmark on 1M Bandcamp sales]. ~5x slower than DuckDB but still sub-millisecond.

**Pros:**
- Pure JavaScript -- no WASM, no Worker required
- Very small bundle (105KB gzipped)
- DataFrame-style API natural for data scientists
- Good for data transformation pipelines

**Cons:**
- Learning curve for team (dplyr-style verbs)
- Still an external dependency for operations achievable with plain JS
- Less maintained than it was (Observable shifted focus)

**Verdict: NOT RECOMMENDED but closest to viable.** At 105KB, the bundle cost is negligible. But the API provides no advantage over plain JS Array.filter() + reduce() for the cross-filter use case. Arquero's value is in complex transformations (joins, window functions, reshaping) which cross-filtering doesn't need.

#### 4. Web Workers + JS Array Operations

**Bundle size:** Zero additional download.

**Performance (benchmarked on this machine -- Apple Silicon, Node.js as browser proxy):** [VERIFIED: local benchmark]

| Data Volume | Filter only | Filter + SUM + Ratios (4 KPIs) | Filter + 5 charts GROUP BY |
|-------------|-------------|----------------------------------|---------------------------|
| 1K rows | 0.01ms | 0.01ms | 0.08ms |
| 10K rows | 0.06ms | 0.08ms | 0.23ms |
| 50K rows | 0.31ms | 0.07ms | 1.02ms |
| 100K rows | 0.69ms | 0.17ms | 2.58ms |
| 500K rows | 1.45ms | 0.94ms | 26.15ms |

For the complex scenario (2 active cross-filters + 4 KPI re-aggregation with ratios):
- At 100K rows: **0.17ms** -- imperceptible
- At 500K rows: **0.94ms** -- still imperceptible

For the full scenario (1 cross-filter + re-aggregate 5 charts via GROUP BY):
- At 100K rows: **2.58ms** -- imperceptible
- At 500K rows: **26.15ms** -- noticeable on main thread, but a Web Worker eliminates it

**Pros:**
- Zero bundle size impact
- Zero initialization overhead
- No external dependency to manage, debug, or update
- Team already knows JS
- Web Worker upgrade path for future if needed (move computation off main thread)
- All data stays in standard JS objects (no serialization to/from WASM)

**Cons:**
- Complex KPI formulas must be hand-written as JS functions (no SQL expressiveness)
- At 500K+ rows with many charts, main thread may stutter (>16ms budget) -- requires Web Worker
- No built-in indexing (linear scan every time)

**Verdict: RECOMMENDED.** This is the right approach for RecViz's data scale.

#### 5. Hybrid Approach

Load small datasets (< 50K rows) in plain JS; switch to DuckDB-WASM for larger datasets.

**Verdict: NOT RECOMMENDED.** The complexity of maintaining two code paths (JS functions + SQL queries for the same KPI formulas) is not justified when plain JS handles 100K rows in <3ms. The correct hybrid is: plain JS now, Web Worker for main-thread relief if needed.

### Recommendation Summary

| Approach | Download | Cold Start | 100K rows | Recommended? |
|----------|----------|------------|-----------|-------------|
| DuckDB-WASM | 7.5MB gz | 500ms-2s | <1ms | No -- overkill |
| Perspective | 2.5MB gz | 300ms-1s | <1ms | No -- overkill |
| Arquero | 105KB gz | ~0ms | <1ms | No -- unnecessary |
| JS Array + Web Worker | 0KB | 0ms | 2.6ms | **Yes** |

**The upgrade path** if data volumes grow beyond expectations:
1. **Phase 2 (now):** Plain JS Array.filter() + reduce/Map for aggregation. All computation on main thread.
2. **If needed:** Move the aggregation functions to a Web Worker. Data transfer via `structuredClone` (fast for plain objects). Same JS code, just off main thread.
3. **If 1M+ rows client-side:** Re-evaluate DuckDB-WASM or Perspective. But at that volume, the real fix is adding an intermediate aggregation layer on the backend (e.g., pre-aggregate to desk+date level before sending to browser).

### How Tableau and Power BI Compare

Both Tableau (Hyper) and Power BI (VertiPaq) use native columnar engines because they handle datasets of millions of rows in a desktop application with direct memory access. RecViz is:

1. **Browser-based** (WASM memory cap at 4GB, JS heap typically 1-2GB before GC pressure) [CITED: v8.dev/blog/4gb-wasm-memory]
2. **Working with pre-aggregated data** (GROUP BY results, not raw transactions)
3. **Filtered by global filters first** (TLM instance + date range narrow the data before it reaches the browser)

The equivalent of Hyper/VertiPaq in RecViz is **Superset + Redis cache on the backend**. The browser receives a manageable subset. Cross-filtering operates on that subset.

## Standard Stack

### Core (Already Installed -- No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.11 | Cross-filter + drill state management | Already the project's client state manager [VERIFIED: frontend/package.json] |
| @tanstack/react-query | ^5.90.20 | Server state for drill detail queries + cross-filter data caching | Already the project's server state manager [VERIFIED: frontend/package.json] |
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
| @duckdb/duckdb-wasm | Too heavy for data scale | 7.5MB gzipped download; 500ms-2s cold start. JS handles 100K rows in 2.6ms. See full assessment above. |
| @finos/perspective | Overkill for data scale | 2.5MB gzipped. Purpose-built for BI but adds WASM dependency for operations achievable in JS. |
| arquero | Unnecessary | 105KB is cheap but provides no advantage over plain JS for filter+aggregate. |
| Web Workers (dedicated) | Premature optimization | JS on main thread handles 100K rows in <3ms. Worker serialization overhead would slow down small datasets. Add later if data grows. |

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
│   ├── use-cross-filter-data.ts # NEW: cross-filter data layer — caches data, applies filters, re-aggregates
│   ├── use-drill-down.ts        # REWRITE: per-chart drill with config-defined hierarchy
│   └── use-drill-detail.ts      # NEW: TanStack Query hook for drill detail backend queries
├── lib/
│   ├── cross-filter.ts          # MODIFY: add KPI re-aggregation + chart re-aggregation helpers
│   └── kpi-aggregator.ts        # NEW: KPI formula execution engine (sum, ratio, percentage_of)
├── components/
│   ├── dashboard/
│   │   ├── dashboard-renderer.tsx    # MODIFY: wire cross-filter + drill state
│   │   ├── config-chart-grid.tsx     # MODIFY: click handlers, dimming, drill grid insertion
│   │   ├── config-kpi-row.tsx        # MODIFY: consume cross-filtered re-aggregated KPI values
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

### Pattern 1: Cross-Filter Data Layer

**What:** A centralized data cache that holds all chart and KPI source data for the current dashboard. When cross-filters change, this layer re-filters and re-aggregates without any network calls.

**When to use:** Every dashboard that has `features.crossFilter: true`.

**Why this is the key architecture decision:** The current system fetches KPI data via a dedicated backend endpoint (`POST /api/dashboards/{id}/kpis`) which runs SQL queries and aggregates server-side. When cross-filters are active, we need to re-aggregate from the underlying data, not just filter pre-computed KPI values. The data layer solves this by caching the data-source-level rows and re-computing KPIs client-side.

```typescript
// Source: Architecture design based on codebase analysis [VERIFIED: codebase]

// The Cross-Filter Data Layer caches raw data-source rows keyed by data source ID.
// Multiple charts and KPIs may share the same data source — the cache deduplicates fetches.

interface CrossFilterDataCache {
  // Keyed by dataSourceId, holds the rows returned from backend
  dataSources: Map<string, DataSourceRows>
  // When cross-filters are active, derived data is computed via useMemo
}

interface DataSourceRows {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

// Hook: use-cross-filter-data.ts
// This hook:
// 1. Collects all unique data source IDs from KPIs + charts
// 2. Fetches each via useDataSourceQuery (TanStack Query handles caching)
// 3. When cross-filters are active, applies them to cached rows
// 4. Re-aggregates KPI values from filtered rows
// 5. Re-aggregates chart data from filtered rows (GROUP BY)

function useCrossFilterData(
  dashboardConfig: DashboardConfig,
  appliedFilters: Record<string, FilterValue>,
  crossFilters: CrossFilter[],
) {
  // Fetch all unique data sources used by KPIs and charts
  const dataSourceIds = useMemo(() => {
    const ids = new Set<string>()
    for (const kpi of dashboardConfig.kpis) {
      for (const source of kpi.sources) ids.add(source.dataSourceId)
    }
    for (const chart of dashboardConfig.charts) {
      if (chart.sourceType === 'query') {
        for (const source of chart.sources ?? []) ids.add(source.dataSourceId)
      }
    }
    return Array.from(ids)
  }, [dashboardConfig])

  // TanStack Query fetches each data source (deduplicated, cached)
  const queries = useQueries({
    queries: dataSourceIds.map((id) => ({
      queryKey: ['data-source', id, appliedFilters],
      queryFn: () => api.post<DataSourceQueryResponse>(
        `/api/data-sources/${id}/query`,
        { filters: appliedFilters },
      ),
    })),
  })

  // When cross-filters change, re-compute KPI values from cached data
  const crossFilteredKpis = useMemo(() => {
    if (crossFilters.length === 0) return null // use server-computed values
    return recomputeKpis(dashboardConfig.kpis, queries, crossFilters)
  }, [crossFilters, queries, dashboardConfig.kpis])

  return { queries, crossFilteredKpis }
}
```

### Pattern 2: KPI Re-Aggregation Engine

**What:** A pure function that takes KPI config, cached data-source rows, and active cross-filters, and recomputes KPI values using the formulas defined in config.

**When to use:** Whenever cross-filters change and KPIs need to update.

```typescript
// Source: Derived from backend KPI computation logic in dashboards.py [VERIFIED: codebase]

// The backend computes KPIs by iterating data-source rows and summing metrics.
// The client-side version does the same thing, but on cross-filtered rows.

interface KpiComputeResult {
  id: string
  value: number
  percentage?: number
}

function recomputeKpis(
  kpiConfigs: KpiConfig[],
  dataCache: Map<string, DataSourceRows>,
  crossFilters: CrossFilter[],
): KpiComputeResult[] {
  const kpiValues = new Map<string, number>()

  for (const kpi of kpiConfigs) {
    let total = 0
    for (const source of kpi.sources) {
      const data = dataCache.get(source.dataSourceId)
      if (!data) continue

      // Apply cross-filters (column-name matching)
      const filtered = applyCrossFiltersToRows(data.rows, crossFilters)

      // Sum the metric column
      for (const row of filtered) {
        const val = row[source.metric]
        if (val != null) total += Number(val)
      }
    }
    kpiValues.set(kpi.id, total)
  }

  // Compute derived KPIs (percentage_of)
  return kpiConfigs.map((kpi) => {
    const result: KpiComputeResult = {
      id: kpi.id,
      value: kpiValues.get(kpi.id) ?? 0,
    }
    if (kpi.trend?.type === 'percentage_of') {
      const refValue = kpiValues.get(kpi.trend.referenceKpi) ?? 0
      result.percentage = refValue > 0
        ? (result.value / refValue) * 100
        : 0
    }
    return result
  })
}

// This mirrors the backend logic in dashboards.py:
// for kpi in config.kpis:
//   for source in kpi.sources:
//     result = await query_engine.execute(ds_config, body.filters)
//     for row in result.get("rows", []):
//       total += float(row.get(source.metric))
```

**Key insight:** The client-side KPI re-aggregation exactly mirrors the backend endpoint (`POST /dashboards/{id}/kpis`). Both iterate rows and sum metrics. The difference is:
- **Backend:** Runs SQL, gets fresh data, aggregates
- **Client-side under cross-filter:** Takes cached data, filters by cross-filter columns, aggregates

This means KPI formulas defined in config (aggregation: "sum", trend: { type: "percentage_of", reference_kpi: "total_items" }) execute identically in both paths.

### Pattern 3: Cross-Filter Data Flow (Updated)

**What:** Click events flow from chart wrappers through Zustand state, then trigger client-side re-filtering and re-aggregation of ALL dashboard data.

**When to use:** Every chart click that should filter other charts.

```typescript
// Source: Pattern derived from existing codebase architecture [VERIFIED: codebase]

// 1. Chart click -> dispatch to store (same as before)
const handleCrossFilterClick = useCallback((event: ChartClickEvent) => {
  addCrossFilter({
    sourceChartId: event.chartId,
    column: event.column,
    value: event.value,
  })
}, [addCrossFilter])

// 2. Store toggle logic (already exists in filter-store.ts)
// addCrossFilter already implements toggle: same value = remove

// 3. Cross-Filter Data Layer recomputes ALL derived data
// In dashboard-renderer.tsx:
const crossFilters = useFilterStore((s) => s.crossFilters)
const { crossFilteredKpis } = useCrossFilterData(
  dashboardConfig, appliedFilters, crossFilters
)

// 4. Charts apply cross-filters to their own cached data
const filteredData = useMemo(() => {
  return applyCrossFilters(rawData, crossFilters, chartId)
}, [rawData, crossFilters, chartId])

// 5. KPIs consume cross-filtered values
// When crossFilters.length > 0: use crossFilteredKpis (client-computed)
// When crossFilters.length === 0: use server-computed KPIs (original behavior)
```

### Pattern 4: Column-Name Matching for Cross-Filter Targeting

**What:** Cross-filters apply automatically to any chart whose cached data contains the filtered column name. No configuration needed.

**When to use:** When determining which charts should respond to a cross-filter.

```typescript
// Source: Decision D-07, existing applyCrossFilters [VERIFIED: codebase]

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

// For KPI re-aggregation, a similar function operates on raw rows:
function applyCrossFiltersToRows(
  rows: Record<string, unknown>[],
  crossFilters: CrossFilter[],
): Record<string, unknown>[] {
  if (rows.length === 0 || crossFilters.length === 0) return rows
  let filtered = rows
  for (const filter of crossFilters) {
    if (filter.column in filtered[0]) {
      filtered = filtered.filter((row) => row[filter.column] === filter.value)
    }
  }
  return filtered
}
```

### Pattern 5: Per-Chart Drill State

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

### Pattern 6: Drill-Down Detail Grid Insertion via CSS Grid

**What:** When a chart reaches its deepest drill level, a full-width AG Grid appears directly below the row containing the drilled chart in the CSS grid layout.

**When to use:** Detail level of any drill-down.

```typescript
// Source: CSS Grid specification + existing config-chart-grid layout [VERIFIED: codebase]

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

**Key insight:** CSS grid auto-placement means inserting a `gridColumn: 1 / -1` (full-width) element between existing grid items will naturally push subsequent items down. The current code uses `span` which is compatible.

### Anti-Patterns to Avoid
- **Global drill state for multi-chart dashboards:** The old `drill-store.ts` has a single `sourceChartId` -- drilling one chart would break all others. Must be per-chart.
- **Rule-based cross-filter targeting:** The old `use-cross-filter.ts` uses `CrossFilterRule` with explicit `sourceChart -> targetCharts` mapping. This violates D-07 (column-name matching). Remove `CrossFilterRule` entirely.
- **Re-fetching from backend on cross-filter clicks:** Cross-filtering must be client-side only (INTR-01). Never trigger API calls when a cross-filter is applied.
- **Storing cross-filtered data in Zustand:** Derived data from cross-filters should be computed via `useMemo` in components, not stored in Zustand.
- **Filtering pre-computed KPI values:** You cannot derive "Total Items for APAC" from the pre-computed "Total Items = 50,000". You must re-sum from the underlying rows. This is the whole reason for the Cross-Filter Data Layer.
- **Using DuckDB-WASM for pre-aggregated data:** 7.5MB download for filtering operations that complete in <3ms with plain JS.

## Legacy Code Evaluation

### filter-store.ts (Cross-Filter State)
**Verdict: KEEP and evolve**
- The `crossFilters[]` array, `addCrossFilter` (with toggle), `removeCrossFilter`, and `clearCrossFilters` are all solid [VERIFIED: codebase review]
- Toggle semantics in `addCrossFilter` already match D-01 (click same element = remove)
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
- Add: `applyCrossFiltersToRows()` for KPI re-aggregation (operates on raw row arrays)
- Add: KPI re-aggregation helper function (`recomputeKpis`)

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
- Add animation for badge appear/disappear (Motion AnimatePresence)

### config-kpi-row.tsx (KPI Component)
**Verdict: MODIFY significantly**
- Currently fetches KPIs via `useDashboardKpis` hook which calls `POST /api/dashboards/{id}/kpis` [VERIFIED: codebase review]
- For cross-filtering, needs dual-path: server-computed KPIs when no cross-filters, client-computed when cross-filters active
- The `CountAnimation` component can animate between old and new values during cross-filter transitions

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart click events | Custom DOM event listeners on chart canvas | AG Charts `seriesNodeClick` / ECharts `click` event | Chart libraries handle hit testing, datum resolution, series identification |
| Chart element dimming | Custom SVG/Canvas opacity manipulation | AG Charts `itemStyler` with `fillOpacity` / ECharts `dispatchAction('downplay')` | Libraries handle rendering pipeline, animation, and theme integration |
| Grid external filtering | Manual row hiding/DOM manipulation | AG Grid `isExternalFilterPresent` + `doesExternalFilterPass` + `api.onFilterChanged()` | AG Grid handles virtual scrolling, pagination, and performance |
| Full-width grid insertion | Absolute positioning / manual layout calc | CSS Grid `gridColumn: 1 / -1` auto-placement | CSS engine handles reflow, animation can be added via Motion |
| Toggle state management | Custom state diffing | Zustand with toggle logic in `addCrossFilter` | Already implemented, battle-tested in existing store |
| Client-side SQL engine | DuckDB-WASM / Perspective / Arquero | Plain JS Array.filter() + reduce() + Map | Data volumes are 1K-100K rows; JS handles this in <3ms; no external engine justified |
| KPI formulas | Generic expression parser | Explicit JS functions matching backend logic | RecViz has a small, known set of KPI formula types (sum, percentage_of); no need for a generic expression engine |

**Key insight:** The cross-filter data layer is pure JavaScript operating on data already cached by TanStack Query. No new dependencies, no WASM, no serialization overhead. The "engine" is `Array.filter()` + `for...of` + `Map`.

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
**How to avoid:** Consider using single-click for cross-filter and double-click for drill-down (the existing pattern). The 250ms delay is inherent in any single/double-click disambiguation. Alternative: use different gestures (e.g., click for cross-filter, Ctrl+click or context menu for drill-down) to eliminate delay entirely.
**Warning signs:** Users complain about click response feeling slow.

### Pitfall 4: CSS Grid Layout Breaks When Inserting Detail Grid
**What goes wrong:** Inserting a full-width element between grid items disrupts the visual layout.
**Why it happens:** CSS grid auto-placement and explicit placement interact in complex ways.
**How to avoid:** Ensure all chart positioning uses relative `span` values (not absolute row/column numbers). The current code already does this correctly.
**Warning signs:** Charts overlap or jump to unexpected positions when drill detail opens.

### Pitfall 5: KPI Re-aggregation Accuracy
**What goes wrong:** Cross-filtered KPI values don't match what a manual calculation would show.
**Why it happens:** Client-side aggregation doesn't perfectly replicate the backend SQL (e.g., the backend may apply additional WHERE clauses, or the SQL may use CASE expressions that aren't reflected in the raw data).
**How to avoid:** Ensure the KPI re-aggregation logic mirrors the backend exactly. The backend iterates rows and sums the metric column (see `dashboards.py` lines 56-68). The client does the same on cached rows. Test with known data to verify values match.
**Warning signs:** KPI "Total" doesn't equal the sum of visible chart segments.

### Pitfall 6: Drill-Down State Persisting Across Dashboard Navigation
**What goes wrong:** User drills into a chart, navigates to another dashboard, comes back -- the drill state is still active.
**Why it happens:** Zustand stores persist across route changes unless explicitly cleared.
**How to avoid:** Reset all drill state when dashboard `config.id` changes. Add cleanup in `DashboardRenderer` useEffect.
**Warning signs:** User sees a detail grid when they expect the overview.

### Pitfall 7: Data Volume Surprise
**What goes wrong:** A dashboard with a 30-day date range and no recon filter loads 100K+ rows per data source, making main-thread filtering take 20ms+ and causing jank.
**Why it happens:** Large date ranges with loose filters produce many GROUP BY combinations.
**How to avoid:** Monitor data source row counts. If any single fetch returns >50K rows, log a warning. The architecture supports a Web Worker upgrade path without API changes. For the initial implementation, the `DEFAULT_MAX_ROWS = 10_000` limit on the backend provides a natural ceiling [VERIFIED: query_engine.py].
**Warning signs:** `DataSourceQueryResponse.truncated === true` in any query result.

## Code Examples

### AG Charts Click Events (seriesNodeClick)
```typescript
// Source: Existing ag-chart-wrapper.tsx [VERIFIED: codebase] + AG Charts docs [CITED: ag-grid.com/charts/react/events/]

listeners: {
  seriesNodeClick: (event: { datum: Record<string, unknown> }) => {
    if (!event.datum) return
    const payload: ChartClickEvent = {
      chartId,
      column: categoryKey,
      value: event.datum[categoryKey] as string | number,
      row: event.datum,
    }
    clickHandlerRef.current?.(payload)
  },
  seriesNodeDoubleClick: (event: { datum: Record<string, unknown> }) => {
    if (!event.datum) return
    dblClickHandlerRef.current?.({
      chartId,
      column: categoryKey,
      value: event.datum[categoryKey] as string | number,
      row: event.datum,
    })
  },
}
```

### AG Charts itemStyler for Cross-Filter Dimming
```typescript
// Source: Existing ag-chart-wrapper.tsx makeItemStyler [VERIFIED: codebase]
// + AG Charts stylers docs [CITED: ag-grid.com/charts/react/stylers/]

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
```

### ECharts Click Events and Highlight/Downplay
```typescript
// Source: ECharts handbook [CITED: apache.github.io/echarts-handbook/en/concepts/event/]

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

// For programmatic dimming:
// chartRef.current.getEchartsInstance().dispatchAction({ type: 'downplay', seriesIndex: 0 })
// chartRef.current.getEchartsInstance().dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: N })
```

### AG Grid External Filter API for Cross-Filtering Grids
```typescript
// Source: AG Grid docs [CITED: ag-grid.com/react-data-grid/filter-external/]

const crossFilters = useFilterStore((s) => s.crossFilters)
const gridRef = useRef<AgGridReact>(null)

useEffect(() => {
  gridRef.current?.api?.onFilterChanged()
}, [crossFilters])

<AgGridReact
  ref={gridRef}
  isExternalFilterPresent={() => crossFilters.length > 0}
  doesExternalFilterPass={(node) => {
    return rowPassesCrossFilters(
      node.data as Record<string, unknown>,
      crossFilters.filter((f) => f.sourceChartId !== gridId),
    )
  }}
/>
```

### Dashboard Config Schema Extensions
```typescript
// Source: Derived from D-06, D-07, D-10 decisions [VERIFIED: CONTEXT.md]

interface DashboardChartConfig {
  // ... existing fields ...
  crossFilter?: boolean        // D-06: opt-out (default true when features.crossFilter enabled)
  drillHierarchy?: string[]    // D-10: e.g. ['break_type', 'aging_bucket']
  drillDetailDataSourceId?: string  // D-12: data source for raw detail rows
}
```

## Data Volume Analysis

### Memory Budget

| Data Volume | Memory (est.) | Cross-filter Latency | Verdict |
|-------------|---------------|---------------------|---------|
| 1K rows | ~0.4MB | <0.1ms | Trivial |
| 10K rows | ~4.4MB | <0.3ms | Comfortable |
| 50K rows | ~22MB | ~1ms | Fine |
| 100K rows | ~44MB | ~3ms | Acceptable (within 16ms frame budget) |
| 500K rows | ~218MB | ~26ms | Needs Web Worker (exceeds frame budget) |

[VERIFIED: benchmarked locally with realistic RecViz row shapes]

### Backend Guardrails

The `DEFAULT_MAX_ROWS = 10_000` limit in `QueryEngine` [VERIFIED: backend/app/services/query_engine.py] naturally caps per-query results. With 4-5 data sources per dashboard, the total client-side data is ~40K-50K rows max. This is well within the comfortable zone.

**If a dashboard needs more data (e.g., 30-day range with loose filters):**
1. Backend should add an intermediate aggregation level (e.g., aggregate to desk+date, not full detail)
2. Or increase `max_rows` selectively with the understanding that cross-filter latency will increase

### Recommendation for Data Loading Strategy

**Load the same data that charts display.** The GROUP BY result sets from Superset are the right granularity for cross-filtering. Do NOT attempt to load raw transaction data (millions of rows) into the browser. That data belongs on the backend and is only fetched for drill-down detail (D-12).

The Cross-Filter Data Layer fetches data via the same `/api/data-sources/{id}/query` endpoint that charts already use. TanStack Query deduplicates requests -- if a chart has already fetched the data, the data layer uses the cached result.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rule-based cross-filter targeting | Column-name matching (automatic) | This phase (D-07) | Simpler config, no maintenance of relationship mappings |
| Global drill state (one chart) | Per-chart drill state (Map) | This phase (D-09) | Multiple charts can be drilled independently |
| Fixed 4-level drill depth | Config-defined variable hierarchy | This phase (D-10) | Each chart defines its own drill depth |
| Server-computed KPIs only | Dual path: server (no cross-filter) + client (cross-filtered) | This phase (D-08) | KPIs respond instantly to cross-filter clicks |
| AG Charts `formatter` for styling | AG Charts `itemStyler` with `highlightState` param | AG Charts v12+ (2025) | More granular control over highlight/dim states |
| ECharts manual opacity | ECharts `dispatchAction('highlight'/'downplay')` | ECharts 5+ | Cleaner API, respects chart state management |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dashboard data volumes are 1K-100K grouped rows (not millions of raw rows) | Client-Side Engine Assessment | HIGH -- if dashboards need >100K rows client-side, the JS approach still works but needs Web Worker. If >500K, need DuckDB-WASM. Backend MAX_ROWS=10K mitigates this. |
| A2 | DuckDB-WASM cold start is 500ms-2s | Client-Side Engine Assessment | LOW -- even if faster, the 7.5MB download is the real blocker for corporate on-prem. |
| A3 | AG Charts does not support per-sector outerRadiusOffset in itemStyler for pie/donut | Code Examples | MEDIUM -- if it does, pie "pull out" effect (D-04) becomes easier. Fallback: strokeWidth + fillOpacity. |
| A4 | CSS grid auto-placement with `gridColumn: 1 / -1` pushes subsequent items down correctly | Architecture Patterns | LOW -- standard CSS grid behavior. |
| A5 | Client-side KPI re-aggregation matches backend values exactly | KPI Re-Aggregation Engine | MEDIUM -- floating point differences possible. The backend SQL may apply rounding or type coercion differently. Test with known data. |
| A6 | Perspective's expression language can handle RecViz KPI formulas | Perspective assessment | LOW -- irrelevant since we're not using Perspective. Noted for future reference. |

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

4. **Web Worker upgrade path timing**
   - What we know: JS handles 100K rows in <3ms. Backend MAX_ROWS=10K limits per-query results.
   - What's unclear: Will any real-world dashboard exceed the performance threshold?
   - Recommendation: Ship without Web Workers. Monitor `DataSourceQueryResponse.truncated` and cross-filter computation time. If either triggers, add a Worker in a follow-up.

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
| INTR-01 | applyCrossFiltersToRows for KPI re-aggregation | unit | `cd frontend && pnpm vitest run src/lib/cross-filter.test.ts -t "applyCrossFiltersToRows"` | No -- Wave 0 |
| INTR-01 | addCrossFilter toggles (add/remove) correctly | unit | `cd frontend && pnpm vitest run src/stores/filter-store.test.ts -t "crossFilter"` | No -- Wave 0 |
| INTR-01 | recomputeKpis produces correct values under cross-filter | unit | `cd frontend && pnpm vitest run src/lib/kpi-aggregator.test.ts` | No -- Wave 0 |
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
- [ ] `frontend/src/lib/cross-filter.test.ts` -- covers INTR-01 (applyCrossFilters, applyCrossFiltersToRows, column matching, self-exclusion)
- [ ] `frontend/src/lib/kpi-aggregator.test.ts` -- covers INTR-01 (recomputeKpis with sum, percentage_of, multi-source)
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
| Client-side data exposure via cached rows | Information Disclosure | Cross-filter data layer caches the same data already visible in charts/grids -- no additional exposure beyond what user already sees |

## Sources

### Primary (HIGH confidence)
- Codebase review of all files listed in CONTEXT.md canonical_refs -- cross-filter store, drill store, chart wrappers, config types, dashboard renderer, KPI endpoint, query engine
- [AG Charts Events docs](https://www.ag-grid.com/charts/react/events/) -- seriesNodeClick, seriesNodeDoubleClick, nodeClickRange
- [AG Charts Stylers docs](https://www.ag-grid.com/charts/react/stylers/) -- itemStyler, highlightState parameter
- [AG Grid External Filter docs](https://ag-grid.com/react-data-grid/filter-external/) -- isExternalFilterPresent, doesExternalFilterPass
- [ECharts Event Handbook](https://apache.github.io/echarts-handbook/en/concepts/event/) -- click params, dispatchAction highlight/downplay
- Local benchmarks -- JS Array.filter + reduce + Map at 1K-500K rows (run on Apple Silicon, Node.js)
- npm pack verification -- actual WASM binary sizes for DuckDB-WASM 1.33.1 and Perspective 3.8.0

### Secondary (MEDIUM confidence)
- [Browser Data Processing Benchmarks (timlrx)](https://www.timlrx.com/blog/the-best-in-browser-data-processing-framework-is-sql) -- DuckDB 0.014ms, Arquero 0.067ms on 1M row aggregation
- [Motif Analytics: DuckDB + Arrow + Web Workers](https://motifanalytics.medium.com/my-browser-wasmt-prepared-for-this-using-duckdb-apache-arrow-and-web-workers-in-real-life-e3dd4695623d) -- Real-world DuckDB-WASM architecture, ~4x slower than native
- [V8 Blog: 4GB WASM Memory](https://v8.dev/blog/4gb-wasm-memory) -- Chrome WASM memory cap
- [DuckDB-WASM GitHub](https://github.com/duckdb/duckdb-wasm) -- Bundle optimization, CDN deployment, 3.2MB shell demo claim
- [Perspective (FINOS)](https://perspective-dev.github.io/) -- C++ WASM engine with built-in aggregation
- [Perspective Aggregation](https://deepwiki.com/finos/perspective/2.3-pivoting-and-aggregation) -- WEIGHTED_MEAN, PCT_SUM_PARENT, PCT_SUM_GRAND_TOTAL

### Tertiary (LOW confidence)
- [VertiPaq Engine (Data Mozart)](https://data-mozart.com/vertipaq-brain-muscles-behind-power-bi/) -- Power BI columnar engine architecture
- [Tableau Architecture (DataFlair)](https://data-flair.training/blogs/tableau-architecture/) -- Hyper engine in Tableau

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and proven in codebase
- Client-side engine assessment: HIGH -- verified bundle sizes via npm pack, benchmarked JS performance locally, cross-referenced with published benchmarks
- Architecture (Cross-Filter Data Layer): HIGH -- pattern mirrors existing backend logic (verified in dashboards.py), data flow verified through codebase analysis
- KPI re-aggregation: HIGH -- backend logic is simple (iterate rows, sum metric column) and replicable in JS
- Pitfalls: HIGH -- derived from codebase analysis of actual integration points
- Legacy code evaluation: HIGH -- every file read and analyzed line-by-line
- Data volume estimates: MEDIUM -- based on schema cardinality analysis, not production data [ASSUMED]
- Drill detail grid CSS layout: MEDIUM -- standard CSS grid behavior but untested with this specific layout

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- no fast-moving dependencies)
