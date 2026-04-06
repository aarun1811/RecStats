---
phase: 07-kpi-library
plan: 02
subsystem: ui
tags: [react, tanstack-query, motion-react, shadcn, resizable-panels, kpi-builder]

# Dependency graph
requires:
  - phase: 07-01
    provides: KPI CRUD hooks (useCreateKpi, useUpdateKpi, useDeleteKpi), RecvizKpi types, kpi-utils (threshold/trend/aggregation), route stubs
  - phase: 06-02
    provides: Chart builder pattern (ResizablePanelGroup, step components, preview panel, save/delete flow)
  - phase: 05-02
    provides: Dataset management hooks (useManagedDatasets, useManagedDataset), RecvizDataset types
provides:
  - KPI builder form at /kpis/new with 5 labeled sections (dataset, column, format, trend, thresholds)
  - Live KPI card preview panel with real data from dataset SQL execution
  - KpiPreviewCard reusable component with animated counter, threshold colors, trend arrows
  - Edit KPI page at /kpis/:id/edit with full pre-population from existing KPI
  - Delete KPI confirmation dialog in edit mode
affects: [07-03-kpi-library-list, 08-dashboard-builder]

# Tech tracking
tech-stack:
  added: []
  patterns: [Scrollable form sections instead of accordion for compact builders, KPI preview card as reusable rendering primitive]

key-files:
  created:
    - frontend/src/components/kpis/kpi-builder.tsx
    - frontend/src/components/kpis/kpi-builder-preview.tsx
    - frontend/src/components/kpis/kpi-preview-card.tsx
    - frontend/src/components/kpis/builder/step-dataset.tsx
    - frontend/src/components/kpis/builder/step-column.tsx
    - frontend/src/components/kpis/builder/step-format.tsx
    - frontend/src/components/kpis/builder/step-trend.tsx
    - frontend/src/components/kpis/builder/step-thresholds.tsx
  modified:
    - frontend/src/routes/_app/kpis/new.tsx
    - frontend/src/routes/_app/kpis/$kpiId.edit.tsx

key-decisions:
  - "Single scrollable form with labeled sections (not accordion) for KPI builder -- 5 compact field groups don't need accordion complexity"
  - "KpiPreviewCard as standalone reusable component -- used by builder preview, will be reused by library cards and dashboard renderer"
  - "Client-side aggregation via computeAggregation for builder preview -- queries dataset SQL, extracts metric column values, applies aggregation function"

patterns-established:
  - "KPI builder: scrollable form sections with numbered headers (1. Dataset, 2. Metric, etc.) for simple builders"
  - "KPI preview: fetch dataset via /api/sql/execute, compute aggregation client-side, render via KpiPreviewCard"

requirements-completed: [KPI-01, KPI-03]

# Metrics
duration: 5min
completed: 2026-04-06
---

# Phase 07 Plan 02: KPI Builder & Preview Summary

**KPI template editor with 5-section scrollable form, live preview card with animated counter at 0.8s, threshold coloring, trend arrows, and dataset-driven aggregation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-06T17:58:35Z
- **Completed:** 2026-04-06T18:03:35Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Full KPI builder at /kpis/new with ResizablePanelGroup layout (form left, preview right) and 5 labeled sections covering dataset selection, metric column + aggregation, format, trend comparison, and thresholds + details
- Live KPI card preview fetches real data from the selected dataset via /api/sql/execute, computes aggregated value client-side using computeAggregation, and renders via KpiPreviewCard with animated counter (0.8s), threshold colors (green/amber/red), and trend arrows
- Edit mode at /kpis/:id/edit loads existing KPI and dataset, pre-populates all form fields, and supports save changes + delete with confirmation dialog

## Task Commits

Each task was committed atomically:

1. **Task 1: KPI builder form with 5 sections and save handler** - `75fe7c2` (feat)
2. **Task 2: KPI preview card, builder preview panel, and route page wiring** - `406dc64` (feat)

## Files Created/Modified
- `frontend/src/components/kpis/kpi-builder.tsx` - Main builder orchestrator with BuilderState, ResizablePanelGroup, save/delete handlers
- `frontend/src/components/kpis/kpi-builder-preview.tsx` - Live preview panel with dataset query, client-side aggregation, configuration summary
- `frontend/src/components/kpis/kpi-preview-card.tsx` - Reusable KPI card: CountAnimation (0.8s), threshold THRESHOLD_STYLES coloring, TrendingUp/Down arrows
- `frontend/src/components/kpis/builder/step-dataset.tsx` - Popover+Command combobox dataset picker
- `frontend/src/components/kpis/builder/step-column.tsx` - Metric column select (numeric/currency only, measures first) + aggregation select
- `frontend/src/components/kpis/builder/step-format.tsx` - Format type, currency code, abbreviate toggle, decimal places
- `frontend/src/components/kpis/builder/step-trend.tsx` - Enable toggle, previous_period/static_target modes, period/target value, subtitle
- `frontend/src/components/kpis/builder/step-thresholds.tsx` - Enable toggle, green/amber inputs with color indicators, visual legend, name + description
- `frontend/src/routes/_app/kpis/new.tsx` - Replaced stub with KpiBuilder create mode
- `frontend/src/routes/_app/kpis/$kpiId.edit.tsx` - Replaced stub with KpiBuilder edit mode (useManagedKpi + useManagedDataset)

## Decisions Made
- Used single scrollable form with labeled sections (per Claude's Discretion from CONTEXT.md and Research A2) instead of accordion stepper -- 5 compact field groups are simpler as a continuous form
- KpiPreviewCard designed as standalone reusable component (not embedded in builder) -- Plan 03 library cards and Phase 8 dashboard will reuse it
- Trend percentage shows "Trend: configured" placeholder in builder preview since full trend computation requires date-shifted queries (Phase 8)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- KPI builder is fully functional and type-checked -- Plan 03 (KPI library list) can proceed
- KpiPreviewCard is ready for reuse in library cards (Plan 03) and dashboard rendering (Phase 8)
- All 203 existing frontend tests pass with zero regressions

## Self-Check: PASSED

- All 10 created/modified files verified present on disk
- Commits 75fe7c2 (Task 1) and 406dc64 (Task 2) verified in git log
- TypeScript compiles with zero errors
- All 203 existing tests pass with zero regressions

---
*Phase: 07-kpi-library*
*Completed: 2026-04-06*
