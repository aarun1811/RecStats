---
phase: 04-charts-page
fixed_at: 2026-04-12T20:17:07Z
review_path: .planning/phases/04-charts-page/04-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-04-12T20:17:07Z
**Source review:** .planning/phases/04-charts-page/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Missing `await` on `internalChartRef.current?.download()` in `useImperativeHandle`

**Files modified:** `frontend/src/components/charts/ag-chart-wrapper.tsx`
**Commit:** 9324143
**Applied fix:** Added a null guard on `internalChartRef.current` before calling `download()`. When the chart is not yet mounted, a `console.warn` message is logged and the function returns early instead of silently doing nothing via optional chaining.

### WR-02: Appearance `typeSpecific` fields not propagated to `buildSeries` for several chart types

**Files modified:** `frontend/src/types/chart.ts`, `frontend/src/components/charts/chart-builder-preview.tsx`, `frontend/src/components/charts/ag-chart-wrapper.tsx`
**Commit:** ed02c39
**Applied fix:** Three-part fix:
1. Added `typeSpecific?: Record<string, unknown>` to `ChartConfig.appearance` type in `chart.ts`.
2. Passed `typeSpecific` through in `buildPreviewConfig()` in `chart-builder-preview.tsx`.
3. Updated `buildSeries()` in `ag-chart-wrapper.tsx` to read and apply type-specific values:
   - **donut**: `donutInnerRadius` from `typeSpecific` (was hardcoded to 0.6), `donutLabelPosition` controls callout label visibility.
   - **pie**: `pieLabelPosition` controls callout/sector label visibility.
   - **scatter**: `scatterPointShape` applied to `marker.shape`.
   - **waterfall**: `waterfallPositive`/`waterfallNegative` CSS variable refs resolved to hex colors and applied to item fill.

### WR-03: `chart-detail-panel.tsx` query key does not include `dataset.sql`, risking stale cache across dataset edits

**Files modified:** `frontend/src/components/charts/chart-detail-panel.tsx`, `frontend/src/components/charts/chart-library-card.tsx`
**Commit:** 11b7b55
**Applied fix:** Added `dataset?.updatedAt` to the TanStack Query keys in both files. When a dataset is edited, the updated timestamp changes, which invalidates the cached query result and forces a refetch.

### WR-04: `chart-builder.tsx` resets `columnMapping` on type change but not `appearance.typeSpecific`

**Files modified:** `frontend/src/components/charts/chart-builder.tsx`
**Commit:** 9fd0d06
**Applied fix:** In `handleTypeSelect`, when `isChange` is true, the state update now also resets `appearance.typeSpecific` to `{}` alongside the `columnMapping` reset. This prevents stale type-specific config from a previous chart type persisting in the saved configuration.

---

_Fixed: 2026-04-12T20:17:07Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
