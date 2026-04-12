---
phase: 01-infrastructure-cutover
plan: 02
subsystem: infra
tags: [oracle, oracledb, thick-mode, sqlalchemy, sync, engine-pool]

# Dependency graph
requires:
  - phase: 01-01
    provides: Oracle-only Settings with recviz_db_url, oracle_client_lib_dir, recviz_encryption_key
provides:
  - Sync Oracle engine with pool_size=5, max_overflow=5, pool_recycle=1800
  - main.py thick mode init with hard failure on missing ORACLE_CLIENT_LIB_DIR
  - Startup assertion querying v$session_connect_info refusing boot on thin mode
  - Oracle-only engine manager (zero PostgreSQL code paths)
  - Oracle-only URI builder (only oracle+oracledb dialect)
  - Sync views.py handlers (zero async def)
affects: [01-03, 01-04, 01-05, 01-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [init_oracle_client before any from-app imports, v$session_connect_info startup assertion, pool_recycle=1800 for Oracle connection cycling]

key-files:
  created: []
  modified:
    - backend/app/db/engine.py
    - backend/app/main.py
    - backend/app/services/engine_manager.py
    - backend/app/services/uri_builder.py
    - backend/app/api/views.py

key-decisions:
  - "os.environ.get for ORACLE_CLIENT_LIB_DIR instead of Settings -- must run before any app module import"
  - "Hard RuntimeError on missing ORACLE_CLIENT_LIB_DIR -- zero fallback to thin mode"
  - "v$session_connect_info assertion with GRANT hint in error message per review suggestion"
  - "pool_size=5 + max_overflow=5 = max 10 connections (down from pool_size=10)"
  - "pool_recycle=1800 added for Oracle connection cycling (30 min)"

patterns-established:
  - "init_oracle_client at module top-level before any from-app imports -- prevents transitive thin-mode lock"
  - "Startup assertion via v$session_connect_info -- fails fast if thick mode not active"
  - "All FastAPI route handlers as plain def (not async def) -- Starlette threadpool for Oracle sync"

requirements-completed: [INFRA-07, INFRA-10, INFRA-11, INFRA-12]

# Metrics
duration: 4min
completed: 2026-04-12
---

# Phase 01 Plan 02: Engine Layer + Thick Mode Enforcement Summary

**Oracle-only engine layer with pool_size=5, hard thick-mode init via ORACLE_CLIENT_LIB_DIR env var, v$session_connect_info startup assertion, and sync-only views handlers**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-12T09:50:16Z
- **Completed:** 2026-04-12T09:54:26Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Rewrote engine.py with Oracle-tuned pool sizing (5+5, pool_recycle=1800) consuming settings.recviz_db_url
- Rewrote main.py thick mode init: reads ORACLE_CLIENT_LIB_DIR from env, hard RuntimeError on missing, init_oracle_client called BEFORE any from-app imports (Gemini HIGH concern resolved)
- Added startup assertion querying v$session_connect_info inside lifespan, refusing boot if thin mode detected, with GRANT hint in error message
- Converted health endpoint to plain def returning {"status":"healthy","driver":"python-oracledb","mode":"thick"}
- Removed all PostgreSQL code paths from engine_manager.py (conditional branches, connect_args logic, comments)
- Rewrote uri_builder.py to Oracle-only, deleted build_sqlalchemy_uri function, removed PG/hive/elasticsearch dialects
- Converted 3 async def handlers in views.py to plain def (list_views, create_view, delete_view)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite engine.py + main.py for Oracle thick mode with hard failure** - `a5207eb` (feat)
2. **Task 2: Oracle-only engine_manager.py + uri_builder.py + sync views.py** - `bf2c0cc` (feat)

## Files Created/Modified
- `backend/app/db/engine.py` - Sync Oracle engine with pool_size=5, max_overflow=5, pool_recycle=1800
- `backend/app/main.py` - Thick mode init with hard failure, v$session_connect_info assertion, sync health endpoint
- `backend/app/services/engine_manager.py` - Oracle-only engine pool manager, no PG branches
- `backend/app/services/uri_builder.py` - Oracle-only URI builder (oracle+oracledb only)
- `backend/app/api/views.py` - 3 sync handlers (zero async def)

## Decisions Made
- Used `os.environ.get("ORACLE_CLIENT_LIB_DIR")` directly instead of `settings.oracle_client_lib_dir` because the thick mode init must happen before any app module import (including config.py which transitively imports from pydantic-settings). This is the key change addressing the Gemini HIGH concern about initialization order.
- Hard `RuntimeError` on missing `ORACLE_CLIENT_LIB_DIR` with no try/except fallback -- the old `logger.warning("falling back to thin mode")` is deleted permanently.
- `v$session_connect_info` assertion error includes `GRANT SELECT ON v_$session_connect_info TO recviz;` hint per code review suggestion, making the grant requirement discoverable.
- Reduced pool_size from 10 to 5 per INFRA-07 spec (total max 10 with max_overflow=5). Added pool_recycle=1800 for Oracle long-connection cycling.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

**Out-of-scope test file reference:** `backend/tests/test_uri_builder.py` imports `build_sqlalchemy_uri` which was deleted. This is an existing test file, and automated tests are out of scope for this milestone (CLAUDE.md rule 6). Logged to `deferred-items.md`.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- Engine layer fully Oracle-only, ready for Alembic migration generation (Plan 03)
- main.py thick mode init is the first executable code after stdlib imports -- safe for all downstream modules
- All 5 files in the backend runtime path (engine.py, main.py, engine_manager.py, uri_builder.py, views.py) are now Oracle-only with zero PG/async residue

## Self-Check: PASSED

- All 5 modified files exist on disk
- All 2 task commits verified in git log (a5207eb, bf2c0cc)
- SUMMARY.md created at expected path

---
*Phase: 01-infrastructure-cutover*
*Completed: 2026-04-12*
