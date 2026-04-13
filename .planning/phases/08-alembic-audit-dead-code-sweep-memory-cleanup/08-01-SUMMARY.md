---
phase: 08-alembic-audit-dead-code-sweep-memory-cleanup
plan: 01
subsystem: infra
tags: [alembic, oracle, dead-code, oraclejson, cleanup]

# Dependency graph
requires:
  - phase: 01-infrastructure-cutover
    provides: OracleJSON type with PortableJSON grace alias, Alembic migration, Oracle-only backend
  - phase: 06-dashboards-page
    provides: ConfigStore rewired from recviz_data_sources to recviz_datasets + recviz_connections
provides:
  - PortableJSON alias fully removed from codebase (types.py + 6 ORM models)
  - 8 dead code files deleted (1 service, 6 backend tests, 1 frontend test)
  - Alembic migration verified clean against live Oracle (6 app tables)
  - v$parameter COMPATIBLE=23.6.0 documented
  - CLAUDE.md accurately reflects Docker Oracle local dev setup
  - Codebase docs (STRUCTURE.md, ARCHITECTURE.md) updated to OracleJSON
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OracleJSON imported directly in all ORM models (no alias layer)"

key-files:
  created: []
  modified:
    - backend/app/db/types.py
    - backend/app/db/models/kpi.py
    - backend/app/db/models/connection.py
    - backend/app/db/models/chart.py
    - backend/app/db/models/dashboard.py
    - backend/app/db/models/data_source.py
    - backend/app/db/models/dataset.py
    - CLAUDE.md
    - .planning/codebase/STRUCTURE.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/USAGE-TRACKER.md

key-decisions:
  - "All 9 requirements.txt deps verified imported -- no pruning needed"
  - "v$parameter COMPATIBLE=23.6.0 on Docker Oracle 23ai Free -- supports 128-byte identifiers (same as Citi prod 19.0.0 with COMPATIBLE >= 12.2.0)"
  - "CLAUDE.md rule #4 now says 'No Docker for the application' (Docker is used for Oracle DB server locally)"

patterns-established:
  - "OracleJSON direct import: all ORM models use `from app.db.types import OracleJSON`"

requirements-completed: [FINAL-01, FINAL-02, FINAL-03, FINAL-04, FINAL-05, FINAL-06]

# Metrics
duration: 7min
completed: 2026-04-13
---

# Phase 8 Plan 1: Backend Cleanup Summary

**PortableJSON alias removed, 8 dead code files deleted, Alembic audit clean against live Oracle, CLAUDE.md drift fixed to reflect Docker Oracle local dev**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-13T05:39:56Z
- **Completed:** 2026-04-13T05:47:23Z
- **Tasks:** 3
- **Files modified:** 11 modified, 8 deleted

## Accomplishments

- Removed PortableJSON grace alias from types.py and updated all 6 ORM models to import OracleJSON directly
- Verified Alembic migration 001 against live Oracle: 6 app tables, no extraneous objects, COMPATIBLE=23.6.0
- Deleted 8 dead code files: config_migrator.py (zero imports), 6 async-mocked backend test files, 1 frontend test file
- Confirmed all 9 requirements.txt dependencies are actually imported (no pruning needed)
- Fixed CLAUDE.md drift: local dev now documents Docker Oracle (gvenzl/oracle-free), seed/migration commands, and rule #4 clarification
- Updated STRUCTURE.md and ARCHITECTURE.md to replace all PortableJSON references with OracleJSON

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Alembic audit + PortableJSON removal + dead code sweep** - `a9b3f5f` (chore)
2. **Task 3: CLAUDE.md drift fix + codebase docs update** - `2557fd1` (docs)

## Files Created/Modified

