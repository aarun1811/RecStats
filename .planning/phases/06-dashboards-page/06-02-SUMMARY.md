---
phase: 06-dashboards-page
plan: 02
subsystem: ui
tags: [react, motion, animation, dashboard, list-page, detail-header]

# Dependency graph
requires:
  - phase: 06-01
    provides: dashboard pipeline fix (ConfigStore rewired to recviz_datasets)
provides:
  - dashboard list page motion cards with hover lift, border-l-primary accent, stagger entrance
  - dashboard list rows with motion stagger entrance and border-l-primary accent
  - AnimatePresence crossfade on grid/list view toggle
  - filtered empty state with Empty component and Search icon
  - staggered page entrance animation on dashboards list route
  - dashboard detail header metadata row with panel counts and updated timestamp
affects: [06-dashboards-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dashboard card motion pattern matching Phase 2-5 (motion.div, whileHover, stagger)"
    - "Dashboard row motion pattern matching Phase 2-5 (motion.div, stagger, border-l-primary)"
    - "AnimatePresence crossfade on view toggle (mode=wait, key=viewMode)"
    - "Detail header metadata row with icon-prefixed panel counts"

key-files:
  created: []
  modified:
    - frontend/src/components/dashboard/dashboard-list-card.tsx
    - frontend/src/components/dashboard/dashboard-list-row.tsx
    - frontend/src/components/dashboard/dashboard-list.tsx
    - frontend/src/routes/_app/dashboards/index.tsx
    - frontend/src/routes/_app/dashboards/$dashboardId.tsx

key-decisions:
  - "Dashboard cards use border-l-primary (single accent) since dashboards are composite entities, not per-type categorized"
  - "Metadata row in detail header shows only non-zero panel counts with icons, avoiding clutter for empty dashboards"
  - "Removed CSS hover:-translate-y-0.5 from card in favor of motion.div whileHover for consistent animation control"

patterns-established:
  - "Dashboard entity uses primary accent color (border-l-primary) consistently across cards and rows"
  - "Page entrance animation: title slides down (y: -8), content fades in (delay: 0.1) for staggered reveal"

requirements-completed: [DASH-01, DASH-09]

# Metrics
duration: 3min
completed: 2026-04-13
---

# Phase 6 Plan 02: Dashboard List & Detail Polish Summary

**Motion hover lift, border-l-primary accent, AnimatePresence crossfade, filtered empty state upgrade, and detail header metadata row with panel counts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-13T04:01:12Z
- **Completed:** 2026-04-13T04:04:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Dashboard list cards now have motion.div with whileHover lift, stagger entrance, and border-l-primary accent matching Phase 2-5 premium quality
- Dashboard list rows have matching motion stagger entrance and border-l-primary accent
- Grid/list view toggle wrapped in AnimatePresence crossfade (mode="wait", 200ms)
- Filtered empty state upgraded from bare `<p>` to Empty component with Search icon, heading, and description
- Dashboard list page has staggered page entrance animation (title slides down, content fades in)
- Dashboard detail page now shows metadata row with panel counts (KPIs, Charts, Grids with icons) and relative timestamp

## Task Commits

Each task was committed atomically:

1. **Task 1: List page motion, crossfade, filtered empty state, page entrance** - `4dc0dd3` (feat)
2. **Task 2: Dashboard detail header metadata row** - `5bb99f1` (feat)

## Files Created/Modified
- `frontend/src/components/dashboard/dashboard-list-card.tsx` - Added motion.div wrapper with whileHover, stagger, border-l-primary accent; removed CSS hover translate; fixed metadata padding to px-4
- `frontend/src/components/dashboard/dashboard-list-row.tsx` - Added motion.div wrapper with stagger entrance, border-l-primary accent
- `frontend/src/components/dashboard/dashboard-list.tsx` - Added AnimatePresence crossfade on view toggle, index prop pass-through, filtered empty state with Empty component
- `frontend/src/routes/_app/dashboards/index.tsx` - Added staggered page entrance animation (motion.h1 + motion.div)
- `frontend/src/routes/_app/dashboards/$dashboardId.tsx` - Added countPanels helper, metadata row with Gauge/BarChart3/Table2 icons and formatDistanceToNow timestamp

## Decisions Made
- Dashboard cards use `border-l-primary` (single accent) since dashboards are composite entities, not per-type categorized like charts
- Metadata row in detail header conditionally renders only non-zero panel counts with icons, avoiding visual clutter for empty dashboards
- Replaced CSS `hover:-translate-y-0.5` with `motion.div whileHover={{ y: -2 }}` for consistent animation system (motion/react handles all transforms)
- Row component does not get whileHover (matching Phase 3/4 row pattern -- rows use subtle CSS hover instead of motion lift)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dashboard list page and detail header now match Phase 2-5 premium quality
- Ready for remaining Phase 6 plans (renderer polish, builder polish, legacy audit, embed verification)

## Self-Check: PASSED

All 5 modified files confirmed present. Both task commits (4dc0dd3, 5bb99f1) verified in git log.

---
*Phase: 06-dashboards-page*
*Completed: 2026-04-13*
