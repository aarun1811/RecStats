---
phase: 07-kpi-library
plan: 01
subsystem: api, ui
tags: [fastapi, pydantic, sqlalchemy, alembic, tanstack-query, vitest, kpi]

# Dependency graph
requires:
  - phase: 06-chart-library
    provides: Chart CRUD pattern (SQLAlchemy model, Pydantic schemas, API router, dataset reference checking)
provides:
  - KPI CRUD API at /api/kpis/managed (6 endpoints)
  - RecvizKpi SQLAlchemy model and Alembic migration 004
  - Pydantic schemas with trend, threshold, and format config types
  - Dataset delete blocks when KPIs reference the dataset
  - Frontend TypeScript types mirroring backend KPI schemas
  - TanStack Query CRUD hooks for KPI management
  - KPI utility functions (threshold coloring, trend subtitles, aggregation)
  - Sidebar KPIs nav item with Gauge icon
  - Route stubs for /kpis, /kpis/new, /kpis/$kpiId/edit
affects: [07-02-kpi-builder, 07-03-kpi-library-list, 08-dashboard-builder]

# Tech tracking
tech-stack:
  added: []
  patterns: [KPI config schema with discriminated union trend types, threshold level coloring utility]

key-files:
  created:
    - backend/app/db/models/kpi.py
    - backend/app/models/managed_kpi.py
    - backend/app/api/managed_kpis.py
    - backend/app/migrations/versions/004_add_kpis.py
    - backend/tests/test_managed_kpis.py
    - frontend/src/types/managed-kpi.ts
    - frontend/src/hooks/use-managed-kpis.ts
    - frontend/src/lib/kpi-utils.ts
    - frontend/src/lib/kpi-utils.test.ts
    - frontend/src/routes/_app/kpis/index.tsx
    - frontend/src/routes/_app/kpis/new.tsx
    - frontend/src/routes/_app/kpis/$kpiId.edit.tsx
  modified:
    - backend/app/api/router.py
    - backend/app/api/managed_datasets.py
    - backend/app/models/managed_dataset.py
    - backend/tests/test_managed_charts.py
    - frontend/src/components/layout/nav-main.tsx
    - frontend/src/routeTree.gen.ts

key-decisions:
  - "ReferencingDashboard imported from managed_chart (reuse existing model for KPI references placeholder)"
  - "KPI config uses discriminated union for trend types (TrendPeriodConfig vs TrendTargetConfig) via mode field"
  - "Dataset delete checks both charts and KPIs in single flow before raising 409"

patterns-established:
  - "KPI CRUD: Same pattern as chart CRUD -- SQLAlchemy model + Pydantic schemas + APIRouter + TanStack Query hooks"
  - "Threshold level utility: getThresholdLevel returns green/amber/red/none with THRESHOLD_STYLES mapping"

requirements-completed: [KPI-01, KPI-02, KPI-03]

# Metrics
duration: 7min
completed: 2026-04-06
---

# Phase 07 Plan 01: KPI CRUD Infrastructure Summary

**KPI CRUD API with 6 endpoints, Pydantic config schemas with trend/threshold types, frontend hooks, threshold/aggregation utilities, and sidebar navigation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-06T17:43:20Z
- **Completed:** 2026-04-06T17:50:28Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Full KPI CRUD API (list, create, get, update, delete, references) at /api/kpis/managed with typed config schema supporting format, trend, and threshold configuration
- Dataset delete reference checking extended to include KPIs alongside charts -- blocks deletion with 409 when either references exist
- Frontend KPI infrastructure: TypeScript types, TanStack Query hooks, utility functions with 22 passing Vitest tests, sidebar nav entry, and route stubs for builder and library pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend KPI CRUD + Alembic migration + dataset reference wiring**
   - `ae2ad73` (test: add failing tests for KPI CRUD API -- RED phase)
   - `90df3bc` (feat: KPI CRUD API with dataset reference wiring -- GREEN phase)
2. **Task 2: Frontend types, hooks, KPI utilities, sidebar nav, and route stubs** - `0df77e6` (feat)

