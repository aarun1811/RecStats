# Agent 02 — State & API Layer

## Mission
Build all TanStack Query hooks and API functions that fetch data from the backend. These hooks are consumed by dashboard, charts, grid, and explorer components.

## Read First
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/CLAUDE.md`
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/agents/AGENT_00_RESULT.md`

## Working Directory
`/Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz/frontend/`

## What Already Exists (from scaffolding)
- `src/lib/api-client.ts` — typed fetch wrapper (`api.get`, `api.post`, etc.)
- `src/lib/constants.ts` — `QUERY_STALE_TIME`, `QUERY_GC_TIME`, `API_BASE_URL`
- `src/lib/filter-utils.ts` — `toSupersetFilters()`, URL param helpers
- `src/types/filter.ts`, `chart.ts`, `dataset.ts`, `api.ts` — all type definitions
- `src/stores/filter-store.ts` — global filters + cross-filter state
- `src/stores/drill-store.ts` — drill-down state

## Files To Create

### 1. API Functions (`src/lib/api/`)

Create a `src/lib/api/` directory with domain-specific API functions:

#### `src/lib/api/charts.ts`
```typescript
// Functions that call backend endpoints for chart data
fetchChartData(chartId: string, filters: GlobalFilters): Promise<ChartDataResponse>
fetchChartList(): Promise<ChartConfig[]>
```

#### `src/lib/api/datasets.ts`
```typescript
fetchDatasets(): Promise<Dataset[]>
fetchDatasetData(datasetId: number, params: DatasetDataRequest): Promise<DatasetDataResponse>
fetchDatasetSchema(datasetId: number): Promise<DatasetColumn[]>
```

#### `src/lib/api/sql.ts`
```typescript
executeSql(request: SqlExecuteRequest): Promise<SqlExecuteResponse>
fetchQueryHistory(): Promise<QueryHistoryItem[]>
```

#### `src/lib/api/dashboards.ts`
```typescript
fetchDashboards(): Promise<DashboardConfig[]>
fetchDashboard(id: string): Promise<DashboardConfig>
```

#### `src/lib/api/search.ts`
```typescript
searchGlobal(query: string): Promise<SearchResult[]>
```

#### `src/lib/api/export.ts`
```typescript
requestExport(request: ExportRequest): Promise<{ jobId: string }>
checkExportStatus(jobId: string): Promise<{ status: string; url?: string }>
```

### 2. TanStack Query Hooks (`src/hooks/`)

#### `src/hooks/use-chart-data.ts`
- Uses `useQuery` with key `['chart-data', chartId, globalFilters]`
- Reads `globalFilters` from `useFilterStore`
- Calls `fetchChartData`
- Uses `placeholderData: keepPreviousData` for smooth filter transitions
- `staleTime` and `gcTime` from constants

#### `src/hooks/use-grid-data.ts`
- Uses `useInfiniteQuery` for paginated grid data
- Key: `['grid-data', datasetId, globalFilters]`
- `getNextPageParam` returns `nextOffset` from response
- Page size from `DEFAULT_PAGE_SIZE` constant

#### `src/hooks/use-datasets.ts`
- `useDatasets()` — list all datasets
- `useDatasetSchema(datasetId)` — get columns for a dataset

#### `src/hooks/use-sql-execute.ts`
- Uses `useMutation` for SQL execution (not a query — it's imperative)
- Returns mutation object with `mutate`, `data`, `isPending`, `error`

#### `src/hooks/use-dashboards.ts`
- `useDashboards()` — list all dashboards
- `useDashboard(id)` — get single dashboard config

#### `src/hooks/use-cross-filter.ts`
- Custom hook that combines `useFilterStore` cross-filter state with data filtering
- `useCrossFilteredData(data, chartId)` — returns filtered subset of data based on active cross-filters
- Uses `useMemo` internally for performance

#### `src/hooks/use-drill-down.ts`
- Custom hook wrapping `useDrillStore`
- `useDrillDown(chartId)` — returns `{ currentLevel, breadcrumbs, drillDown, drillUp, reset }`
- When drill reaches "detail" level, triggers a backend call via `useQuery`

#### `src/hooks/use-prefetch.ts`
- `usePrefetchDeskData(chartId, desks)` — prefetches chart data for each desk value
- Uses `queryClient.prefetchQuery` in a `useEffect`
- Only prefetches when dashboard is idle (no pending queries)

#### `src/hooks/use-search.ts`
- `useSearch(query)` — debounced search hook
- Uses `useQuery` with `enabled: query.length >= 2`
- 300ms debounce on query string

### 3. Query Key Factory (`src/lib/query-keys.ts`)
Centralized query key definitions to avoid key mismatches:
```typescript
export const queryKeys = {
  charts: {
    all: ['charts'] as const,
    list: () => [...queryKeys.charts.all, 'list'] as const,
    data: (chartId: string, filters: GlobalFilters) =>
      [...queryKeys.charts.all, 'data', chartId, filters] as const,
  },
  datasets: {
    all: ['datasets'] as const,
    list: () => [...queryKeys.datasets.all, 'list'] as const,
    schema: (id: number) => [...queryKeys.datasets.all, 'schema', id] as const,
    data: (id: number, filters: GlobalFilters) =>
      [...queryKeys.datasets.all, 'data', id, filters] as const,
  },
  dashboards: {
    all: ['dashboards'] as const,
    list: () => [...queryKeys.dashboards.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.dashboards.all, 'detail', id] as const,
  },
  sql: {
    history: () => ['sql', 'history'] as const,
  },
  search: {
    results: (query: string) => ['search', query] as const,
  },
}
```

## Design Rules
- Every hook must use the `queryKeys` factory — never inline query keys
- Every hook that reads `globalFilters` must use a Zustand selector (not the full store)
- All hooks return the TanStack Query result object directly (don't wrap/transform)
- No `useEffect` for data fetching — TanStack Query handles it
- API functions are pure async functions (no hooks, no state) — they just call the API client

## Acceptance Criteria
- [ ] All API functions typed with request/response types
- [ ] All hooks created and export correctly
- [ ] Query key factory covers all entities
- [ ] `useCrossFilteredData` filters data client-side using `useMemo`
- [ ] `usePrefetchDeskData` prefetches in background
- [ ] No TypeScript errors (`npx tsc --noEmit`)
