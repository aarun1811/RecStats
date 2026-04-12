---
phase: 04-charts-page
reviewed: 2026-04-12T18:45:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - frontend/src/components/charts/ag-chart-wrapper.tsx
  - frontend/src/components/charts/builder/step-appearance.tsx
  - frontend/src/components/charts/builder/step-mapping.tsx
  - frontend/src/components/charts/builder/step-save.tsx
  - frontend/src/components/charts/chart-builder-help-sheet.tsx
  - frontend/src/components/charts/chart-builder.tsx
  - frontend/src/components/charts/chart-detail-panel.tsx
  - frontend/src/components/charts/chart-library-card.tsx
  - frontend/src/components/charts/chart-library-list.tsx
  - frontend/src/components/charts/chart-library-row.tsx
  - frontend/src/components/charts/echart-wrapper.tsx
  - frontend/src/components/ui/slider.tsx
  - frontend/src/index.css
  - frontend/src/lib/chart-themes.ts
  - frontend/src/lib/style-constants.ts
  - frontend/src/routes/_app/charts/index.tsx
  - frontend/src/types/managed-chart.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-04-12T18:45:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The Phase 4 charts page implementation is well-structured overall. The chart builder wizard (step-based accordion), library list/card/row views, detail panel, and dual chart wrappers (AG Charts + ECharts) are cleanly organized. Type safety is strong throughout, and the project conventions from CLAUDE.md are followed consistently (named function exports, kebab-case files, TanStack Query patterns, Shadcn CSS-variable colors, dark mode variants).

No critical security issues or crashers were found. The main concerns are: a missing `await` on a promise in `ag-chart-wrapper.tsx`, an unused `mode` prop in dead code (`step-save.tsx`), and a couple of logic gaps in type-specific appearance handling that could silently drop builder configuration.

## Warnings

### WR-01: Missing `await` on `internalChartRef.current?.download()` in `useImperativeHandle`

**File:** `frontend/src/components/charts/ag-chart-wrapper.tsx:242`
**Issue:** The `download` method in `useImperativeHandle` calls `internalChartRef.current?.download(...)` without checking if the ref is null first. If `internalChartRef.current` is null (chart not yet mounted), the optional chain silently does nothing -- which is acceptable. However, the `getImageDataURL` method on line 244-245 awaits the result of `internalChartRef.current?.getImageDataURL()`, but `download` does not return a value so callers have no way to know if the download succeeded or silently failed. This is a minor UX concern where the user clicks "Download" and nothing happens with no error feedback.
**Fix:** Add a guard and surface feedback:
```typescript
download(fileName: string) {
  if (!internalChartRef.current) {
    console.warn('Chart not ready for download')
    return
  }
  internalChartRef.current.download({ fileName, fileFormat: 'image/png' })
},
```

### WR-02: Appearance `typeSpecific` fields not propagated to `buildSeries` for several chart types

**File:** `frontend/src/components/charts/ag-chart-wrapper.tsx:302-373`
**Issue:** The `StepAppearance` component (step-appearance.tsx) collects type-specific fields like `donutInnerRadius`, `scatterPointShape`, `waterfallPositive`/`waterfallNegative`, `pieLabelPosition`, and `donutLabelPosition` into `config.appearance.typeSpecific`. However, `buildSeries` in `ag-chart-wrapper.tsx` does not read any of these values from the appearance object. For example:
- `donutInnerRadius` is hardcoded to `0.6` on line 116 instead of reading from `appearance?.typeSpecific?.donutInnerRadius`.
- `scatterPointShape` is collected but never applied to the scatter series.
- `pieLabelPosition` and `donutLabelPosition` are collected but callout labels are not configured based on them.
- `waterfallPositive`/`waterfallNegative` colors are collected but not passed through.

This means the builder's appearance step lets users configure these options but they have no effect on the rendered chart.
**Fix:** Pass `appearance?.typeSpecific` into `buildSeries` and apply the values. For example, for donut:
```typescript
case 'donut': {
  const angleKey = metricKeys[0] ?? columns.find((c) => c !== categoryKey) ?? 'count'
  const innerRadius = (appearance?.typeSpecific?.donutInnerRadius as number) ?? 0.6
  return [{
    type: 'donut' as const,
    angleKey,
    calloutLabelKey: categoryKey,
    innerRadiusRatio: innerRadius,
    ...(styler ? { itemStyler: styler } : {}),
  }]
}
```

