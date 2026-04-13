---
phase: 06-dashboards-page
plan: 04
subsystem: ui
tags: [motion/react, AnimatePresence, zustand, dead-code-removal, builder-polish]

# Dependency graph
requires:
  - phase: 06-01
    provides: ConfigStore rewired to recviz_datasets + recviz_connections
provides:
  - AnimatePresence entrance/exit on builder filter chips
  - Stagger entrance on chart/KPI/dataset picker dialog card grids
  - Dead code removed from filter-store (setLocked) and builder-store (updateFilter)
  - Verified zero stale imports to deleted legacy files
affects: [06-05-dashboards-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [AnimatePresence popLayout for chip add/remove, stagger entrance with delay index*0.03]

key-files:
  created: []
  modified:
    - frontend/src/components/builder/builder-filter-bar.tsx
    - frontend/src/components/builder/chart-picker-dialog.tsx
    - frontend/src/components/builder/kpi-picker-dialog.tsx
    - frontend/src/components/builder/dataset-picker-dialog.tsx
    - frontend/src/stores/filter-store.ts
    - frontend/src/stores/builder-store.ts

key-decisions:
  - "Builder panel hover states already polished (hover:shadow-md, hover:border-primary/30) -- no changes needed"
  - "setLocked in filter-store is dead (initializeFilters handles locked via second param) -- removed"
  - "updateFilter in builder-store has zero external consumers -- removed"
  - "drill-store and layout-history-store fully active, no dead code found"

patterns-established:
  - "AnimatePresence mode=popLayout: used for dynamic chip bars where items add/remove"
  - "Picker dialog stagger: motion.div with initial opacity:0 y:4, delay i*0.03, duration 0.2"

requirements-completed: [DASH-07, DASH-09]

# Metrics
duration: 3min
completed: 2026-04-13
---

# Phase 6 Plan 4: Builder Motion Polish + Store Audit Summary

**AnimatePresence on builder filter chips, stagger entrance on 3 picker dialogs, dead code removed from filter-store and builder-store, zero stale legacy imports confirmed**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-13T04:01:01Z
- **Completed:** 2026-04-13T04:04:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Builder filter bar chips now animate in/out with scale/opacity via AnimatePresence mode="popLayout"
- Chart, KPI, and dataset picker dialog card grids have stagger entrance animations (motion.div with delay per index)
- Full audit of all 4 Zustand stores: filter-store, drill-store, builder-store, layout-history-store
- Removed dead `setLocked` action from filter-store (redundant with `initializeFilters`)
- Removed dead `updateFilter` action from builder-store (zero external consumers)
- Confirmed 0 stale imports referencing deleted legacy files (filter-bar, kpi-row, chart-grid)
- Confirmed 0 Superset references in any store

## Task Commits

Each task was committed atomically:

1. **Task 1: Builder filter chip animation + picker dialog stagger + canvas polish** - `78fec29` (feat)
2. **Task 2: Legacy import grep + Zustand store audit** - `dc359da` (refactor)

## Files Created/Modified
- `frontend/src/components/builder/builder-filter-bar.tsx` - Added AnimatePresence mode="popLayout" + motion.div with scale/opacity on each filter chip
- `frontend/src/components/builder/chart-picker-dialog.tsx` - Added motion.div stagger entrance on card grid items
- `frontend/src/components/builder/kpi-picker-dialog.tsx` - Added motion.div stagger entrance on card grid items
- `frontend/src/components/builder/dataset-picker-dialog.tsx` - Added motion.div stagger entrance on card grid items
- `frontend/src/stores/filter-store.ts` - Removed dead setLocked action
- `frontend/src/stores/builder-store.ts` - Removed dead updateFilter action

## Decisions Made
- Builder panel hover states (hover:shadow-md, hover:border-primary/30) were already in builder-panel.tsx -- verified sufficient, no changes needed
- Panel edit/delete actions are always visible (not hidden with opacity-0 group-hover:opacity-100) which is correct for builder context where controls must be discoverable
- drill-store and layout-history-store had zero dead code -- all actions have active external consumers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Builder motion polish complete, matching Phase 2-4 quality patterns
- All stores audited and clean for Phase 6 Plan 5 (E2E verification)
- DASH-07 (legacy code audit) and DASH-09 (builder polish) fully satisfied

## Self-Check: PASSED

All 6 modified files exist. Both task commits verified (78fec29, dc359da). Summary file exists.

---
*Phase: 06-dashboards-page*
*Completed: 2026-04-13*