### Modified
- `backend/app/db/types.py` - Removed PortableJSON = OracleJSON alias (lines 49-50)
- `backend/app/db/models/kpi.py` - PortableJSON -> OracleJSON import and usage
- `backend/app/db/models/connection.py` - PortableJSON -> OracleJSON import and usage
- `backend/app/db/models/chart.py` - PortableJSON -> OracleJSON import and usage
- `backend/app/db/models/dashboard.py` - PortableJSON -> OracleJSON import and usage
- `backend/app/db/models/data_source.py` - PortableJSON -> OracleJSON import and usage
- `backend/app/db/models/dataset.py` - PortableJSON -> OracleJSON import and usage
- `CLAUDE.md` - Fixed local dev section drift (Docker Oracle, rule #4, seed/migration commands)
- `.planning/codebase/STRUCTURE.md` - PortableJSON -> OracleJSON, removed config_migrator.py reference
- `.planning/codebase/ARCHITECTURE.md` - PortableJSON -> OracleJSON, fixed PostgreSQL -> Oracle references
- `.planning/USAGE-TRACKER.md` - Phase 8 audit results and dead code resolution

### Deleted
- `backend/app/services/config_migrator.py` - Not imported anywhere, zero registered migrations
- `backend/tests/test_connection_model.py` - Async-mocked, stale
- `backend/tests/test_portable_json.py` - Tests the removed PortableJSON alias
- `backend/tests/test_query_utils.py` - Async-mocked, stale
- `backend/tests/test_schema_introspection.py` - Async-mocked, stale
- `backend/tests/test_test_connection_by_id.py` - Async-mocked, stale
- `backend/tests/test_uri_builder.py` - Async-mocked, stale
- `frontend/src/components/explorer/schema-browser.test.tsx` - Test file, tests deferred this milestone

## Decisions Made

- **No requirements.txt changes needed:** All 9 dependencies (fastapi, uvicorn, pydantic, pydantic-settings, python-dotenv, sqlalchemy, alembic, oracledb, cryptography) are actually imported in backend/app/
- **COMPATIBLE value documented:** Docker Oracle 23ai Free reports 23.6.0. Citi prod expected 19.0.0. Both support 128-byte identifiers since COMPATIBLE >= 12.2.0
- **Task 1 had no file changes:** Alembic audit was verification-only; findings documented in USAGE-TRACKER (committed with Task 2)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated STRUCTURE.md to remove config_migrator.py and chart-builder-dialog.tsx references**
- **Found during:** Task 3 (codebase docs update)
- **Issue:** STRUCTURE.md still listed config_migrator.py in the services directory tree and chart-builder-dialog.tsx in explorer components (both deleted in prior phases)
- **Fix:** Removed the stale file references from the directory listing
- **Files modified:** .planning/codebase/STRUCTURE.md
- **Verification:** grep confirms no config_migrator reference remains
- **Committed in:** 2557fd1 (Task 3 commit)

**2. [Rule 2 - Missing Critical] Updated ARCHITECTURE.md PostgreSQL -> Oracle references**
- **Found during:** Task 3 (codebase docs update)
- **Issue:** ARCHITECTURE.md Database Layer still said "PostgreSQL metadata database" and "Depends on: PostgreSQL (via psycopg2)" despite Oracle-only cutover in Phase 1
- **Fix:** Updated to "Oracle metadata database" and "Depends on: Oracle 19c (via oracledb in thick mode, sync SQLAlchemy)"
- **Files modified:** .planning/codebase/ARCHITECTURE.md
- **Verification:** No PostgreSQL dependency references remain in the Database Layer section
- **Committed in:** 2557fd1 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical documentation accuracy)
**Impact on plan:** Documentation accuracy improvements. No scope creep.

## Issues Encountered

- Alembic migration required environment variables (RECVIZ_DB_URL, ORACLE_CLIENT_LIB_DIR, RECVIZ_ENCRYPTION_KEY) not present in worktree -- sourced from main repo's .env file
- Frontend node_modules not present in worktree -- ran pnpm install --frozen-lockfile for tsc --noEmit check

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend is clean: no dead code, no stale aliases, accurate documentation
- Ready for Phase 8 Plan 2 (memory cleanup) and Plan 3 (smoke test)

## Self-Check: PASSED

- All 11 modified files exist on disk
- All 8 deleted files confirmed absent
- Both task commits (a9b3f5f, 2557fd1) found in git log
- SUMMARY.md exists at expected path

---
*Phase: 08-alembic-audit-dead-code-sweep-memory-cleanup*
*Completed: 2026-04-13*
