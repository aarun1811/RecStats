---
phase: 06-chart-library
plan: 02
subsystem: ui
tags: [react, typescript, shadcn-accordion, chart-builder, tanstack-query, ag-charts, echarts, radix]

requires:
  - phase: 06-chart-library
    provides: RecvizChart types, CRUD hooks, chart-compatibility utility, ChartTypeIcon, CHART_DISPLAY_NAMES, Shadcn Accordion, route stubs
  - phase: 05-dataset-management
    provides: RecvizDataset type, useManagedDatasets hook, DatasetColumnMeta with role/aggregation metadata
provides:
  - Five-step accordion chart builder (Dataset, Chart Type, Column Mapping, Appearance, Save)
  - ChartBuilderPreview with context-sensitive rendering per step and live ChartFactory preview
  - MAPPING_FIELD_LABELS constant with dynamic labels for all 20 chart types
  - isChartComplete validation checking full builder state (not just name)
  - buildMappingSummary with aggregation display when overridden
  - Route pages at /charts/new (create) and /charts/:id/edit (edit mode with dataset loading)
affects: [06-03-chart-library-list, 08-dashboard-builder]

tech-stack:
  added: []
  patterns: [accordion-stepper-state-management, builder-preview-split-layout, mapping-field-labels-data-driven]

key-files:
  created:
    - frontend/src/components/charts/chart-builder.tsx
    - frontend/src/components/charts/chart-builder-preview.tsx
    - frontend/src/components/charts/builder/step-dataset.tsx
    - frontend/src/components/charts/builder/step-type.tsx
    - frontend/src/components/charts/builder/step-mapping.tsx
    - frontend/src/components/charts/builder/step-appearance.tsx
    - frontend/src/components/charts/builder/step-save.tsx
  modified:
    - frontend/src/routes/_app/charts/new.tsx
    - frontend/src/routes/_app/charts/$chartId.edit.tsx

key-decisions:
  - "MAPPING_FIELD_LABELS as data-driven constant (not switch-case) for all 20 chart types with correct labels (Source/Target for Sankey, not X-Axis)"
  - "Secondary dimensions (heatmap Y-Axis, sankey Target) encoded in metricColumns array positions since ChartColumnMapping has no secondaryDim field"
  - "isChartComplete validates full builder state: datasetId, chartType, metricColumns, categoryColumn (for types that need it), and name"
  - "Preview data fetched via /api/sql/execute endpoint with dataset SQL and 500-row limit for chart rendering"

patterns-established:
  - "Accordion stepper: controlled single-value Accordion with completeStep/resetFromStep/isStepLocked functions"
  - "Builder preview split: fixed-width accordion left (380px) + flex-1 preview right (min 50%)"
  - "Dynamic mapping field labels: MAPPING_FIELD_LABELS record drives per-chart-type form rendering"

requirements-completed: [CHRT-01, CHRT-02, CHRT-03, CHRT-05, CHRT-06]

duration: 5min
completed: 2026-04-06
---

# Phase 6 Plan 02: Chart Builder Summary

**Five-step accordion chart builder with dataset selection combobox, chart type grid with compatibility dimming, dynamic column mapping labels for all 20 types, live ChartFactory preview, and full completeness validation on save**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-06T09:32:57Z
- **Completed:** 2026-04-06T09:38:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Complete chart builder UI with accordion stepper managing step locking, downstream resets, and pre-populated edit mode
- MAPPING_FIELD_LABELS provides correct labels for all 20 chart types (Sankey shows Source/Target/Value, Heatmap shows X-Axis/Y-Axis/Color Metric, Gauge shows only Metric)
- Live chart preview renders via ChartFactory in Steps 3-5, with column metadata table in Step 1 and chart type descriptions in Step 2
- Save button validates full chart completeness (dataset, type, required mappings, AND name) with "Complete all steps before saving" hint

## Task Commits

Each task was committed atomically:

1. **Task 1: Chart builder accordion stepper with all 5 steps** - `9fd562c` (feat)
2. **Task 2: Chart builder preview panel and route page wiring** - `c10047a` (feat)

## Files Created/Modified

### Created
- `frontend/src/components/charts/chart-builder.tsx` - Accordion stepper orchestrator with BuilderState, step management, save handler
- `frontend/src/components/charts/chart-builder-preview.tsx` - Context-sensitive preview with column metadata, type info, and live chart rendering
- `frontend/src/components/charts/builder/step-dataset.tsx` - Popover+Command combobox for dataset selection
- `frontend/src/components/charts/builder/step-type.tsx` - Chart type icon grid with Standard/Exotic groups and compatibility dimming
- `frontend/src/components/charts/builder/step-mapping.tsx` - Column mapping with MAPPING_FIELD_LABELS, role-aware dropdowns, multi-metric support
- `frontend/src/components/charts/builder/step-appearance.tsx` - Title (debounced), legend, axis label controls
- `frontend/src/components/charts/builder/step-save.tsx` - Name/description fields with isChartComplete validation

### Modified
- `frontend/src/routes/_app/charts/new.tsx` - Replaced placeholder with full two-panel builder layout
- `frontend/src/routes/_app/charts/$chartId.edit.tsx` - Replaced placeholder with edit mode builder using useManagedChart + useManagedDataset

## Decisions Made
- **MAPPING_FIELD_LABELS data-driven approach:** A Record mapping each chart type to its field labels (categoryLabel, metricLabel, secondaryDimLabel, multiMetric, minMetrics) replaces switch-case logic. This ensures Sankey gets "Source"/"Target"/"Value", not generic "X-Axis"/"Metrics".
- **Secondary dimension encoding:** Since ChartColumnMapping has no secondaryDim field, types like Sankey/Heatmap/Graph encode the secondary dimension at metricColumns[0] with actual metrics at metricColumns[1+]. This works with the existing data model.
- **Full completeness validation:** isChartComplete checks datasetId, chartType, metricColumns.length > 0, categoryColumn for types that need it, scatter/combo special cases, and name. The save button is disabled until all checks pass.
- **Preview data via SQL execute:** Chart preview in Steps 3-5 fetches data through /api/sql/execute with the dataset's SQL query (500-row limit), then transforms to ChartDataResponse for ChartFactory rendering.

## Deviations from Plan
None - plan executed exactly as written.

## Known Stubs

None. All route stubs from Plan 01 (new.tsx and $chartId.edit.tsx) are now replaced with full implementations.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Chart builder fully functional at /charts/new and /charts/:id/edit
- Plan 03 (chart library list) can use the charts created through the builder
- ChartBuilderPreview exports BuilderPreviewState type for any future reuse
- All 20 chart types have correct mapping field labels ready for column mapping

## Self-Check: PASSED

All 7 created files verified present. Both task commits verified in git log.

---
*Phase: 06-chart-library*
*Completed: 2026-04-06*
