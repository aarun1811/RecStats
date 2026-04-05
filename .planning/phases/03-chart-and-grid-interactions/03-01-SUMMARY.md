---
phase: 03-chart-and-grid-interactions
plan: 01
subsystem: ui
tags: [react, forwardRef, chart-export, csv, png, svg, echarts, ag-charts, fullscreen, dialog, toolbar]

# Dependency graph
requires:
  - phase: 02.1-chart-rendering-foundation
    provides: AG Chart and EChart wrappers with cross-filter/drill-down support
provides:
  - ChartRef unified imperative handle for chart export (PNG, SVG, CSV, clipboard)
  - ChartToolbar hover-reveal component with export dropdown, fullscreen, refresh
  - ChartFullscreenDialog rendering live interactive chart at 90vw
  - chart-export.ts utility library (buildCSV, buildTSV, sanitizeFilename, triggerDownload, downloadCSV, copyToClipboard, exportFilename)
  - EXPORT_PIXEL_RATIO constant (2) for retina-quality PNG output
affects: [03-chart-and-grid-interactions, dashboard-builder, chart-library]

# Tech tracking
tech-stack:
  added: [echarts SVGRenderer]
  patterns: [forwardRef imperative handle for chart wrappers, unified ChartRef abstraction, hover-reveal toolbar with AnimatePresence]

key-files:
  created:
    - frontend/src/lib/chart-export.ts
    - frontend/src/lib/chart-export.test.ts
    - frontend/src/components/dashboard/chart-toolbar.tsx
    - frontend/src/components/dashboard/chart-fullscreen-dialog.tsx
  modified:
    - frontend/src/types/chart.ts
    - frontend/src/components/charts/ag-chart-wrapper.tsx
    - frontend/src/components/charts/echart-wrapper.tsx
    - frontend/src/components/charts/chart-factory.tsx
    - frontend/src/components/dashboard/config-chart-grid.tsx

key-decisions:
  - "AG Charts download() used natively without pixelRatio param (renders at display resolution, already retina on HiDPI)"
  - "ECharts SVGRenderer registered alongside CanvasRenderer to support SVG export via getDataURL"
  - "Fullscreen chart is a separate React instance receiving identical props (not a screenshot) for live interactivity"
  - "ChartToolbar manages no hover state itself -- parent controls visibility via AnimatePresence"

patterns-established:
  - "forwardRef imperative handle: chart wrappers expose specific methods via useImperativeHandle"
  - "Unified ChartRef: ChartFactory abstracts AG vs ECharts behind downloadImage/exportCSV/copyToClipboard/supportsSVG"
  - "Hover-reveal toolbar: parent wraps ChartToolbar in AnimatePresence with onMouseEnter/onMouseLeave"
  - "Fullscreen state sync: fullscreen chart gets same data/activeSelection/handlers as dashboard card"

requirements-completed: [INTR-05, INTR-06]

# Metrics
duration: 8min
completed: 2026-04-05
---

# Phase 03 Plan 01: Chart Export & Fullscreen Summary

**Chart ref forwarding with unified export API (PNG/SVG/CSV/clipboard), hover-reveal toolbar, and fullscreen dialog integrated into dashboard chart cards**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-05T16:17:04Z
- **Completed:** 2026-04-05T16:25:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- AgChartRef, EChartRef, and ChartRef interfaces providing unified imperative export API
- chart-export.ts utility library with 18 passing unit tests covering CSV/TSV building, filename sanitization, download triggering, and clipboard operations
- ChartToolbar with hover-reveal export dropdown (PNG, conditional SVG for ECharts, CSV, clipboard copy), fullscreen button, and per-chart refresh
- ChartFullscreenDialog rendering live chart at 90vw with identical cross-filter state and click handlers
- Both QueryChartItemWithDrill and KpiValuesChartItem integrated with toolbar and fullscreen

## Task Commits

Each task was committed atomically:

1. **Task 1: Chart ref interfaces, export utilities, and unit tests** - `6f88f4e` (feat)
2. **Task 2: Chart toolbar, fullscreen dialog, and chart grid integration** - `a976f16` (feat)

## Files Created/Modified
- `frontend/src/types/chart.ts` - Added AgChartRef, EChartRef, ChartRef interfaces
- `frontend/src/lib/chart-export.ts` - CSV/TSV builder, download trigger, clipboard copy, filename sanitizer, EXPORT_PIXEL_RATIO
- `frontend/src/lib/chart-export.test.ts` - 18 unit tests for export utilities
- `frontend/src/components/charts/ag-chart-wrapper.tsx` - forwardRef exposing download/getImageDataURL/getData
- `frontend/src/components/charts/echart-wrapper.tsx` - forwardRef exposing getDataURL/getData, added SVGRenderer
- `frontend/src/components/charts/chart-factory.tsx` - forwardRef forwarding unified ChartRef
- `frontend/src/components/dashboard/chart-toolbar.tsx` - Hover-reveal toolbar with export dropdown, fullscreen, refresh
- `frontend/src/components/dashboard/chart-fullscreen-dialog.tsx` - Fullscreen dialog with onOpenAutoFocus prevention
- `frontend/src/components/dashboard/config-chart-grid.tsx` - Integrated toolbar and fullscreen into chart cards

## Decisions Made
- AG Charts `download()` used natively without pixelRatio param -- it renders at display resolution which is already retina on HiDPI screens. The `EXPORT_PIXEL_RATIO` constant is used for ECharts `getDataURL()` which does accept pixelRatio.
- ECharts SVGRenderer registered alongside CanvasRenderer to enable SVG export without affecting normal canvas rendering.
- Fullscreen chart is a separate React component instance (not a screenshot), receiving identical data, activeSelection, and click handlers. This ensures cross-filter clicks inside fullscreen update both the fullscreen and dashboard card instances via shared Zustand store.
- ChartToolbar does not manage hover state itself -- the parent card controls visibility via AnimatePresence wrapper with onMouseEnter/onMouseLeave, keeping the toolbar stateless and reusable.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Chart export and fullscreen infrastructure complete
- Ready for Phase 03 Plan 02 (cross-filter bar and advanced grid interactions)
- Chart toolbar pattern established for reuse in future dashboard components

## Self-Check: PASSED

All 9 created/modified files verified present. Both task commits (6f88f4e, a976f16) verified in git log.

---
*Phase: 03-chart-and-grid-interactions*
*Completed: 2026-04-05*
