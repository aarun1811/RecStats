---
phase: 02-cross-filtering-and-drill-down
plan: 02
subsystem: ui
tags: [cross-filter, zustand, motion-react, ag-grid-external-filter, echarts-dimming, kpi-reaggregation]

# Dependency graph
requires:
  - phase: 02-cross-filtering-and-drill-down
    provides: Cross-filter data layer (useCrossFilter, useCrossFilterData, kpi-aggregator, filter store, cross-filter utilities)
provides:
  - Fully wired cross-filtering across charts, KPIs, and grids
  - Animated cross-filter indicator bar with badge removal
  - Chart dimming (AG Charts itemStyler + ECharts dispatchAction)
  - KPI dual-path (server-computed vs client-recomputed) with partial match info icons
  - AG Grid external filter API integration for cross-filter row filtering
  - Smart grid column selection (config > first dimension > fallback)
  - Pie slice pull-out on selection
affects: [02-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [cross-filter-ui-wiring, dual-path-kpi, ag-grid-external-filter, echart-programmatic-dimming, pie-pull-out]

key-files:
  created: []
  modified:
    - frontend/src/components/dashboard/cross-filter-bar.tsx
    - frontend/src/components/dashboard/dashboard-renderer.tsx
    - frontend/src/components/dashboard/config-chart-grid.tsx
    - frontend/src/components/dashboard/config-kpi-row.tsx
    - frontend/src/components/dashboard/config-data-grid.tsx
    - frontend/src/components/charts/ag-chart-wrapper.tsx
    - frontend/src/components/charts/echart-wrapper.tsx

key-decisions:
  - "CrossFilterBar uses dynamic columnLabels prop with capitalized-column-name fallback instead of hardcoded COLUMN_LABELS map"
  - "DashboardRenderer clears cross-filters on global filter change via ref-tracked appliedFilters comparison"
  - "AG Grid cross-filter column resolved via explicit config > first string-type column > fallback to first column (review concern 1)"
  - "KPI partial match indicator uses Tooltip with Info icon showing which cross-filter columns are missing from the data source"
  - "ECharts dimming via dispatchAction highlight/downplay rather than modifying series options directly"

patterns-established:
  - "Cross-filter UI wiring: DashboardRenderer orchestrates, child components consume via props and store selectors"
  - "Dual-path KPI: effectiveKpis = crossFilteredKpis ?? serverKpis -- zero flicker, CountAnimation handles transitions"
  - "AG Grid external filter: isExternalFilterPresent + doesExternalFilterPass + onFilterChanged on crossFilters change"
  - "Smart column selection: resolveCrossFilterField checks config, then first dimension column, then falls back"

requirements-completed: [INTR-01, INTR-02]

# Metrics
duration: 8min
completed: 2026-04-05
---

# Phase 02 Plan 02: Cross-Filter UI Integration Summary

**Cross-filtering wired into all dashboard components: chart dimming, animated indicator bar, dual-path KPI re-aggregation with partial match icons, AG Grid external filtering, and pie slice pull-out**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-05T08:43:42Z
- **Completed:** 2026-04-05T08:52:10Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Evolved CrossFilterBar with motion/react AnimatePresence animations, dynamic column labels, accessibility (aria-live), and fixed 2-arg removeCrossFilter call
- Wired DashboardRenderer as cross-filter orchestrator: mounts CrossFilterBar, calls useCrossFilterData, clears cross-filters on global filter change, passes crossFilteredKpis and partialMatches to children
- Integrated cross-filter click handlers and dimming into ConfigChartGrid for both query-sourced and KPI-values charts with D-06 opt-out support
- Added dual-path KPI values to ConfigKpiRow with partial match info icon tooltip for missing cross-filter columns
- Wired AG Grid external filter API in ConfigDataGrid with smart column selection (config > first dimension > fallback)
- Added pie slice pull-out (offset: 8) to AgChartWrapper and ECharts highlight/downplay dimming to EChartWrapper
- Fixed pre-existing ref-during-render lint error in AgChartWrapper and Function type lint error in EChartWrapper

## Task Commits

Each task was committed atomically:

1. **Task 1: Cross-filter bar evolution and dashboard renderer orchestration** - `63af622` (feat)
2. **Task 2: Chart grid, KPI row, data grid, and chart wrapper cross-filter integration** - `b3e990f` (feat)

## Files Created/Modified
- `frontend/src/components/dashboard/cross-filter-bar.tsx` - Animated badge bar with motion/react, dynamic column labels, accessibility, fixed removeCrossFilter signature
- `frontend/src/components/dashboard/dashboard-renderer.tsx` - Cross-filter orchestrator: CrossFilterBar mount, useCrossFilterData call, global filter change clearing
- `frontend/src/components/dashboard/config-chart-grid.tsx` - Cross-filter click handlers, useCrossFilter data filtering, activeSelection dimming, D-06 opt-out
- `frontend/src/components/dashboard/config-kpi-row.tsx` - Dual-path KPI (server vs client), partial match info icon with Tooltip
- `frontend/src/components/dashboard/config-data-grid.tsx` - AG Grid external filter API, smart column selection, row-click cross-filter emission
- `frontend/src/components/charts/ag-chart-wrapper.tsx` - Pie slice pull-out offset, ref-during-render lint fix
- `frontend/src/components/charts/echart-wrapper.tsx` - dispatchAction highlight/downplay dimming, dblclick event, chartRef, Function type fix

## Decisions Made
- CrossFilterBar dynamically generates column labels via a `columnLabels` prop with a capitalize+space fallback, replacing the hardcoded COLUMN_LABELS map that would require maintenance
- DashboardRenderer tracks previous appliedFilters via useRef to detect global filter changes and clear stale cross-filters (Pitfall 2 prevention)
- AG Grid cross-filter column uses `resolveCrossFilterField()` that checks config, then first string-type column, then falls back -- avoids blindly using index 0 which could be an ID/timestamp
- KPI partial match indicator uses Shadcn Tooltip with Info icon rather than a banner or toast, keeping it contextual and non-intrusive
- ECharts dimming uses dispatchAction('highlight'/'downplay') for programmatic control rather than modifying series options, which is the recommended ECharts API

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ref-during-render lint error in AgChartWrapper**
- **Found during:** Task 2 (lint verification)
- **Issue:** `clickHandlerRef.current = onChartClick` was assigned during render, violating the react-hooks/refs rule (pre-existing)
- **Fix:** Wrapped ref assignments in useEffect with proper dependency array
- **Files modified:** frontend/src/components/charts/ag-chart-wrapper.tsx
- **Committed in:** b3e990f (part of Task 2 commit)

**2. [Rule 1 - Bug] Fixed Function type lint error in EChartWrapper**
- **Found during:** Task 2 (lint verification)
- **Issue:** `Record<string, Function>` violated @typescript-eslint/no-unsafe-function-type
- **Fix:** Replaced with local `EChartEventHandler` type alias `(...args: unknown[]) => void`
- **Files modified:** frontend/src/components/charts/echart-wrapper.tsx
- **Committed in:** b3e990f (part of Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs -- both pre-existing lint issues in files being modified)
**Impact on plan:** Minor cleanup, no scope change. Both fixes improve code quality in files that were already being modified.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All cross-filter UI integration is complete -- charts, KPIs, and grids respond to cross-filter state changes
- Plan 03 (drill-down UI integration) can proceed: DrillBreadcrumb, DrillDetailGrid, and chart double-click handlers are the remaining work
- The useDrillDown and useDrillDetail hooks from Plan 01 are ready for UI wiring in Plan 03

## Self-Check: PASSED

All 7 modified files verified present. Both commits (63af622, b3e990f) verified in git log.

---
*Phase: 02-cross-filtering-and-drill-down*
*Completed: 2026-04-05*
