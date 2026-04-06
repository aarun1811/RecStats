---
phase: 06-chart-library
plan: 01
subsystem: api, ui
tags: [fastapi, sqlalchemy, pydantic, tanstack-query, ag-charts, lucide, shadcn-accordion, typescript]

requires:
  - phase: 05-dataset-management
    provides: RecvizDataset model, managed datasets CRUD pattern, dataset list page pattern, api-client with DATA_KEYS
provides:
  - RecvizChart SQLAlchemy model and Alembic migration (recviz_charts table)
  - Chart CRUD API at /api/charts/managed (6 endpoints)
  - Dataset-chart reference wiring (delete blocks when charts reference dataset)
  - RecvizChart TypeScript types with ChartColumnMapping, ChartAppearance, ChartLibraryConfig
  - TanStack Query CRUD hooks for charts
  - Chart type compatibility utility (20 chart types, 38 unit tests)
  - ChartTypeIcon Lucide icon mapping with CHART_DISPLAY_NAMES
  - Sidebar nav entry for Charts
  - Route stubs for /charts, /charts/new, /charts/:id/edit
  - Shadcn Accordion installed for builder stepper
  - bullet and box-plot added to AG Charts SUPPORTED_AG_TYPES
affects: [06-02-chart-builder, 06-03-chart-library-list, 08-dashboard-builder]

tech-stack:
  added: ["@radix-ui/react-accordion (via shadcn accordion)"]
  patterns: [chart-crud-api, chart-type-compatibility, chart-type-icon-mapping]

key-files:
  created:
    - backend/app/db/models/chart.py
    - backend/app/models/managed_chart.py
    - backend/app/api/managed_charts.py
    - backend/app/migrations/versions/003_add_charts.py
    - frontend/src/types/managed-chart.ts
    - frontend/src/hooks/use-managed-charts.ts
    - frontend/src/lib/chart-compatibility.ts
    - frontend/src/lib/chart-compatibility.test.ts
    - frontend/src/components/charts/chart-type-icon.tsx
    - frontend/src/components/ui/accordion.tsx
    - frontend/src/routes/_app/charts/index.tsx
    - frontend/src/routes/_app/charts/new.tsx
    - frontend/src/routes/_app/charts/$chartId.edit.tsx
    - backend/tests/test_managed_charts.py
  modified:
    - backend/app/api/router.py
    - backend/app/api/managed_datasets.py
    - frontend/src/lib/api-client.ts
    - frontend/src/components/charts/chart-factory.tsx
    - frontend/src/components/charts/ag-chart-wrapper.tsx
    - frontend/src/components/layout/nav-main.tsx
    - frontend/src/routeTree.gen.ts

key-decisions:
  - "Chart config JSONB stores column_mapping + appearance as nested Pydantic models with CamelModel aliasing"
  - "Added 'config' to api-client DATA_KEYS to prevent snake_case column names from being corrupted during camelCase transform"
  - "bullet and box-plot use bar series as rendering fallback until AG Charts native types are verified"
  - "managed_charts_router registered BEFORE charts_router in router.py to prevent path collision"

patterns-established:
  - "Chart CRUD API: clone of dataset CRUD but simpler (no Superset sync)"
  - "Chart type compatibility: getDatasetShape + isChartTypeCompatible with CHART_REQUIREMENTS record"
  - "ChartTypeIcon + CHART_DISPLAY_NAMES as shared chart type presentation layer"

requirements-completed: [CHRT-02, CHRT-03, CHRT-04, CHRT-05, CHRT-06]

duration: 7min
completed: 2026-04-06
---

# Phase 6 Plan 01: Chart Infrastructure Summary

**Chart CRUD API with 6 endpoints, frontend hooks/types, chart type compatibility utility (20 types), icon mapping, sidebar nav, and route stubs for builder and library pages**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-06T09:21:56Z
- **Completed:** 2026-04-06T09:29:03Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- Full chart CRUD backend with RecvizChart model, Pydantic schemas, 6 API endpoints, and Alembic migration
- Dataset delete now blocks when charts reference the dataset (409 response with referencing chart list)
- Chart type compatibility utility validates all 20 chart types against dataset column shapes (38 unit tests)
- Frontend infrastructure ready: TypeScript types, TanStack Query hooks, Lucide icon mapping, routes, nav entry

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend chart CRUD + Alembic migration + dataset reference wiring** (TDD)
   - `0f5d4a0` (test) - failing tests for chart CRUD
   - `c640322` (feat) - implementation passing all 9 tests
