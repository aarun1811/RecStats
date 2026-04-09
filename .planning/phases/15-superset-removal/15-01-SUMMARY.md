---
phase: 15-superset-removal
plan: 01
subsystem: infra
tags: [superset, redis, httpx, docker, cleanup, fastapi]

# Dependency graph
requires:
  - phase: 14-superset-cutover
    provides: Direct SQLAlchemy query engine (QueryExecutor) and connection management replacing Superset proxy
provides:
  - Complete removal of Superset code, config, and Docker service
  - Complete removal of Redis dependency
  - Complete removal of httpx HTTP proxy dependency
  - PostgreSQL-only Docker Compose for local dev
  - Clean FastAPI lifespan with direct database execution only
affects: [16-hive-es-removal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct database execution via SQLAlchemy EngineManager (no proxy layer)"
    - "PostgreSQL-only Docker infrastructure for local dev"

key-files:
  created: []
  modified:
    - backend/app/main.py
    - backend/app/config.py
    - backend/app/core/dependencies.py
    - backend/app/api/router.py
    - backend/app/models/error.py
    - backend/requirements.txt
    - backend/.env.example
    - docker-compose.yml
    - backend/tests/test_managed_kpis.py
    - backend/tests/test_managed_charts.py

key-decisions:
  - "Explicitly added cryptography to requirements.txt -- was implicit transitive dependency needed for EncryptionService"
  - "Cleaned .env of stale SUPERSET_*/REDIS_* vars -- pydantic-settings rejects extra inputs by default"
  - "Kept QueryEngine type alias in query_engine.py for backward compat with dependencies.py"

patterns-established:
  - "Settings class contains only RecViz-native fields: recon_db_url, recviz_db_url, recviz_encryption_key"
  - "Lifespan boots 5 steps: StatusTracker -> EncryptionService+EngineManager -> PreWarm -> ConnectionResolver -> QueryExecutor"

requirements-completed: [INFR-01, INFR-02, INFR-03, INFR-04, INFR-05]

# Metrics
duration: 7min
completed: 2026-04-09
---

# Phase 15 Plan 01: Superset Removal Summary

**Complete deletion of Superset, Redis, and httpx from codebase -- FastAPI runs with direct SQLAlchemy engine only, PostgreSQL-only Docker Compose**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-09T13:18:56Z
- **Completed:** 2026-04-09T13:25:57Z
- **Tasks:** 3
- **Files modified:** 10 modified, 12 deleted (+ superset/ directory)

## Accomplishments
- Deleted all Superset-related source files (superset_client.py, database_registrar.py, database_config.py, datasets proxy, databases.json configs, superset/ directory)
- Removed httpx, redis, and requests from requirements; simplified Docker Compose to PostgreSQL-only
- Cleaned main.py lifespan from 9 steps to 5, removed all Superset auth/sync/migration code, cleaned health endpoint
- All 198 existing tests pass with zero Superset dependencies

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete all Superset files and datasets proxy router** - `953dece` (chore)
2. **Task 2: Remove Redis/httpx/requests deps, simplify Docker Compose** - `e7b08b2` (chore)
3. **Task 3: Clean main.py lifespan, config, dependencies, test fixtures** - `d630b2a` (feat)

## Files Created/Modified

### Deleted (Task 1)
- `backend/app/services/superset_client.py` - Superset HTTP API client
- `backend/app/services/database_registrar.py` - Superset database registration
- `backend/app/models/database_config.py` - databases.json Pydantic model
- `backend/app/config/databases.json` - Database configuration file
- `backend/app/config/databases.prod.json` - Production database configuration
- `backend/app/api/datasets.py` - Superset proxy router for datasets
- `backend/tests/test_database_registrar.py` - DatabaseRegistrar tests
- `backend/tests/test_dataset_sync.py` - DatasetSyncService tests
- `superset/` - Entire directory (Dockerfile, configs, entrypoint)

### Modified (Tasks 2-3)
- `backend/requirements.txt` - Removed httpx, redis, requests; added cryptography explicitly
- `docker-compose.yml` - PostgreSQL-only (removed redis and superset services)
- `backend/.env.example` - Removed SUPERSET_* and REDIS_* variables
- `backend/app/main.py` - Clean lifespan with 5 steps, no Superset/httpx references
- `backend/app/config.py` - Only recon_db_url, recviz_db_url, recviz_encryption_key
- `backend/app/core/dependencies.py` - Removed SupersetDep/SupersetClient
- `backend/app/api/router.py` - Removed datasets_router import and include
- `backend/app/models/error.py` - Updated docstring example
- `backend/tests/test_managed_kpis.py` - Removed superset_id, sync_status, DatasetSyncService from fixtures
- `backend/tests/test_managed_charts.py` - Removed superset_id, sync_status, DatasetSyncService from fixtures

## Decisions Made
- Explicitly added cryptography==44.0.3 to requirements.txt (was previously a transitive dependency, now the only encryption library in the stack)
- Cleaned backend/.env file of stale SUPERSET_*/REDIS_* variables (pydantic-settings v2 rejects extra inputs by default, causing import failure)
- Kept QueryEngine type alias in query_engine.py for backward compatibility with dependencies.py type annotations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cleaned .env file of stale Superset/Redis variables**
- **Found during:** Task 3 (app import verification)
- **Issue:** pydantic-settings rejected extra env vars (SUPERSET_URL, SUPERSET_USERNAME, SUPERSET_PASSWORD, REDIS_URL) still in .env file after Settings fields were removed
- **Fix:** Removed stale variables from backend/.env (gitignored file, not committed)
- **Files modified:** backend/.env (gitignored)
- **Verification:** `python -c "from app.main import app; print('import OK')"` succeeds
- **Committed in:** N/A (gitignored file)

**2. [Rule 2 - Missing Critical] Removed DatasetSyncService imports from test fixtures**
- **Found during:** Task 3 (test fixture cleanup)
- **Issue:** test_managed_kpis.py and test_managed_charts.py imported DatasetSyncService (deleted in Phase 14) and set test_app.state.dataset_sync; managed_datasets.py no longer references it
- **Fix:** Removed all DatasetSyncService imports and sync_service mock setup from both test files
- **Files modified:** backend/tests/test_managed_kpis.py, backend/tests/test_managed_charts.py
- **Verification:** All 198 tests pass
- **Committed in:** d630b2a (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- __pycache__ bytecode files contained stale references to deleted modules (superset_client, database_registrar, dataset_sync). Cleaned with `find backend/ -type d -name __pycache__ -exec rm -rf {} +`. Not a code issue, just stale cache.

## User Setup Required
None - no external service configuration required. Docker Compose still works with `docker compose up -d` (now PostgreSQL-only).

## Next Phase Readiness
- Codebase is fully clean of Superset/Redis/httpx references
- All 198 tests pass
- Application imports and boots cleanly
- Ready for Phase 16 (Hive/ES driver removal) if planned

---
*Phase: 15-superset-removal*
*Completed: 2026-04-09*
