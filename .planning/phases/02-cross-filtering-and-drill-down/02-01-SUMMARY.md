---
phase: 02-cross-filtering-and-drill-down
plan: 01
subsystem: ui
tags: [zustand, tanstack-query, cross-filter, drill-down, vitest, typescript]

# Dependency graph
requires:
  - phase: 01-foundation-hardening
    provides: Config-driven dashboard types, filter store, cross-filter utilities
provides:
  - Updated CrossFilter/DrillLevel types (CrossFilterRule removed)
  - Per-chart drill store (Map-based)
  - applyCrossFiltersToRows utility for raw row filtering
  - recomputeKpis with partial match reporting
  - useCrossFilter hook (column-name matching)
  - useCrossFilterData hook (TanStack Query cache + client-side KPI re-aggregation)
  - useDrillDown hook (per-chart, config-defined hierarchy)
  - useDrillDetail hook (backend drill detail queries)
affects: [02-02-PLAN, 02-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-chart-drill-state, column-name-cross-filtering, client-side-kpi-reaggregation, partial-match-reporting]

key-files:
  created:
    - frontend/src/lib/kpi-aggregator.ts
    - frontend/src/hooks/use-cross-filter-data.ts
    - frontend/src/hooks/use-drill-detail.ts
    - frontend/src/lib/cross-filter.test.ts
    - frontend/src/stores/filter-store.test.ts
    - frontend/src/stores/drill-store.test.ts
    - frontend/src/lib/kpi-aggregator.test.ts
  modified:
    - frontend/src/types/filter.ts
    - frontend/src/types/dashboard-config.ts
    - frontend/src/stores/drill-store.ts
    - frontend/src/lib/cross-filter.ts
    - frontend/src/hooks/use-cross-filter.ts
    - frontend/src/hooks/use-drill-down.ts

key-decisions:
  - "Per-chart drill state via Map<string, PerChartDrill> instead of global single-chart DrillState"
  - "Column-name matching replaces rule-based CrossFilterRule targeting"
  - "KPI re-aggregation reports partial matches when cross-filter column missing from data source"
  - "reaggregateByField scans up to 10 rows for numeric detection instead of just row 0"

patterns-established:
  - "Per-chart drill state: Map<string, { levels: DrillLevel[] }> in Zustand store"
  - "Cross-filter data layer: TanStack useQueries for data source caching, client-side re-aggregation"
  - "Partial match reporting: KpiPartialMatch[] returned alongside recomputed KPIs"
  - "Config-driven drill hierarchy: drillHierarchy string[] on DashboardChartConfig"

requirements-completed: [INTR-01, INTR-02, INTR-03, INTR-04]

# Metrics
duration: 7min
completed: 2026-04-05
---

# Phase 02 Plan 01: Cross-Filter and Drill-Down Data Layer Summary

**Per-chart drill store, column-name cross-filtering, client-side KPI re-aggregation with partial match reporting, and four hooks for UI integration**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-05T08:33:08Z
- **Completed:** 2026-04-05T08:40:32Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Removed CrossFilterRule in favor of column-name matching -- simpler, no config needed
- Rewrote drill store from global single-chart to per-chart Map -- each chart drills independently
- Created KPI aggregator that recomputes values from cached data source rows with partial match reporting when cross-filter columns are missing
- Built four hooks providing the complete data layer for Plans 02 and 03 to wire into the UI
- 53 tests passing (34 new + 19 pre-existing), zero TypeScript errors, zero lint errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, stores, and utility functions with tests** - `3e6c78a` (test: RED), `3e264e3` (feat: GREEN)
2. **Task 2: Hooks -- useCrossFilter, useCrossFilterData, useDrillDown, useDrillDetail** - `220cc14` (feat)

## Files Created/Modified
- `frontend/src/types/filter.ts` - Removed CrossFilterRule, simplified DrillLevel, added ChartDrillState
- `frontend/src/types/dashboard-config.ts` - Extended DashboardChartConfig with crossFilter/drillHierarchy/drillDetailDataSourceId, GridConfig with crossFilterColumn
- `frontend/src/stores/drill-store.ts` - Rewritten as per-chart Map<string, PerChartDrill>
- `frontend/src/lib/cross-filter.ts` - Added applyCrossFiltersToRows for raw row filtering
- `frontend/src/lib/kpi-aggregator.ts` - New: recomputeKpis with partial match reporting
- `frontend/src/hooks/use-cross-filter.ts` - Rewritten: column-name matching, no rules parameter
- `frontend/src/hooks/use-cross-filter-data.ts` - New: cross-filter data layer with TanStack Query cache
- `frontend/src/hooks/use-drill-down.ts` - Rewritten: per-chart, config-defined hierarchy, improved metric detection
- `frontend/src/hooks/use-drill-detail.ts` - New: backend drill detail queries with merged filters
- `frontend/src/lib/cross-filter.test.ts` - 13 tests for cross-filter utilities
- `frontend/src/stores/filter-store.test.ts` - 5 tests for filter store cross-filter actions
- `frontend/src/stores/drill-store.test.ts` - 10 tests for per-chart drill store
- `frontend/src/lib/kpi-aggregator.test.ts` - 6 tests for KPI re-aggregation and partial matches

## Decisions Made
- Per-chart drill state uses `Map<string, PerChartDrill>` instead of global `DrillState` -- each chart drills independently per D-09
- Column-name matching replaces `CrossFilterRule` -- cross-filters apply to any chart with matching column, no explicit config needed per D-07
- KPI re-aggregation reports `partialMatches` when a data source lacks the cross-filter column -- UI can show info icon per review concern 3
- `reaggregateByField` scans up to 10 rows for numeric detection instead of just row 0 -- handles null/undefined in first row per review concern 2
- `useCrossFilterData` queries only fire when `crossFilters.length > 0` -- no extra network calls when cross-filters off

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused useMemo import in use-drill-down.ts**
- **Found during:** Task 2 (lint verification)
- **Issue:** The rewritten hook no longer uses `useMemo` but the import remained, causing a lint error
- **Fix:** Removed `useMemo` from the import statement
- **Files modified:** frontend/src/hooks/use-drill-down.ts
- **Verification:** `pnpm lint` shows no errors in our files
- **Committed in:** 220cc14 (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial cleanup, no scope change.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All types, stores, utilities, and hooks are ready for Plan 02 (cross-filter UI integration) and Plan 03 (drill-down UI integration)
- The data layer contracts are tested and stable -- UI components can consume them directly
- `useCrossFilterData` shares cache keys with `useDataSourceQuery` so chart data and KPI re-aggregation share the same TanStack Query cache

## Self-Check: PASSED

All 13 files verified present. All 3 commits verified in git log.

---
*Phase: 02-cross-filtering-and-drill-down*
*Completed: 2026-04-05*
