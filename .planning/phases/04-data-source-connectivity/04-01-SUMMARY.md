---
phase: 04-data-source-connectivity
plan: 01
subsystem: database
tags: [oracle, hive, oracledb, pyhive, sqlalchemy, connection-tracking, docker]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: FastAPI backend with Superset proxy, URI builder, database registrar
provides:
  - Oracle and Hive driver installation in Superset Docker image
  - cx_Oracle module aliasing for SQLAlchemy 1.4 compatibility
  - Corrected Oracle URI dialect (oracle:// not oracle+cx_oracle://)
  - In-memory connection status tracker with connected/unreachable/untested states
  - QueryEngine error propagation to status tracker (including HTTP 400 body inspection)
  - Database API endpoints returning real connection status
  - Production config template for Oracle and Hive databases
affects: [05-dataset-management, 08-dashboard-builder]

# Tech tracking
tech-stack:
  added: [oracledb, pyhive, thrift, libsasl2-dev]
  patterns: [connection-status-tracking, error-propagation-to-status, 400-body-inspection]

key-files:
  created:
    - backend/app/services/connection_status.py
    - backend/app/config/databases.prod.json
    - backend/tests/test_uri_builder.py
    - backend/tests/test_connection_status.py
  modified:
    - superset/Dockerfile
    - superset/superset_config.py
    - backend/app/services/uri_builder.py
    - backend/app/services/query_engine.py
    - backend/app/api/databases.py
    - backend/app/main.py
    - backend/app/models/database.py

key-decisions:
  - "oracle:// dialect (not oracle+cx_oracle:// or oracle+oracledb://) for SQLAlchemy 1.4 compat with oracledb module alias"
  - "In-memory status tracker resets on restart -- correct behavior since DB reachability is unknown until tested"
  - "QueryEngine inspects HTTP 400 response bodies for connection failure patterns (Oracle TNS errors, Hive Thrift errors)"

patterns-established:
  - "Connection status tracking: in-memory tracker passed to QueryEngine and API via app.state"
  - "Error propagation: _handle_connection_error helper centralizes mark_unreachable logic for both execute() and execute_distinct()"
  - "400 body inspection: _CONNECTION_FAILURE_PATTERNS tuple + _is_connection_failure() for detecting connection failures in non-5xx responses"

requirements-completed: [DATA-01, DATA-02, DATA-04]

# Metrics
duration: 4min
completed: 2026-04-05
---

# Phase 04 Plan 01: Data Source Connectivity Summary

**Oracle/Hive driver installation with cx_Oracle aliasing, corrected URI dialect, and in-memory connection status tracking with QueryEngine error propagation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-05T19:16:36Z
- **Completed:** 2026-04-05T19:21:31Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Superset Dockerfile now installs oracledb, pyhive, thrift drivers plus libsasl2-dev for Hive SASL support
- cx_Oracle module aliasing in superset_config.py with detailed comments explaining the version hack for SQLAlchemy 1.4
- Oracle URI generation corrected to oracle:// dialect (was oracle+cx_oracle://)
- ConnectionStatusTracker module tracks database health with connected/unreachable/untested states
- QueryEngine propagates connection errors to status tracker, including HTTP 400 body inspection for Oracle TNS and Hive Thrift errors
- Database API endpoints return real status and last_tested from tracker instead of hardcoded "connected"
- Production config template with Oracle and Hive database entries
- 12 unit tests (6 URI builder, 6 connection status) all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Install drivers, configure cx_Oracle aliasing, fix URI builder, create connection status tracker** - `5997f52` (test: TDD RED), `ec6724a` (feat: TDD GREEN)
2. **Task 2: Wire status tracker into API, QueryEngine error propagation, env-aware config** - `f1908f2` (feat)

## Files Created/Modified
- `superset/Dockerfile` - Added oracledb, pyhive, thrift drivers + libsasl2-dev
- `superset/superset_config.py` - cx_Oracle module aliasing with version hack documentation
- `backend/app/services/uri_builder.py` - Oracle dialect corrected to oracle://
- `backend/app/services/connection_status.py` - New: in-memory connection status tracker
- `backend/app/services/query_engine.py` - Error propagation with 400 body inspection, status_tracker param
- `backend/app/api/databases.py` - Real status from tracker in list/get/update/test endpoints
- `backend/app/main.py` - ConnectionStatusTracker creation and wiring
- `backend/app/models/database.py` - Added last_tested to DatabaseInfo, database_id to TestConnectionRequest
- `backend/app/config/databases.prod.json` - New: production config template
- `backend/tests/test_uri_builder.py` - New: 6 URI builder tests (oracle, hive, postgresql)
- `backend/tests/test_connection_status.py` - New: 6 connection status tracker tests

## Decisions Made
- Used oracle:// dialect (not oracle+cx_oracle:// or oracle+oracledb://) because SQLAlchemy 1.4 only supports the generic oracle:// backed by cx_Oracle, and we alias oracledb as cx_Oracle
- In-memory status tracker (not persistent) -- resets on restart, which is correct since we can't know DB reachability without testing
- QueryEngine inspects HTTP 400 response bodies for connection failure patterns because Superset sometimes returns 400 (not 5xx) for connection-level failures

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failures found in `tests/test_config_store.py` and `tests/test_query_engine.py::test_build_sql_with_filters` -- both caused by `ConfigStore.__init__()` signature change requiring a `session` argument. Not caused by Phase 04 changes. Logged to `deferred-items.md`.

## User Setup Required

None - no external service configuration required. Production config template (`databases.prod.json`) uses placeholder passwords ("CHANGE_ME") that must be replaced in deployed environments.

## Next Phase Readiness
- Connection status tracking infrastructure ready for frontend consumption (Plan 02: frontend status display)
- Production config template ready for deployment-time credential injection
- Driver installation will take effect on next Docker image build

## Self-Check: PASSED

All 11 files verified present. All 3 commits verified in git log.

---
*Phase: 04-data-source-connectivity*
*Completed: 2026-04-05*
