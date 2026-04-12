---
phase: 04-charts-page
plan: 03
subsystem: ui
tags: [react, motion, animation, shadcn, chart-builder, tooltips, help-sheet]

# Dependency graph
requires:
  - phase: 04-01
    provides: Chart library page with card/row views, type-accent colors, style constants
  - phase: 04-02
    provides: Detail panel, ECharts thumbnails, hardcoded hex migration, console error fixes
provides:
  - Builder accordion motion animations (fade, crossfade, spring checkmark)
  - Inline HelpCircle tooltips on all mapping fields for 20 chart types
  - Chart-type-specific help sheet (BookOpen button, Sheet with config reference)
  - ChartAppearance typeSpecific record for chart-type-conditional fields
  - Expanded appearance step with heatmap/gauge/treemap/waterfall/pie/donut/scatter fields
  - ColorSwatchPicker component constrained to palette presets
affects: [04-04, dashboards-phase]

# Tech tracking
tech-stack:
  added: [slider (shadcn)]
  patterns: [typeSpecific record for chart-type-conditional config, ColorSwatchPicker with CSS variable storage]

key-files:
  created:
    - frontend/src/components/charts/chart-builder-help-sheet.tsx
    - frontend/src/components/ui/slider.tsx
  modified:
    - frontend/src/components/charts/chart-builder.tsx
    - frontend/src/components/charts/builder/step-mapping.tsx
    - frontend/src/components/charts/builder/step-appearance.tsx
    - frontend/src/types/managed-chart.ts

key-decisions:
  - "Store CSS variable names (not resolved hex) in typeSpecific for theme portability"
  - "ColorSwatchPicker constrained to 10 palette presets (8 series + positive/negative)"
  - "Slider component added from shadcn for donut inner radius control"

patterns-established:
  - "typeSpecific record pattern: optional Record<string, unknown> in ChartAppearance for chart-type-conditional config"
  - "MAPPING_FIELD_TOOLTIPS pattern: per-chart-type field tooltip text stored as Record<string, Record<string, string>>"
  - "CHART_HELP_CONTENT pattern: per-chart-type structured help content (required, optional, aggregation, example)"

requirements-completed: [CHRT-02, CHRT-03, CHRT-07]

# Metrics
duration: 9min
completed: 2026-04-12
---

# Phase 04 Plan 03: Builder Animations, Tooltips & Appearance Expansion Summary

**Motion-animated builder accordion with inline mapping tooltips, chart-type help sheet, and conditional appearance fields for 7 chart types**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-12T19:37:52Z
- **Completed:** 2026-04-12T19:47:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Builder wizard now has motion animations: accordion content fades in/out, preview crossfades on type/mapping changes, step completion checkmarks animate with spring physics
- All 20 chart types have inline HelpCircle tooltips on every mapping field (category, secondary dimension, metric labels)
- Chart-type-specific help sheet (Sheet side=right) with structured sections: Required Fields, Optional Fields, Aggregation, Example Mapping
- ChartAppearance interface extended with optional typeSpecific record enabling chart-type-conditional config
- Expanded appearance step with conditional fields for heatmap (color range), gauge (min/max/thresholds), treemap (color range), waterfall (positive/negative colors), pie (label position), donut (inner radius slider + label position), scatter (point shape)
- ColorSwatchPicker component stores CSS variable names for theme portability

## Task Commits

Each task was committed atomically:

1. **Task 1: Builder animations + mapping tooltips + help sheet** - `6e86034` (feat)
2. **Task 2: Appearance step expansion + ChartAppearance type update** - `1585259` (feat)

## Files Created/Modified
- `frontend/src/components/charts/chart-builder.tsx` - Added motion imports, AnimatePresence preview crossfade, spring checkmark, accordion content fade, BookOpen help sheet trigger, helpSheetOpen state, chartType prop to StepAppearance, typeSpecific in DEFAULT_APPEARANCE
- `frontend/src/components/charts/chart-builder-help-sheet.tsx` - New: CHART_HELP_CONTENT for all 20 chart types with required/optional fields, aggregation, examples; Sheet with motion entrance animation
- `frontend/src/components/charts/builder/step-mapping.tsx` - Added HelpCircle Popover tooltips on category, secondary dim, and metric labels; MAPPING_FIELD_TOOLTIPS for all 20 chart types
- `frontend/src/components/charts/builder/step-appearance.tsx` - Extended with chartType prop, ColorSwatchPicker, conditional fields for heatmap/gauge/treemap/waterfall/pie/donut/scatter using typeSpecific read/write helpers
- `frontend/src/types/managed-chart.ts` - Added optional typeSpecific?: Record<string, unknown> to ChartAppearance
- `frontend/src/components/ui/slider.tsx` - New: Slider shadcn component for donut inner radius

## Decisions Made
- Store CSS variable names (e.g. `--series-1`) in typeSpecific config, not resolved hex values -- keeps configs portable across light/dark themes
- ColorSwatchPicker constrained to 10 palette presets (8 series colors + positive + negative) -- no free-form color input ensures visual consistency
- Added Slider shadcn component for donut inner radius control (0.3 - 0.8 range)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed chart-themes import path in step-appearance.tsx**
- **Found during:** Task 2
- **Issue:** Plan referenced `@/components/charts/chart-themes` but resolveColor is exported from `@/lib/chart-themes`
- **Fix:** Corrected import path to `@/lib/chart-themes`
- **Files modified:** step-appearance.tsx
- **Verification:** TypeScript compiles clean
- **Committed in:** 1585259

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Import path correction necessary for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Builder wizard fully polished with animations, tooltips, and chart-type-specific help
- All 20 chart types have configuration reference content
- ChartAppearance typeSpecific record ready for downstream consumers (chart wrappers, renderers)
- Ready for Plan 04 (final wave)

---
*Phase: 04-charts-page*
*Completed: 2026-04-12*