2. **Task 2: Frontend types, hooks, compatibility, icons, routes, nav** - `3c42894` (feat)

## Files Created/Modified

### Created
- `backend/app/db/models/chart.py` - RecvizChart SQLAlchemy model with JSONB config
- `backend/app/models/managed_chart.py` - Pydantic schemas: ChartCreate, ChartUpdate, ChartResponse, ChartConfigSchema
- `backend/app/api/managed_charts.py` - 6 CRUD endpoints at /api/charts/managed
- `backend/app/migrations/versions/003_add_charts.py` - Alembic migration for recviz_charts table
- `backend/tests/test_managed_charts.py` - 9 backend tests (chart CRUD + dataset reference checks)
- `frontend/src/types/managed-chart.ts` - RecvizChart, ChartCreate, ChartUpdate, ChartDeleteCheck, LibraryChartType
- `frontend/src/hooks/use-managed-charts.ts` - 6 TanStack Query CRUD hooks
- `frontend/src/lib/chart-compatibility.ts` - getDatasetShape, isChartTypeCompatible, CHART_REQUIREMENTS
- `frontend/src/lib/chart-compatibility.test.ts` - 38 unit tests for compatibility utility
- `frontend/src/components/charts/chart-type-icon.tsx` - ChartTypeIcon component + CHART_DISPLAY_NAMES
- `frontend/src/components/ui/accordion.tsx` - Shadcn Accordion (Radix primitive)
- `frontend/src/routes/_app/charts/index.tsx` - Charts list page route stub
- `frontend/src/routes/_app/charts/new.tsx` - New chart builder route stub
- `frontend/src/routes/_app/charts/$chartId.edit.tsx` - Edit chart builder route stub

### Modified
- `backend/app/api/router.py` - Registered managed_charts_router before charts_router
- `backend/app/api/managed_datasets.py` - Wired real chart reference checks in delete and references endpoints
- `frontend/src/lib/api-client.ts` - Added 'config' to DATA_KEYS skip set
- `frontend/src/components/charts/chart-factory.tsx` - Added bullet and box-plot to SUPPORTED_AG_TYPES
- `frontend/src/components/charts/ag-chart-wrapper.tsx` - Added bullet and box-plot cases to buildSeries()
- `frontend/src/components/layout/nav-main.tsx` - Added Charts nav item with PieChart icon

## Decisions Made
- **Chart config JSONB structure:** Nested `column_mapping` + `appearance` matching Pydantic schemas with CamelModel aliasing for consistent API contracts
- **api-client DATA_KEYS:** Added 'config' to prevent column names like `break_count` from being corrupted to `breakCount` during snake-to-camel transform (Research Pitfall 5)
- **bullet/box-plot rendering:** Using bar series as fallback since AG Charts v13 native bullet/box-plot types need verification; functionally renders data correctly
- **Router registration order:** managed_charts_router registered before charts_router to prevent /api/charts/managed colliding with /api/charts/:id (Research Pitfall 1)

## Deviations from Plan
None - plan executed exactly as written.

## Known Stubs

| File | Line | Reason | Resolved By |
|------|------|--------|-------------|
| `frontend/src/routes/_app/charts/index.tsx` | 17 | "Charts list coming soon" placeholder | Plan 03 (chart library list) |
| `frontend/src/routes/_app/charts/new.tsx` | 17 | "Chart builder coming soon" placeholder | Plan 02 (chart builder) |
| `frontend/src/routes/_app/charts/$chartId.edit.tsx` | 20 | "Edit chart coming soon" placeholder | Plan 02 (chart builder) |
| `backend/app/api/managed_charts.py` | get_chart_references | Always returns canDelete=true, empty referencingDashboards | Phase 8 (dashboard builder) |

All stubs are intentional and documented -- they are filled by subsequent plans in this phase or later phases.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Chart CRUD API fully operational and tested -- Plan 02 (chart builder) can create/read/update charts
- Compatibility utility ready -- Plan 02 step-type component can dim incompatible chart types
- ChartTypeIcon and CHART_DISPLAY_NAMES ready -- Plan 02 and Plan 03 reuse for chart type display
- Route stubs registered -- Plan 02 fills new.tsx and $chartId.edit.tsx, Plan 03 fills index.tsx
- Shadcn Accordion installed -- Plan 02 uses for accordion stepper

## Self-Check: PASSED

All 14 created files verified present. All 3 task commits verified in git log.

---
*Phase: 06-chart-library*
*Completed: 2026-04-06*