### WR-03: `chart-detail-panel.tsx` query key does not include `dataset.sql`, risking stale cache across dataset edits

**File:** `frontend/src/components/charts/chart-detail-panel.tsx:43`
**Issue:** The query key `['chart-preview-data', chart?.datasetId]` only includes the dataset ID. If a dataset's SQL is edited (updated), the cached query result will be stale because TanStack Query identifies cache entries by key. The same issue exists in `chart-library-card.tsx:30` with key `['chart-thumbnail', chart.datasetId]`. After a dataset SQL change, users would see old preview data until the cache expires (5 minutes for the card, default for the panel).
**Fix:** Include a version indicator in the query key. If `dataset.updatedAt` is available:
```typescript
queryKey: ['chart-preview-data', chart?.datasetId, dataset?.updatedAt],
```
Or invalidate these query keys when a dataset is mutated (in the dataset mutation hooks).

### WR-04: `chart-builder.tsx` resets `columnMapping` on type change but not `appearance.typeSpecific`

**File:** `frontend/src/components/charts/chart-builder.tsx:255-268`
**Issue:** When the user changes chart type in `handleTypeSelect`, the builder resets `columnMapping` to `DEFAULT_COLUMN_MAPPING` (line 261) but does not reset `appearance.typeSpecific`. This means if a user configures heatmap-specific options (like `colorRangeMin`/`colorRangeMax`), then switches to a bar chart, those heatmap-specific values remain in `typeSpecific`. While they won't be rendered (the appearance step only shows relevant fields), they will be saved to the backend as stale config cruft. If the user later switches back to heatmap, the old values would reappear.
**Fix:** Reset `typeSpecific` when chart type changes:
```typescript
function handleTypeSelect(type: LibraryChartType) {
  const isChange = state.chartType !== type
  setState((prev) => ({
    ...prev,
    chartType: type,
    ...(isChange
      ? {
          columnMapping: DEFAULT_COLUMN_MAPPING,
          appearance: { ...prev.appearance, typeSpecific: {} },
        }
      : {}),
  }))
  // ...
}
```

## Info

### IN-01: `step-save.tsx` is dead code (exported but never imported)

**File:** `frontend/src/components/charts/builder/step-save.tsx:1-71`
**Issue:** `StepSave` is exported but not imported anywhere in the codebase. The chart builder (`chart-builder.tsx`) handles save directly in its header bar rather than using this step component. Additionally, the `mode` prop is declared in `StepSaveProps` (line 14) but not destructured in the component (line 18-25), which would be a TypeScript warning in strict builds.
**Fix:** Delete `frontend/src/components/charts/builder/step-save.tsx` if it is not planned for future use.

### IN-02: `hslToHex` function in `chart-themes.ts` is effectively dead code

**File:** `frontend/src/lib/chart-themes.ts:12-30`
**Issue:** The `hslToHex` function handles legacy "H S% L%" bare values from older Shadcn setups. The project's `index.css` exclusively uses `oklch()` color values, and the `resolveColor` function routes `oklch`/`hsl`/`lch`/`lab` strings through `cssColorToHex` (the browser DOM method) before reaching `hslToHex`. The only path to `hslToHex` is if the CSS variable value is a bare space-separated number format, which the current CSS does not produce.
**Fix:** This is safe to leave as a defensive fallback, but can be removed for clarity if the project has no plans to support legacy Shadcn HSL format.

### IN-03: `cssColorToHex` in `chart-themes.ts` creates/removes a DOM element on every call

**File:** `frontend/src/lib/chart-themes.ts:32-46`
**Issue:** `cssColorToHex` appends a `<div>` to `document.body`, reads its computed style, and removes it. This is called multiple times during theme initialization (once per CSS variable resolved). While not a performance bug for the current usage (called during theme changes only, not in hot loops), it could cause layout thrashing if called frequently.
**Fix:** Consider caching resolved colors per theme, or batch-resolving all colors in a single DOM operation.

### IN-04: `echart-wrapper.tsx` module-level mutable state for theme registration

**File:** `frontend/src/components/charts/echart-wrapper.tsx:36-42`
**Issue:** `lastRegisteredTheme` is a module-level mutable variable used to avoid re-registering the ECharts theme. This works in a single-instance scenario but could behave unexpectedly if the module is hot-reloaded (the variable resets). This is a minor concern since theme registration is idempotent (re-registering overwrites).
**Fix:** No change needed; noting for awareness.

---

_Reviewed: 2026-04-12T18:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
