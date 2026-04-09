---
phase: 12-engine-foundation
plan: 03
subsystem: database
tags: [sqlalchemy, asyncengine, engine-pool, connection-testing, alembic, fastapi-di]

# Dependency graph
requires:
  - phase: 12-01
    provides: "PortableJSON TypeDecorator for cross-dialect JSON columns"
  - phase: 12-02
    provides: "RecvizConnection ORM model, EncryptionService, build_async_uri"
provides:
  - "EngineManager service with per-connection AsyncEngine pool and connection testing"
  - "Alembic migration 005 creating recviz_connections table"
  - "Alembic env.py importing all 6 ORM models"
  - "databases.json auto-migration to recviz_connections on startup"
  - "EngineManagerDep for FastAPI dependency injection"
  - "Engine pool pre-warming on startup and disposal on shutdown"
affects: [13-query-engine, 14-connection-api]

# Tech tracking
tech-stack:
  added: []
  patterns: ["AsyncEngine pool with double-checked locking via asyncio.Lock", "Disposable engine pattern for connection testing", "JSON config auto-migration to database on startup"]

key-files:
  created:
    - "backend/app/services/engine_manager.py"
    - "backend/app/migrations/versions/005_add_connections_portable_json.py"
    - "backend/tests/test_engine_manager.py"
  modified:
    - "backend/app/migrations/env.py"
    - "backend/app/core/dependencies.py"
    - "backend/app/main.py"

key-decisions:
  - "Disposable engine with pool_size=1, max_overflow=0 for connection testing -- avoids polluting the main engine cache"
  - "databases.json auto-migration is idempotent (skips existing names) -- safe to run on every startup"
  - "Migration 005 uses sa.Text() for extra_params (not JSONB) -- portable across PostgreSQL and Oracle"

patterns-established:
  - "Engine pool pattern: EngineManager caches one AsyncEngine per connection UUID, disposed on update/delete/shutdown"
  - "Connection test pattern: disposable engine with hardcoded health SQL per dialect"
  - "JSON-to-DB migration pattern: parse URI fields, encrypt passwords, insert with idempotency check"

requirements-completed: [QENG-01, CONN-03, DIAL-03]

# Metrics
duration: 5min
completed: 2026-04-09
---

# Phase 12 Plan 03: EngineManager, Migration 005 & FastAPI Wiring Summary

**EngineManager async engine pool with per-connection caching, connection testing, Alembic migration 005 for recviz_connections, and databases.json auto-migration on FastAPI startup**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-09T11:15:45Z
- **Completed:** 2026-04-09T11:20:23Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Created EngineManager service caching one AsyncEngine per connection UUID with double-checked locking and D-09 pool defaults
- Connection testing via disposable engines with dialect-aware health SQL (SELECT 1 for PG, SELECT 1 FROM DUAL for Oracle)
- Alembic migration 005 creates recviz_connections table; env.py now imports all 6 ORM models
- databases.json entries auto-migrated to recviz_connections on startup (idempotent, encrypts passwords via Fernet)
- Engine pool pre-warmed at startup and fully disposed on shutdown (no pool leaks)
- 8 comprehensive tests covering engine lifecycle, caching, disposal, connection testing, and URI building from RecvizConnection

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for EngineManager** - `d0d6547` (test)
2. **Task 1 (GREEN): EngineManager implementation** - `ad82de5` (feat)
3. **Task 2: Migration 005 + env.py model imports** - `a8ea304` (feat)
4. **Task 3: Wire EngineManager into FastAPI startup + DI** - `bb85cd6` (feat)

_Note: Task 1 was TDD with RED/GREEN commits. No REFACTOR needed._

## Files Created/Modified
- `backend/app/services/engine_manager.py` - EngineManager with get_engine, get_engine_for_connection, dispose_engine, dispose_all, test_connection
- `backend/app/migrations/versions/005_add_connections_portable_json.py` - Creates recviz_connections table with all D-01 columns, UniqueConstraint on name
- `backend/app/migrations/env.py` - Updated imports: all 6 models (added RecvizChart, RecvizConnection, RecvizKpi)
- `backend/app/core/dependencies.py` - Added get_engine_manager provider and EngineManagerDep type alias
- `backend/app/main.py` - Steps 6-8 in lifespan: EncryptionService + EngineManager init, databases.json auto-migration, engine pre-warming; dispose_all on shutdown
- `backend/tests/test_engine_manager.py` - 8 tests covering all EngineManager methods with mocked engines

## Decisions Made
- Disposable engine for connection testing uses pool_size=1, max_overflow=0 to avoid polluting the engine cache
- databases.json auto-migration is idempotent (checks by name before insert) -- safe for repeated startups
- Migration 005 uses sa.Text() for extra_params column instead of JSONB -- portable to Oracle without dialect-specific DDL
- Engine pre-warming logs warnings but does not fail startup if a connection is unreachable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Alembic `upgrade head` could not be verified at runtime because PostgreSQL Docker container is not running. Migration was verified structurally (correct revision chain 005->004, valid Python, importable). This is consistent with local dev environment state.
- Pre-existing test failures in test_config_store.py and test_query_engine.py (ConfigStore signature mismatch) and test_dataset_sync.py (assertion mismatch) -- all unrelated to this plan, documented in Plan 01 summary as out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 12 (Engine Foundation) is now complete: PortableJSON types, RecvizConnection model, EncryptionService, async URI builder, EngineManager, migration 005, and full FastAPI wiring
- Phase 13 (Query Engine) can use EngineManager to execute dataset SQL against registered connections
- Phase 14 (Connection API) can use EngineManagerDep for connection CRUD with test-before-save
- databases.json auto-migration ensures smooth transition from Superset-era config to database-managed connections

## Self-Check: PASSED

All 6 files verified present. All 4 commit hashes verified in git log.

---
*Phase: 12-engine-foundation*
*Completed: 2026-04-09*
