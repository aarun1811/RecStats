---
phase: 13-query-execution
plan: 01
subsystem: database
tags: [sqlalchemy, oracle, postgresql, query-utils, connection-resolver, pagination, sql-validation]

# Dependency graph
requires:
  - phase: 12-02
    provides: "RecvizConnection ORM model with encrypted credentials"
  - phase: 12-03
    provides: "EngineManager async engine pool"
provides:
  - "ConnectionResolver class resolving logical DB names to UUID strings from recviz_connections"
  - "ConnectionStatusTracker with string-keyed status tracking (replacing int Superset IDs)"
  - "normalize_columns for Oracle UPPERCASE -> lowercase column name normalization"
  - "detect_column_type mapping DB-API type codes to RecViz types (string/number/date)"
  - "build_result_response producing Superset-compatible response shape"
  - "validate_read_only rejecting 10 forbidden SQL statement types"
  - "wrap_with_pagination for PostgreSQL LIMIT/OFFSET and Oracle OFFSET FETCH"
affects: [13-02, 13-03, 14-connection-api]

# Tech tracking
tech-stack:
  added: []
  patterns: ["NamedTuple cache for connection metadata (no secrets)", "Regex prefix matching for SQL safety validation", "Dialect-aware SQL wrapping for cross-DB pagination"]

key-files:
  created:
    - "backend/app/services/connection_resolver.py"
    - "backend/app/services/query_utils.py"
    - "backend/tests/test_connection_resolver.py"
    - "backend/tests/test_query_utils.py"
  modified:
    - "backend/app/services/connection_status.py"
    - "backend/tests/test_connection_status.py"

key-decisions:
  - "ConnectionInfo uses NamedTuple (not dataclass) for lightweight immutable cache entries"
  - "detect_column_type checks date patterns first to correctly classify TIMESTAMP WITH TIME ZONE"
  - "DB-API type code objects handled via vars() introspection to distinguish class-level __name__ overrides"

patterns-established:
  - "ConnectionResolver pattern: sync from DB, cache metadata, resolve by name -- replaces Superset-era DatabaseRegistrar"
  - "Query utility pattern: centralized result adaptation in query_utils.py -- both QueryExecutor and SQL Explorer will import from here"
  - "Read-only validation pattern: regex prefix check as defense in depth (DB user should also be read-only)"

requirements-completed: [QENG-05, QENG-06, DIAL-02]

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 13 Plan 01: Query Foundation Services Summary

**ConnectionResolver for name-to-UUID database lookup, shared query utilities with Oracle column normalization, type detection, SQL read-only validation, and dialect-aware pagination**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T12:12:16Z
- **Completed:** 2026-04-09T12:16:23Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created ConnectionResolver replacing Superset-era DatabaseRegistrar with direct DB lookup from recviz_connections table
- Migrated ConnectionStatusTracker from integer Superset IDs to string connection UUIDs
- Built comprehensive query utilities module: column normalization, type detection, result response builder, SQL safety validator, pagination wrapper
- 49 total tests across 3 test files (10 resolver + 33 query utils + 6 updated status tracker)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for ConnectionResolver** - `901f480` (test)
2. **Task 1 (GREEN): ConnectionResolver + string-keyed StatusTracker** - `17065c0` (feat)
3. **Task 2 (RED): Failing tests for query utilities** - `d4de877` (test)
4. **Task 2 (GREEN): Query utilities implementation** - `254aafd` (feat)

_Note: Both tasks used TDD with RED/GREEN commits. No REFACTOR needed._

## Files Created/Modified
- `backend/app/services/connection_resolver.py` - ConnectionResolver with sync, resolve, get_dialect, get_schema, get_all_schemas, invalidate
- `backend/app/services/query_utils.py` - normalize_columns, detect_column_type, build_result_response, validate_read_only, wrap_with_pagination
- `backend/app/services/connection_status.py` - Migrated from dict[int, dict] to dict[str, dict], all methods use connection_id: str
- `backend/tests/test_connection_resolver.py` - 10 tests covering all ConnectionResolver methods + string-keyed StatusTracker
- `backend/tests/test_query_utils.py` - 33 tests covering all 5 utility functions
- `backend/tests/test_connection_status.py` - Updated 6 existing tests to use string keys

## Decisions Made
- ConnectionInfo uses NamedTuple for lightweight immutable cache entries (id, backend, schema_name, dialect)
- detect_column_type checks date patterns before number patterns to correctly classify TIMESTAMP WITH TIME ZONE
- DB-API type code objects handled via vars() introspection -- when desc[1] is a class with a class-level __name__ override (common in DB-API), vars() distinguishes it from the default class.__name__

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DB-API type code class handling in build_result_response**
- **Found during:** Task 2 (query_utils GREEN phase)
- **Issue:** When cursor.description provides type codes as classes (not strings), getattr(cls, "__name__") returns the class name itself, not the overridden __name__ attribute
- **Fix:** Added isinstance(type_info, type) check with vars() introspection to correctly read class-level __name__ overrides
- **Files modified:** backend/app/services/query_utils.py
- **Verification:** test_type_code_object_handling passes
- **Committed in:** 254aafd (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Fix ensures correct type detection for real DB-API cursor descriptions. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ConnectionResolver ready for QueryExecutor (Plan 02) to resolve database names to UUIDs for engine lookup
- query_utils ready for both QueryExecutor and SQL Explorer rewrite (Plan 03) to build standardized response shapes
- validate_read_only ready for SQL Explorer to enforce read-only queries
- wrap_with_pagination ready for both PostgreSQL (dev) and Oracle (prod) pagination
- ConnectionStatusTracker string keys compatible with EngineManager's UUID-keyed engine pool

## Self-Check: PASSED

All 6 files verified present. All 4 commit hashes verified in git log.

---
*Phase: 13-query-execution*
*Completed: 2026-04-09*
