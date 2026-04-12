---
phase: 02-settings-page
plan: 02
subsystem: ui
tags: [motion/react, animations, data-sources, badges, connection-test, shadcn]

# Dependency graph
requires:
  - phase: 02-settings-page/01
    provides: display-store, theme-preview-card, settings page layout with max-w-5xl and animated tabs
provides:
  - AnimatedStatusBadge component with pulse effect for connected status
  - ConnectionTestArea 4-state animation machine (Idle/Testing/Success/Failure)
  - ConnectionHealthHeader with large status badge + info grid
  - Data source cards/rows with animated badges and status border colors
  - Sheet stagger animations and detail/edit cross-fade
  - Required-field blur flash on form inputs
  - Updated button labels matching UI-SPEC copywriting contract
affects: [settings-page, data-sources]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - motion/react AnimatePresence mode=wait for view transitions
    - motion.div stagger pattern with index * 0.05 delay
    - motion.div whileHover for card lift animations
    - useState Set for transient field flash state (300ms auto-clear)
    - ConnectionTestArea state machine pattern (Idle/Testing/Success/Failure)

key-files:
  created:
    - frontend/src/components/settings/animated-status-badge.tsx
    - frontend/src/components/settings/connection-test-area.tsx
    - frontend/src/components/settings/connection-health-header.tsx
  modified:
    - frontend/src/components/settings/data-source-card.tsx
    - frontend/src/components/settings/data-source-row.tsx
    - frontend/src/components/settings/data-source-sheet.tsx
    - frontend/src/components/settings/data-sources-tab.tsx

key-decisions:
  - "StatusDot component fully removed and replaced by AnimatedStatusBadge across all settings files"
  - "ConnectionHealthHeader shows 'Configured' for host/port/service since DatabaseInfo does not expose these fields"
  - "ConnectionTestArea uses relative positioning for pulse overlay to avoid layout issues"

patterns-established:
  - "AnimatedStatusBadge: reusable status badge with pulse for connected, static dot for others, default/large sizes"
  - "ConnectionTestArea: reusable connection test widget with AnimatePresence state transitions"
  - "Stagger pattern: motion.div with delay: index * 0.05 for sequential section reveals"
  - "Required-field blur flash: useState<Set<string>> with 300ms setTimeout auto-clear"

requirements-completed: [SETT-01, SETT-06]

# Metrics
duration: 6min
completed: 2026-04-12
---

# Phase 2 Plan 2: Data Source Animation Components Summary

**Three new motion/react animation components (AnimatedStatusBadge with pulse, ConnectionTestArea 4-state machine, ConnectionHealthHeader info grid) integrated into data source card, row, and sheet with stagger animations, cross-fade transitions, and required-field blur flash**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-12T12:36:43Z
- **Completed:** 2026-04-12T12:42:57Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created AnimatedStatusBadge with emerald pulse dot for connected (scale 1-1.4, 1.5s infinite), static dots for unreachable/untested, default and large size variants
- Created ConnectionTestArea with 4-state animation machine: animated connecting bars (stagger 0.1s), spring check (stiffness 300, damping 20), shake X (400ms), border flash (600ms)
- Created ConnectionHealthHeader with large status badge, relative last-tested time via date-fns, 2-column info grid
- Replaced StatusDot completely with AnimatedStatusBadge in cards, rows, and sheet header
- Added border-l-2 status colors (emerald/red/amber) to both cards and rows
- Added motion/react hover lift to cards (y: -2, 150ms)
- Added stagger animations to both DetailView and FormView content sections (50ms per section)
- Added AnimatePresence cross-fade for detail/edit mode switching
- Updated all button labels to match UI-SPEC copywriting contract: "Edit Source", "Sync Datasets", "Save Connection", "Discard", "Update" (unchanged for edit mode)
- Added required-field blur flash (border-destructive/50 for 300ms) on Display Name and all required connection fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AnimatedStatusBadge, ConnectionTestArea, and ConnectionHealthHeader** - `6a1f4f9` (feat)
2. **Task 2: Integrate new components into data-source-card, row, sheet, and tab** - `efc7b5e` (feat)

## Files Created/Modified
- `frontend/src/components/settings/animated-status-badge.tsx` - Animated status badge with pulse dot for connected status
- `frontend/src/components/settings/connection-test-area.tsx` - 4-state connection test animation machine
- `frontend/src/components/settings/connection-health-header.tsx` - Connection health summary with info grid
- `frontend/src/components/settings/data-source-card.tsx` - AnimatedStatusBadge, border-l-2, motion hover lift, icon container
- `frontend/src/components/settings/data-source-row.tsx` - AnimatedStatusBadge, border-l-2
- `frontend/src/components/settings/data-source-sheet.tsx` - ConnectionTestArea, ConnectionHealthHeader, stagger animations, cross-fade, blur flash, updated labels
- `frontend/src/components/settings/data-sources-tab.tsx` - Responsive grid (grid-cols-2 lg:grid-cols-3)

## Decisions Made
- StatusDot component fully removed (was a 2px dot with 10px text, replaced by full Badge with pulse animation)
- ConnectionHealthHeader shows "Configured" for host/port/service/schema since the DatabaseInfo type does not expose these fields directly (per UI-SPEC note)
- ConnectionTestArea uses a relative-positioned overlay for the background pulse during testing state to avoid layout shifts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data source animation components are complete
- Ready for Plan 02-03 (Oracle CRUD verification and remaining settings fixes)
- All StatusDot references removed from codebase
- TypeScript compiles cleanly with no errors

## Self-Check: PASSED

All 4 created files verified on disk. Both commit hashes (6a1f4f9, efc7b5e) verified in git log.

---
*Phase: 02-settings-page*
*Completed: 2026-04-12*
