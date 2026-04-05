---
phase: 03-chart-and-grid-interactions
plan: 03
subsystem: ui
tags: [react, tanstack-query, auto-refresh, manual-refresh, dashboard-toolbar, countdown-timer, sonner-toast]

# Dependency graph
requires:
  - phase: 03-chart-and-grid-interactions/01
    provides: Chart export utilities and toolbar pattern
  - phase: 03-chart-and-grid-interactions/02
    provides: Grid toolbar pattern
provides:
  - useAutoRefresh hook with timestamp-based countdown (no timer drift)
  - AutoRefreshControl dropdown with Off/1m/5m/10m/30m presets and countdown display
  - DashboardToolbar with manual refresh button and auto-refresh control
  - DashboardRenderer integration with TanStack Query invalidation and keepPreviousData
  - autoRefreshInterval on DashboardConfig type (frontend + backend)
  - refreshInterval per-chart override on DashboardChartConfig (frontend + backend)
affects: [dashboard-builder, dashboard-config, 04-data-sources]

# Tech tracking
tech-stack:
  added: []
  patterns: [timestamp-based countdown timer to avoid setInterval drift, TanStack Query invalidateQueries for dashboard-wide refresh with deduplication]

key-files:
  created:
    - frontend/src/hooks/use-auto-refresh.ts
    - frontend/src/hooks/use-auto-refresh.test.ts
    - frontend/src/components/dashboard/auto-refresh-control.tsx
    - frontend/src/components/dashboard/dashboard-toolbar.tsx
  modified:
    - frontend/src/types/dashboard-config.ts
    - frontend/src/components/dashboard/dashboard-renderer.tsx
    - backend/app/models/dashboard_config.py

key-decisions:
  - "TanStack Query invalidateQueries handles concurrent refresh deduplication -- no manual staggering or priority queue needed"
  - "Timestamp-based countdown (Date.now() + interval) instead of decrementing counter to avoid timer drift per research Pitfall 7"
  - "Auto-refresh interval defaults to 600000ms (10min) when config omits the field"
  - "Per-chart refreshInterval is config-only (no UI control) -- UI deferred to Phase 8 dashboard builder"

patterns-established:
  - "useAutoRefresh hook: reusable timer with remainingMs/isActive/reset for any periodic refresh scenario"
  - "Dashboard toolbar placement: between page title and filter bar, flex justify-between for left/right sections"

requirements-completed: [INTR-08, INTR-09]

# Metrics
duration: 4min
completed: 2026-04-05
---

# Phase 03 Plan 03: Dashboard Refresh & Auto-Refresh Summary

**Dashboard-level manual refresh via TanStack Query invalidation, configurable auto-refresh with countdown timer and Off/1m/5m/10m/30m presets, integrated into DashboardRenderer**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-05T16:33:47Z
- **Completed:** 2026-04-05T16:37:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- useAutoRefresh hook with timestamp-based countdown, 11 unit tests passing
- DashboardToolbar with manual refresh (spinner, disabled state, error toast) and auto-refresh control (interval dropdown, pulsing green dot, countdown timer)
- Full integration into DashboardRenderer: invalidates data-source and dashboard-kpis queries, keeps previous data visible, resets auto-refresh on manual refresh and dashboard change
- Type extensions on both frontend DashboardConfig/DashboardChartConfig and backend Pydantic models

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for useAutoRefresh hook** - `7f0276d` (test)
2. **Task 1 (GREEN): Type extensions, auto-refresh hook, unit tests** - `0084aa1` (feat)
3. **Task 2: Dashboard toolbar, auto-refresh control, renderer integration** - `f4bb749` (feat)

## Files Created/Modified
- `frontend/src/hooks/use-auto-refresh.ts` - Auto-refresh timer hook with timestamp-based countdown, remainingMs/isActive/reset API
- `frontend/src/hooks/use-auto-refresh.test.ts` - 11 unit tests covering active/disabled states, countdown, reset, interval changes, unmount cleanup
- `frontend/src/components/dashboard/auto-refresh-control.tsx` - Interval selector dropdown (Off/1m/5m/10m/30m) with pulsing green dot and M:SS countdown
- `frontend/src/components/dashboard/dashboard-toolbar.tsx` - Manual refresh button with tooltip and AutoRefreshControl
- `frontend/src/components/dashboard/dashboard-renderer.tsx` - Integrated DashboardToolbar, useAutoRefresh, useQueryClient, toast notifications
- `frontend/src/types/dashboard-config.ts` - Added autoRefreshInterval to DashboardConfig, refreshInterval to DashboardChartConfig
- `backend/app/models/dashboard_config.py` - Added auto_refresh_interval to DashboardConfig, refresh_interval to DashboardChartConfig

## Decisions Made
- TanStack Query `invalidateQueries` handles concurrent refresh deduplication out of the box -- if multiple components share a query key, only one network request fires. No manual staggering or priority queue was implemented.
- Timestamp-based countdown (`Date.now() + interval` stored in ref) instead of decrementing a counter. This avoids timer drift that accumulates with `setInterval` tick skipping.
- Auto-refresh defaults to 600000ms (10 min) when the config omits the `autoRefreshInterval` field, matching the requirement spec.
- Per-chart `refreshInterval` field added to types but has no UI control in this phase -- it is config-driven only. UI for per-chart override deferred to Phase 8 (dashboard builder).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 03 (Chart and Grid Interactions) is now complete across all 3 plans
- Chart export/fullscreen (Plan 01), grid toolbar (Plan 02), and dashboard refresh/auto-refresh (Plan 03) all delivered
- Ready for Phase 04 (Data Sources) or subsequent phases

## Self-Check: PASSED

All 4 created files verified present. All 3 modified files verified. All task commits (7f0276d, 0084aa1, f4bb749) verified in git log.

---
*Phase: 03-chart-and-grid-interactions*
*Completed: 2026-04-05*
