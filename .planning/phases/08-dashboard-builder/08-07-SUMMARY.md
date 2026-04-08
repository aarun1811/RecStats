---
phase: 08-dashboard-builder
plan: 07
subsystem: ui
tags: [react, zustand, shadcn, popover, wysiwyg, builder, chart-factory, kpi-preview]

requires:
  - phase: 08-05
    provides: BuilderPage with canvas, toolbar, panel rendering, save/load
  - phase: 08-06
    provides: AddContentMenu, ChartPickerDialog, KpiPickerDialog, DatasetPickerDialog

provides:
  - PanelConfigPopover with per-panel type-specific settings
  - DrillHierarchyEditor with visual column picker and detail dataset dropdown
  - BuilderPanelContent with live WYSIWYG rendering via ChartFactory/KpiPreviewCard
  - Full wiring of AddContentMenu to picker dialogs creating BuilderItems on canvas
  - BuilderToolbar renderAddButton prop for custom dropdown trigger
  - BuilderPanel editButtonWrapper prop for popover integration

affects: [08-08, 08-09, 08-10, dashboard-builder]

tech-stack:
  added: []
  patterns:
    - editButtonWrapper render prop pattern for injecting popover around edit button
    - renderAddButton prop pattern for custom toolbar buttons
    - WYSIWYG builder panel content using same renderer components as view mode

key-files:
  created:
    - frontend/src/components/builder/panel-config-popover.tsx
    - frontend/src/components/builder/drill-hierarchy-editor.tsx
    - frontend/src/components/builder/builder-panel-content.tsx
  modified:
    - frontend/src/components/builder/builder-page.tsx
    - frontend/src/components/builder/builder-toolbar.tsx
    - frontend/src/components/builder/builder-panel.tsx

key-decisions:
  - "editButtonWrapper render prop on BuilderPanel for PanelConfigPopover positioning -- popover wraps edit button for correct anchor"
  - "renderAddButton prop on BuilderToolbar -- allows parent to provide AddContentMenu-wrapped button"
  - "BuilderPanelContent reuses ChartFactory and KpiPreviewCard with empty filters in builder context"
  - "Grid preview uses lightweight HTML table (6 cols, 10 rows max) instead of full AG Grid for builder performance"

patterns-established:
  - "editButtonWrapper: render prop pattern for wrapping panel actions with popover/dropdown"
  - "WYSIWYG builder: same ChartFactory/KpiPreviewCard components render in both builder and view modes"

requirements-completed: [BLDR-02, BLDR-03, BLDR-04, BLDR-05]

duration: 5min
completed: 2026-04-06
---

# Phase 08 Plan 07: Panel Config, WYSIWYG Content, and Picker Wiring Summary

**PanelConfigPopover with type-specific settings, DrillHierarchyEditor with visual column picker, live WYSIWYG panel rendering via ChartFactory/KpiPreviewCard, and full AddContentMenu-to-picker wiring**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-06T21:29:05Z
- **Completed:** 2026-04-06T21:34:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- PanelConfigPopover renders type-specific settings: chart (cross-filter, drill hierarchy, refresh interval, edit link), KPI (title, edit link), grid (row limit, sort column/direction)
- DrillHierarchyEditor provides visual column picker with drag-to-reorder, dimension filtering, [+ Add Level] select, and detail data source dropdown
- BuilderPanelContent renders live data in builder panels: ChartFactory for charts, KpiPreviewCard for KPIs, lightweight table for grids
- BuilderPage fully wired: [+ Add] opens content dropdown, picker dialogs create BuilderItems on canvas with crypto.randomUUID() IDs

## Task Commits

Each task was committed atomically:

1. **Task 1: PanelConfigPopover with DrillHierarchyEditor** - `7fd2813` (feat)
2. **Task 2: BuilderPanelContent with live WYSIWYG rendering, and wire into BuilderPage** - `54f3670` (feat)

## Files Created/Modified
- `frontend/src/components/builder/panel-config-popover.tsx` - Per-panel config popover with chart/KPI/grid sections
- `frontend/src/components/builder/drill-hierarchy-editor.tsx` - Visual column picker for drill hierarchy with drag-reorder
- `frontend/src/components/builder/builder-panel-content.tsx` - Live data rendering for builder panels via ChartFactory/KpiPreviewCard
- `frontend/src/components/builder/builder-page.tsx` - Full wiring: AddContentMenu, picker dialogs, PanelConfigPopover, BuilderPanelContent
- `frontend/src/components/builder/builder-toolbar.tsx` - Added renderAddButton prop for custom dropdown trigger
- `frontend/src/components/builder/builder-panel.tsx` - Added editButtonWrapper prop for popover integration

## Decisions Made
- Used editButtonWrapper render prop on BuilderPanel to inject PanelConfigPopover as trigger wrapper around the edit button -- ensures correct popover positioning relative to the edit icon
- BuilderToolbar accepts renderAddButton prop so BuilderPage can provide AddContentMenu-wrapped button instead of a plain onClick handler
- BuilderPanelContent passes empty filters ({}) to useDataSourceQuery in builder context since no filter bar is active during editing
- Grid preview renders a lightweight HTML table (max 6 columns, 10 rows) instead of full AG Grid to keep builder responsive

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] BuilderPanel editButtonWrapper prop for popover integration**
- **Found during:** Task 2 (wiring PanelConfigPopover into BuilderPage)
- **Issue:** PanelConfigPopover needs to wrap the edit button as its trigger for correct Radix Popover positioning. The edit button is inside BuilderPanel which is a separate component.
- **Fix:** Added editButtonWrapper render prop to BuilderPanel that allows parent to wrap the edit button with PanelConfigPopover
- **Files modified:** frontend/src/components/builder/builder-panel.tsx
- **Verification:** TypeScript compiles clean, popover positioned correctly relative to edit button
- **Committed in:** 54f3670 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary architectural addition for proper popover positioning. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Panel config, WYSIWYG rendering, and picker wiring complete
- Ready for Plan 08 (filter builder dialog and cross-filter/drill persistence)
- All existing tests pass (203/203)

## Self-Check: PASSED

All 6 files verified present. Both task commits (7fd2813, 54f3670) verified in git history.

---
*Phase: 08-dashboard-builder*
*Completed: 2026-04-06*
