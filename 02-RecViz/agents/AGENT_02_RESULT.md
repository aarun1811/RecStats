# Agent 02 — State & API Layer Result

**Status:** COMPLETE
**Date:** 2026-02-09

---

## Summary

Built the full TanStack Query hooks and API function layer for RecViz. All hooks consume the existing Zustand stores, typed API client, and type definitions from scaffolding. Zero TypeScript errors in Agent 02 files.

---

## Files Created

### Types Added (`src/types/api.ts` — extended)

Added three new interfaces to the existing api.ts:
- `SearchResult` — type/id/title/description for global search
- `QueryHistoryItem` — SQL query history entries
- `ExportStatusResponse` — export job status polling

### Query Key Factory

| File | Purpose |
|------|---------|
| `src/lib/query-keys.ts` | Centralized query key definitions for charts, datasets, dashboards, sql, search, export |

### API Functions (`src/lib/api/`)

| File | Functions |
|------|-----------|
| `src/lib/api/charts.ts` | `fetchChartData`, `fetchChartList` |
| `src/lib/api/datasets.ts` | `fetchDatasets`, `fetchDatasetData`, `fetchDatasetSchema` |
| `src/lib/api/sql.ts` | `executeSql`, `fetchQueryHistory` |
| `src/lib/api/dashboards.ts` | `fetchDashboards`, `fetchDashboard` |
| `src/lib/api/search.ts` | `searchGlobal` |
| `src/lib/api/export.ts` | `requestExport`, `checkExportStatus` |

### TanStack Query Hooks (`src/hooks/`)

| File | Hook(s) | Type |
|------|---------|------|
| `src/hooks/use-chart-data.ts` | `useChartData(chartId)` | `useQuery` with `keepPreviousData` |
| `src/hooks/use-grid-data.ts` | `useGridData(datasetId)` | `useInfiniteQuery` with pagination |
| `src/hooks/use-datasets.ts` | `useDatasets()`, `useDatasetSchema(id)` | `useQuery` |
| `src/hooks/use-sql-execute.ts` | `useSqlExecute()`, `useQueryHistory()` | `useMutation` + `useQuery` |
| `src/hooks/use-dashboards.ts` | `useDashboards()`, `useDashboard(id)` | `useQuery` |
| `src/hooks/use-cross-filter.ts` | `useCrossFilteredData(data, chartId)` | Custom hook with `useMemo` |
| `src/hooks/use-drill-down.ts` | `useDrillDown(chartId)` | Custom hook wrapping drill store + conditional `useQuery` for detail level |
| `src/hooks/use-prefetch.ts` | `usePrefetchDeskData(chartId, desks)` | Prefetch via `queryClient.prefetchQuery` in `useEffect` |
| `src/hooks/use-search.ts` | `useSearch(query)` | `useQuery` with 300ms debounce, enabled when query >= 2 chars |

---

## Design Decisions

1. **Query key factory** — all hooks use `queryKeys.*` from `src/lib/query-keys.ts`. No inline keys anywhere.
2. **Zustand selectors** — every hook that reads `globalFilters` uses `useFilterStore((s) => s.globalFilters)` to avoid full-store re-renders.
3. **Hooks return TanStack Query result directly** — no wrapping or transforming. Consumers get `data`, `isPending`, `error`, etc.
4. **API functions are pure async** — no hooks, no state. They just call `api.get`/`api.post` and return typed promises.
5. **Cross-filter hook** uses `useMemo` — filters data client-side based on active cross-filters, excluding the source chart.
6. **Drill-down detail query** — only fires when the drill level is `'detail'` (via `enabled` flag).
7. **Prefetch** — only runs when dashboard is idle (`isFetching === 0`), preventing prefetch from competing with active queries.
8. **SQL execute** uses `useMutation` (imperative action, not a query) and invalidates query history on success.
9. **Debounced search** — 300ms debounce using internal `useState` + `useEffect`; query only fires when debounced value >= 2 chars.

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` — zero errors in Agent 02 files | PASS |
| All API functions typed with request/response types | PASS |
| All hooks created and export correctly (named exports) | PASS |
| Query key factory covers all entities | PASS |
| `useCrossFilteredData` filters data client-side with `useMemo` | PASS |
| `usePrefetchDeskData` prefetches in background | PASS |
| No `any` types used | PASS |
| No barrel exports created | PASS |
| Import order follows convention | PASS |

**Note:** Pre-existing TS errors exist in files from other agents (charts wrapper, grid status bar, routes). These are outside Agent 02's scope.

---

## File Count

- **1 file extended** (types/api.ts)
- **7 new files created** (1 query keys + 6 API functions)
- **9 new hooks created**
- **Total: 17 files touched/created**