## Files Created/Modified
- `backend/app/db/models/kpi.py` - RecvizKpi SQLAlchemy model with JSONB config
- `backend/app/models/managed_kpi.py` - Pydantic schemas: KpiCreate, KpiUpdate, KpiResponse, KpiConfigSchema, ThresholdConfig, TrendPeriodConfig, TrendTargetConfig
- `backend/app/api/managed_kpis.py` - 6 CRUD endpoints at /api/kpis/managed
- `backend/app/migrations/versions/004_add_kpis.py` - Alembic migration creating recviz_kpis table with dataset_id index
- `backend/app/api/router.py` - Registered managed_kpis_router before managed_charts_router
- `backend/app/api/managed_datasets.py` - Extended delete + references endpoints to check KPIs
- `backend/app/models/managed_dataset.py` - Added ReferencingKpi model and referencing_kpis field to DatasetDeleteCheck
- `backend/tests/test_managed_kpis.py` - 9 tests covering all CRUD endpoints + dataset reference wiring
- `backend/tests/test_managed_charts.py` - Updated existing dataset reference tests for 3-query flow
- `frontend/src/types/managed-kpi.ts` - RecvizKpi, KpiCreate, KpiUpdate, KpiDeleteCheck, config types
- `frontend/src/hooks/use-managed-kpis.ts` - 6 TanStack Query hooks for KPI CRUD
- `frontend/src/lib/kpi-utils.ts` - getThresholdLevel, THRESHOLD_STYLES, getTrendSubtitle, computeAggregation
- `frontend/src/lib/kpi-utils.test.ts` - 22 Vitest tests for all utility functions
- `frontend/src/components/layout/nav-main.tsx` - Added Gauge icon import and KPIs nav item between Charts and Datasets
- `frontend/src/routes/_app/kpis/index.tsx` - KPI library route stub
- `frontend/src/routes/_app/kpis/new.tsx` - New KPI builder route stub
- `frontend/src/routes/_app/kpis/$kpiId.edit.tsx` - Edit KPI route stub
- `frontend/src/routeTree.gen.ts` - Auto-regenerated with new KPI routes

## Decisions Made
- ReferencingDashboard imported from managed_chart module for reuse in KpiDeleteCheck (same model shape, avoids duplication)
- KPI config uses discriminated union for trend types via `mode` field -- TrendPeriodConfig (mode: "previous_period") vs TrendTargetConfig (mode: "static_target")
- Dataset delete now queries both charts AND KPIs before raising 409, reporting all references in the error detail

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing chart tests for new 3-query dataset reference flow**
- **Found during:** Task 1 (GREEN phase verification)
- **Issue:** Existing chart tests (`test_dataset_references_returns_referencing_charts` and `test_dataset_delete_blocked_when_charts_reference`) only provided 2 `side_effect` entries for `session.execute`, but the updated endpoints now make 3 queries (dataset lookup, chart query, KPI query)
- **Fix:** Added a third mock result (empty KPI list) to the `side_effect` list in both tests
- **Files modified:** `backend/tests/test_managed_charts.py`
- **Verification:** All 18 backend tests pass (9 chart + 9 KPI)
- **Committed in:** 90df3bc (part of Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary fix to prevent regression in existing tests. No scope creep.

## Known Stubs

| File | Line | Reason |
|------|------|--------|
| `frontend/src/routes/_app/kpis/index.tsx` | 24 | "KPI library coming soon" -- placeholder, replaced by Plan 03 |
| `frontend/src/routes/_app/kpis/new.tsx` | 24 | "KPI builder coming soon" -- placeholder, replaced by Plan 02 |
| `frontend/src/routes/_app/kpis/$kpiId.edit.tsx` | 24 | "Edit KPI coming soon" -- placeholder, replaced by Plan 02 |
| `backend/app/api/managed_kpis.py` | 131 | References endpoint returns placeholder canDelete=true -- real dashboard checks in Phase 8 |

These stubs are intentional scaffolding -- Plans 02 and 03 replace them with full implementations.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- KPI CRUD API is fully functional and tested -- Plans 02 (builder) and 03 (library list) can proceed independently
- Frontend hooks and types are ready for consumption by builder and library components
- Route stubs are registered and navigable via sidebar
- Alembic migration 004 must be run (`alembic upgrade head`) to create the recviz_kpis table in the database

---
*Phase: 07-kpi-library*
*Completed: 2026-04-06*
