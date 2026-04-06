---
phase: 05-dataset-management
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, pydantic, alembic, superset, postgresql, crud, dataset]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Base SQLAlchemy model, Alembic migration infrastructure, CamelModel, SupersetClient, sanitize_detail
  - phase: 04-data-source-connectivity
    provides: DatabaseRegistrar pattern, SupersetClient database methods pattern
provides:
  - RecvizDataset SQLAlchemy model with Superset sync tracking
  - Alembic migration 002 for recviz_datasets table
  - Pydantic v2 request/response models (DatasetCreate, DatasetUpdate, DatasetResponse, ColumnMetaSchema)
  - SupersetClient create_dataset/update_dataset/delete_dataset methods
  - DatasetSyncService with sync, reconcile, and delete_synced
  - 6 CRUD endpoints under /api/datasets/managed
  - DatasetSyncDep dependency injection
  - Startup reconciliation of unsynced datasets
affects: [05-02, 05-03, 06-chart-library, 08-dashboard-builder]

# Tech tracking
tech-stack:
  added: []
  patterns: [dataset-sync-service, crud-with-superset-sync, tdd-red-green-commit]

key-files:
  created:
    - backend/app/db/models/dataset.py
    - backend/app/migrations/versions/002_add_datasets.py
    - backend/app/models/managed_dataset.py
    - backend/app/services/dataset_sync.py
    - backend/app/api/managed_datasets.py
    - backend/tests/test_dataset_sync.py
    - backend/tests/test_managed_datasets.py
  modified:
    - backend/app/db/models/__init__.py
    - backend/app/migrations/env.py
    - backend/app/services/superset_client.py
    - backend/app/api/router.py
    - backend/app/core/dependencies.py
    - backend/app/main.py

key-decisions:
  - "Python-side datetime defaults on RecvizDataset model ensure fields populated at construction time (not just DB insert)"
  - "Superset POST uses 'database' key, PUT uses 'database_id' key per Superset API asymmetry"
  - "recviz__{uuid} table_name format for Superset virtual dataset uniqueness"
  - "Sync failure saves dataset with sync_status='error' rather than failing the request (D-20 resilience)"

patterns-established:
  - "DatasetSyncService pattern: sync on create/update, reconcile on startup, non-blocking failures"
  - "CRUD endpoint pattern: Pydantic body validation, DB query, sync attempt, response mapping"
  - "DatasetSyncDep dependency injection via app.state for service singletons"

requirements-completed: [DSET-01, DSET-04, DSET-05]

# Metrics
duration: 7min
completed: 2026-04-06
---

# Phase 05 Plan 01: Dataset Backend API Summary

**RecvizDataset SQLAlchemy model with CRUD endpoints, Superset virtual dataset sync, Alembic migration 002, and startup reconciliation service**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-06T04:59:52Z
- **Completed:** 2026-04-06T05:07:17Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Complete CRUD REST API for managed datasets (6 endpoints under /api/datasets/managed)
- Superset virtual dataset sync on create/update with graceful failure handling
- DatasetSyncService with startup reconciliation for unsynced datasets
- 19 unit tests covering sync service, client extensions, and all CRUD operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Data model, migration, Pydantic schemas, SupersetClient extensions, and DatasetSyncService** - `cfe4148` (feat)
2. **Task 2: CRUD API endpoints, dependency injection, startup reconciliation, and endpoint tests** - `fa5d175` (feat)

_Both tasks used TDD: tests written first (RED), then implementation (GREEN)._

## Files Created/Modified
- `backend/app/db/models/dataset.py` - RecvizDataset SQLAlchemy model with sync tracking columns
- `backend/app/migrations/versions/002_add_datasets.py` - Alembic migration creating recviz_datasets table
- `backend/app/models/managed_dataset.py` - Pydantic v2 models: DatasetCreate, DatasetUpdate, DatasetResponse, ColumnMetaSchema, DatasetDeleteCheck
- `backend/app/services/dataset_sync.py` - DatasetSyncService with sync_dataset, reconcile, delete_synced
- `backend/app/services/superset_client.py` - Added create_dataset, update_dataset, delete_dataset methods
- `backend/app/api/managed_datasets.py` - 6 CRUD endpoints for managed datasets
- `backend/app/api/router.py` - Registered managed_datasets_router
- `backend/app/core/dependencies.py` - Added DatasetSyncDep dependency
- `backend/app/main.py` - DatasetSyncService initialization and startup reconciliation
- `backend/app/db/models/__init__.py` - Added RecvizDataset to model exports
- `backend/app/migrations/env.py` - Added RecvizDataset import for Alembic metadata
- `backend/tests/test_dataset_sync.py` - 10 tests for sync service and client extensions
- `backend/tests/test_managed_datasets.py` - 9 tests for CRUD endpoint operations

## Decisions Made
- **Python-side datetime defaults:** Added `default=_utcnow` on created_at/updated_at in addition to server_default, ensuring timestamps are populated immediately at Python object construction (needed for test mocks and in-memory responses before DB flush)
- **Superset API key asymmetry:** POST uses `"database"` key while PUT uses `"database_id"` key per Superset 4.x REST API behavior (documented in research)
- **recviz__ table_name prefix:** Virtual datasets use `recviz__{uuid}` naming in Superset for uniqueness and easy identification
- **Non-blocking sync:** Dataset save succeeds even if Superset sync fails, with sync_status tracking for retry

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added explicit constructor defaults for schema_version, created_at, updated_at**
- **Found during:** Task 2 (endpoint tests)
- **Issue:** SQLAlchemy `server_default` and `default` column options don't populate Python object attributes during mock-session tests (no actual INSERT happens)
- **Fix:** Set schema_version=1, created_at=now, updated_at=now explicitly in RecvizDataset constructor call within create_managed_dataset endpoint; added Python-side `default=_utcnow` to model columns
- **Files modified:** backend/app/api/managed_datasets.py, backend/app/db/models/dataset.py
- **Verification:** All 19 tests pass
- **Committed in:** fa5d175 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for test reliability and correct API responses. No scope creep.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| References check always returns empty | backend/app/api/managed_datasets.py | 201 | Phase 6 will add chart reference tracking; currently no charts exist to reference |
| Delete reference guard is no-op | backend/app/api/managed_datasets.py | 170 | Same as above -- 409 logic exists but referencing_charts is always [] |

These stubs are intentional per plan design and do not prevent Plan 01's goals from being achieved.

## Issues Encountered
- Pre-existing test failures in test_config_store.py and test_query_engine.py (ConfigStore constructor signature changed in a prior phase but tests not updated). Not caused by this plan's changes -- out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 6 CRUD endpoints ready for frontend consumption in Plan 02 (dataset list/detail pages)
- Pydantic models (DatasetCreate, DatasetUpdate, DatasetResponse, ColumnMetaSchema) define the frontend-backend contract
- DatasetSyncService pattern established for Plan 03 (SQL preview/validation)
- Migration 002 ready to run against PostgreSQL (`alembic upgrade head`)

---
*Phase: 05-dataset-management*
*Completed: 2026-04-06*
