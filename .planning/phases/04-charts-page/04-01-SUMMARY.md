---
phase: 04-charts-page
plan: 01
subsystem: ui
tags: [tailwind, css-variables, ag-charts, echarts, chart-themes, style-constants]

# Dependency graph
requires:
  - phase: 01-infra-cutover
    provides: Mist+Blue oklch palette, CSS variables, chart-themes.ts with HEX_FALLBACKS
  - phase: 03-datasets-page
    provides: style-constants.ts pattern for display constant maps
provides:
  - CHART_TYPE_BORDER_COLORS, CHART_TYPE_PILL_BG, CHART_TYPE_PILL_TEXT maps for chart list/detail accent colors
  - --chart-warning CSS variable (light + dark)
  - Exported resolveColor() function from chart-themes.ts
  - Zero hard-coded hex in chart wrappers (gauge + treemap migrated to CSS variables)
  - Chart config audit documenting all 20 chart types with gap analysis
affects: [04-charts-page, 05-kpis-page, 06-dashboards-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chart-type accent color maps as Record<LibraryChartType, string> in style-constants.ts"
    - "resolveColor() as the single entry point for CSS variable to hex conversion in chart renderers"

key-files:
  created:
    - .planning/phases/04-charts-page/chart-config-audit.md
  modified:
    - frontend/src/lib/style-constants.ts
    - frontend/src/index.css
    - frontend/src/lib/chart-themes.ts
    - frontend/src/components/charts/echart-wrapper.tsx
    - frontend/src/components/charts/ag-chart-wrapper.tsx

key-decisions:
  - "resolveColor exported as public API from chart-themes.ts for use by chart wrappers"
  - "--chart-warning uses same oklch value in light and dark (amber/gold tone works in both contexts)"

patterns-established:
  - "CHART_TYPE_* maps: Record<LibraryChartType, string> pattern for per-chart-type Tailwind classes"
  - "All chart renderer colors must go through resolveColor() or CSS variable reads, never hardcoded hex"

requirements-completed: [CHRT-03, CHRT-04, CHRT-05]

# Metrics
duration: 4min
completed: 2026-04-12
---

# Phase 4 Plan 01: Color Foundation + Config Audit Summary

**Chart-type accent color maps (3x20 entries), --chart-warning CSS token, hex-to-CSS-var migration in gauge/treemap, and 20-type config audit with 12 gap identifications**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-12T19:25:00Z
- **Completed:** 2026-04-12T19:29:10Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added three CHART_TYPE_* color maps (border, pill bg, pill text) covering all 20 LibraryChartType values to style-constants.ts
- Defined --chart-warning CSS variable in :root, .dark, and @theme inline, with hex fallback in chart-themes.ts
- Replaced all hard-coded hex in gauge (echart-wrapper) and treemap (ag-chart-wrapper) with resolveColor() calls
- Exported resolveColor() from chart-themes.ts for reuse across chart components
- Created comprehensive chart-config-audit.md documenting required vs captured vs applied config per chart type, identifying 12 types with gaps

## Task Commits

Each task was committed atomically:

1. **Task 1: Chart-type style constants + CSS tokens + hex migration** - `f70b7b1` (feat)
2. **Task 2: Chart config audit file** - `3988406` (docs)

## Files Created/Modified
- `frontend/src/lib/style-constants.ts` - Added CHART_TYPE_BORDER_COLORS, CHART_TYPE_PILL_BG, CHART_TYPE_PILL_TEXT maps
- `frontend/src/index.css` - Added --chart-warning CSS variable in :root, .dark, @theme inline
- `frontend/src/lib/chart-themes.ts` - Exported resolveColor(), added --chart-warning hex fallback
- `frontend/src/components/charts/echart-wrapper.tsx` - Replaced gauge hardcoded hex with resolveColor() calls
- `frontend/src/components/charts/ag-chart-wrapper.tsx` - Replaced treemap hardcoded hex with resolveColor() calls
- `.planning/phases/04-charts-page/chart-config-audit.md` - Full 20-type config audit with gap analysis

## Decisions Made
- resolveColor exported as public API from chart-themes.ts -- needed by both chart wrappers and potentially future components
- --chart-warning uses the same oklch value in both light and dark mode (the amber/gold tone provides sufficient contrast in both contexts, matching --series-7)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Color foundation ready for Plan 02 (chart list page with card/row views using CHART_TYPE_* accent maps)
- Config audit identifies priority gaps for Plan 03 (builder expansion)
- resolveColor() available as import for any future chart components needing CSS variable resolution

---
*Phase: 04-charts-page*
*Completed: 2026-04-12*
