---
phase: 13-query-execution
plan: 03
subsystem: database
tags: [sqlalchemy, sql-explorer, read-only-enforcement, direct-execution, fastapi, text-sql]

# Dependency graph
requires:
  - phase: 13-01
    provides: "query_utils (validate_read_only, build_result_response, wrap_with_pagination)"
  - phase: 12-03
    provides: "EngineManager async engine pool"
provides:
  - "SQL Explorer endpoints executing directly via EngineManager (no Superset proxy)"
  - "Read-only SQL enforcement rejecting INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/MERGE"
  - "60-second timeout on SQL Explorer queries"
  - "Database list from recviz_connections table (string UUIDs, not int Superset IDs)"
affects: [14-connection-api, 15-superset-removal]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Direct text() execution for SQL Explorer via EngineManager pool", "Read-only enforcement at API layer before execution", "asyncio.wait_for timeout enforcement"]

key-files:
  created:
    - "backend/tests/test_sql_api.py"
  modified:
    - "backend/app/api/sql.py"

key-decisions:
  - "database_id changed from int to str -- frontend treats it as opaque, transparent migration"
  - "Read-only validation runs before DB lookup to fail fast on forbidden SQL"
  - "SQL Explorer uses 'data' key (not 'rows') in response to preserve frontend contract"

patterns-established:
  - "SQL Explorer direct execution: validate_read_only -> lookup connection -> wrap_with_pagination -> text() execute -> build_result_response"

requirements-completed: [QENG-04]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 13 Plan 03: SQL Explorer Direct Execution Summary

**SQL Explorer rewritten to execute directly via EngineManager with read-only enforcement rejecting 10 forbidden SQL statement types, 60s timeout, and database list from recviz_connections**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T12:25:04Z
- **Completed:** 2026-04-09T12:28:03Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Rewrote SQL Explorer to execute queries directly via EngineManager, eliminating all Superset/httpx dependencies
- Added read-only enforcement (QENG-04): INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, MERGE rejected before execution
- Database list endpoint reads from recviz_connections table with string UUIDs
- 15 tests covering all behaviors: success, 6 destructive SQL rejections, CTE allowed, history tracking, databases list, string database_id, timeout, database not found

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for SQL Explorer** - `187c503` (test)
2. **Task 1 (GREEN): SQL Explorer direct execution + read-only enforcement** - `74a41c2` (feat)

_Note: TDD task with RED/GREEN commits. No REFACTOR needed._

## Files Created/Modified
- `backend/app/api/sql.py` - Complete rewrite: direct engine execution, read-only enforcement, connection lookup from recviz_connections, 60s timeout, sanitized error messages
- `backend/tests/test_sql_api.py` - 15 tests using FastAPI TestClient with mocked EngineManager and DB session

## Decisions Made
- `database_id` changed from `int` (Superset ID) to `str` (connection UUID) -- frontend treats it as opaque, so this is transparent
- Read-only validation runs before DB connection lookup to fail fast on forbidden SQL (no wasted DB roundtrip)
- SQL Explorer response preserves `data` key (not `rows`) matching the existing frontend contract
- Error details truncated to 200 chars in history to prevent sensitive info leakage (T-13-10)

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three Phase 13 plans complete: query foundation services, QueryExecutor, and SQL Explorer
- Superset proxy fully bypassed for both dashboard queries (Plan 02) and SQL Explorer (Plan 03)
- Phase 14 can safely remove Superset client, DatabaseRegistrar, and DatasetSyncService from lifespan
- Phase 15 can remove Superset pip dependency entirely

## Self-Check: PASSED

All 2 files verified present. All 2 commit hashes verified in git log.

---
*Phase: 13-query-execution*
*Completed: 2026-04-09*
