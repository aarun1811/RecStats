---
phase: 13-query-execution
plan: 02
subsystem: database
tags: [sqlalchemy, text-execution, query-engine, async-engine, connection-resolver, pagination, timeout]

# Dependency graph
requires:
  - phase: 13-01
    provides: "ConnectionResolver, query_utils (build_result_response, wrap_with_pagination)"
  - phase: 12-03
    provides: "EngineManager async engine pool"
provides:
  - "QueryExecutor class executing dataset SQL directly via text() on async engines"
  - "QueryEngine backward-compat alias (QueryEngine = QueryExecutor)"
  - "ConnectionResolverDep for FastAPI dependency injection"
  - "FastAPI lifespan wiring: ConnectionResolver.sync() + QueryExecutor creation"
affects: [13-03, 14-connection-api, 15-superset-removal]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Direct text() execution via EngineManager pool replacing Superset HTTP proxy", "asyncio.wait_for timeout enforcement for dashboard queries", "Backward-compat alias for incremental migration"]

key-files:
  created: []
  modified:
    - "backend/app/services/query_engine.py"
    - "backend/app/core/dependencies.py"
    - "backend/app/main.py"
    - "backend/tests/test_query_engine.py"

key-decisions:
  - "QueryExecutor overwrites old QueryEngine in app.state.query_engine -- all endpoints use new path automatically"
  - "Old Superset client, DatabaseRegistrar, DatasetSyncService kept in lifespan (removed in Phase 14/15)"
  - "ConnectionResolver.sync() placed after databases.json migration and engine pre-warming"

patterns-established:
  - "QueryExecutor pattern: resolve DB name -> get connection UUID -> get engine -> text(sql) execution"
  - "Lifespan overwrite pattern: old service created first (for compatibility), new service overwrites reference"

requirements-completed: [QENG-02, QENG-03, DIAL-04]

# Metrics
duration: 5min
completed: 2026-04-09
---

# Phase 13 Plan 02: QueryExecutor Direct Execution Summary

**QueryExecutor replaces Superset HTTP proxy with direct text() SQL execution via EngineManager pool, preserving filter injection, date range clauses, and database routing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-09T12:18:16Z
- **Completed:** 2026-04-09T12:23:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Rewrote QueryEngine to QueryExecutor executing dataset SQL directly via text() on async engines from the pool
- Preserved all existing SQL template logic: _build_sql() filter injection, _build_date_range_clause(), _resolve_database() routing
- Wired QueryExecutor into FastAPI lifespan with ConnectionResolver.sync() -- all data source endpoints automatically use the new direct execution path
- 16 tests covering execute(), execute_distinct(), _build_sql(), _resolve_database(), pagination, status tracking, backward-compat alias

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for QueryExecutor** - `a31c2a4` (test)
2. **Task 1 (GREEN): QueryExecutor implementation** - `dfabd85` (feat)
3. **Task 2: Wire QueryExecutor into lifespan + dependencies** - `c54cedc` (feat)

_Note: Task 1 used TDD with RED/GREEN commits. No REFACTOR needed._

## Files Created/Modified
- `backend/app/services/query_engine.py` - QueryExecutor class with execute(), execute_distinct(), direct text() execution via EngineManager
- `backend/app/core/dependencies.py` - Added ConnectionResolverDep for route handler injection
- `backend/app/main.py` - Lifespan steps 9-10: ConnectionResolver.sync() + QueryExecutor creation overwriting old QueryEngine
- `backend/tests/test_query_engine.py` - 16 tests for QueryExecutor (rewritten from old Superset-era tests)

## Decisions Made
- QueryExecutor overwrites the old QueryEngine in app.state.query_engine -- no endpoint changes needed, all data source queries automatically use the new direct path
- Old Superset client, DatabaseRegistrar, DatasetSyncService remain in lifespan temporarily -- removed in Phase 14/15
- ConnectionResolver.sync() runs after databases.json migration (step 7) and engine pre-warming (step 8) to ensure connections are populated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed async context manager mocking in tests**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** AsyncMock for engine.connect() returns a coroutine, not an async context manager, causing TypeError
- **Fix:** Created _AsyncContextManager helper class for proper async context manager simulation in mocks
- **Files modified:** backend/tests/test_query_engine.py
- **Verification:** All 16 tests pass
- **Committed in:** dfabd85 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix in tests)
**Impact on plan:** Test mock pattern corrected for proper async context manager simulation. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- QueryExecutor ready for all dashboard data source queries via direct text() execution
- SQL Explorer rewrite (Plan 03) can use the same EngineManager + ConnectionResolver pattern
- query_utils.validate_read_only() ready for SQL Explorer to enforce read-only queries
- Phase 14 can safely remove Superset client, DatabaseRegistrar, and DatasetSyncService from lifespan

## Self-Check: PASSED

All 4 files verified present. All 3 commit hashes verified in git log.

---
*Phase: 13-query-execution*
*Completed: 2026-04-09*
