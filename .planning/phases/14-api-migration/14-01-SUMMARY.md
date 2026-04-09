---
phase: 14-api-migration
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, crud, encryption, connection-management, database-api]

# Dependency graph
requires:
  - phase: 12-02
    provides: "RecvizConnection ORM model with encrypted credentials"
  - phase: 12-03
    provides: "EngineManager async engine pool with dispose_engine and test_connection"
  - phase: 13-01
    provides: "ConnectionResolver with invalidate() and ConnectionStatusTracker with string keys"
provides:
  - "Database CRUD endpoints operating directly on recviz_connections table (no Superset proxy)"
  - "Encrypted password storage via EncryptionService on create/update"
  - "Engine disposal on connection update/delete via EngineManager"
  - "ConnectionResolver cache invalidation on all mutation endpoints"
  - "Updated Pydantic models with string UUIDs (DatabaseInfo.id: str, TestConnectionRequest.database_id: str)"
  - "Backend validation via Literal['oracle', 'postgresql'] on DatabaseCreate"
  - "13 comprehensive tests covering all CRUD endpoints and error cases"
affects: [14-02, 15-superset-removal, frontend-connection-management]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Direct SQLAlchemy CRUD replacing Superset HTTP proxy", "Fernet encryption integrated into CRUD create/update flow"]

key-files:
  created:
    - "backend/tests/test_databases_api.py"
  modified:
    - "backend/app/api/databases.py"
    - "backend/app/models/database.py"

key-decisions:
  - "DatabaseInfo.id changed from int to str -- frontend treats as opaque, transparent migration"
  - "DatabaseCreate.backend uses Literal type for validation instead of free-form string"
  - "sync endpoint preserved as no-op for API compatibility -- returns {success: true, dataset_count: 0}"
  - "list_database_datasets queries by database_id string match -- naturally returns empty until datasets migrated to UUID keys"

patterns-established:
  - "CRUD-to-ORM pattern: endpoints query recviz_connections directly via SQLAlchemy select/insert/update/delete"
  - "Mutation invalidation pattern: every create/update/delete invalidates ConnectionResolver cache + disposes engine"
  - "EncryptionDep pattern: get encryption service from request.app.state"

requirements-completed: [CONN-02]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 14 Plan 01: Database Connection CRUD Migration Summary

**All 7 database CRUD endpoints rewritten from Superset HTTP proxy to direct SQLAlchemy operations on recviz_connections with Fernet-encrypted credentials and engine lifecycle management**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T12:49:23Z
- **Completed:** 2026-04-09T12:52:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Rewrote all 7 database CRUD endpoints (list, get, create, update, delete, test, datasets) to operate directly on recviz_connections table via SQLAlchemy
- Removed all Superset proxy calls -- zero imports of SupersetClient, SupersetDep, or httpx remain in databases.py
- Passwords encrypted via EncryptionService (Fernet) on create/update, never exposed in any response
- Engine disposed via EngineManager on connection update/delete, ConnectionResolver cache invalidated on all mutations
- Updated Pydantic models: DatabaseInfo.id from int to str (UUID), TestConnectionRequest.database_id from int to str, DatabaseCreate.backend validated as Literal type
- 13 comprehensive tests covering all endpoints, 404/409 error cases, and no-Superset-import verification

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for database CRUD endpoints** - `780f7b6` (test)
2. **Task 1 (GREEN): Rewrite databases.py + update Pydantic models** - `d3e335e` (feat)

_Note: Task 1 was TDD with RED/GREEN commits. Task 2 (comprehensive tests) was fulfilled by the RED phase tests -- all 13 tests written and passing._

## Files Created/Modified
- `backend/app/api/databases.py` - Complete rewrite: 7 endpoints using RecvizConnection, EncryptionService, EngineManager, ConnectionResolver
- `backend/app/models/database.py` - Updated: id int->str, database_id int->str, backend Literal validation, removed sqlalchemy_uri field
- `backend/tests/test_databases_api.py` - New: 13 tests with mocked session, engine manager, encryption, and resolver

## Decisions Made
- DatabaseInfo.id changed from int to str to match connection UUID format -- frontend treats this field as opaque
- DatabaseCreate.backend validated as `Literal["oracle", "postgresql"]` per threat model T-14-03 (input validation)
- sync endpoint preserved as no-op returning `{success: true, dataset_count: 0}` for API compatibility
- list_database_datasets queries recviz_datasets by database_id string match -- returns empty until dataset migration updates the foreign key type
- Connection name auto-derived from display_name via lowercase + underscore (slug pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-14-01 | sanitize_detail() used in test_connection error handler to strip URIs from error messages |
| T-14-03 | DatabaseCreate.backend validated as Literal["oracle", "postgresql"] via Pydantic |
| T-14-04 | encrypted_password never included in any response dict -- only used in encrypt/write context |

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Database CRUD endpoints fully migrated -- no Superset dependency remains in databases.py
- Plan 14-02 (Dataset API migration) can proceed -- datasets endpoint already references RecvizDataset model
- Frontend connection management UI works unchanged -- response shapes preserved (camelCase via CamelModel)
- Phase 15 (Superset removal) can delete SupersetClient import from dependencies.py after all API routes migrated

## Self-Check: PASSED

All 3 files verified present. Both commit hashes verified in git log.

---
*Phase: 14-api-migration*
*Completed: 2026-04-09*
