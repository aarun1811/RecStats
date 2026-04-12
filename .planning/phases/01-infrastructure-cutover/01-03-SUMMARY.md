---
phase: 01-infrastructure-cutover
plan: 03
subsystem: database
tags: [alembic, oracle, migration, ddl, schema]

# Dependency graph
requires:
  - phase: 01-02
    provides: OracleJSON BLOB IS JSON type, Base with naming_convention, Oracle engine
provides:
  - Oracle-ready Alembic config (alembic.ini + env.py with thick mode)
  - Fresh 001_initial_oracle_schema.py migration creating all 6 recviz_* tables
affects: [01-06, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns: [BLOB IS JSON check constraints, SYSTIMESTAMP server defaults, CASCADE CONSTRAINTS downgrade]

key-files:
  created:
    - backend/app/migrations/versions/001_initial_oracle_schema.py
  modified:
    - backend/app/migrations/alembic.ini
    - backend/app/migrations/env.py

key-decisions:
  - "Manual migration authoring (autogenerate not attempted due to no live Oracle connection); hand-reviewed against 9-point checklist"
  - "SYSTIMESTAMP instead of func.now() for server_default in migration DDL -- Oracle-native timestamp"
  - "CASCADE CONSTRAINTS on every DROP TABLE in downgrade -- Oracle requires explicit cascade"

patterns-established:
  - "Migration DDL: sa.BLOB() + CheckConstraint IS JSON for all JSON columns"
  - "Migration DDL: sa.text('SYSTIMESTAMP') for all created_at/updated_at server_default"
  - "Migration DDL: CASCADE CONSTRAINTS in downgrade DROP TABLE statements"
  - "Migration header: DDL auto-commit warning + COMPATIBLE parameter deferred note"

requirements-completed: [INFRA-13, INFRA-14, INFRA-15]

# Metrics
duration: 3min
completed: 2026-04-12
---

# Phase 01 Plan 03: Alembic Oracle Migration Summary

**Oracle-ready Alembic stack: deleted 7 PG migrations, rewrote env.py with thick mode + recviz_alembic_version, created 001_initial_oracle_schema.py with BLOB IS JSON for all 6 recviz_* tables**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-12T09:57:27Z
- **Completed:** 2026-04-12T10:00:26Z
- **Tasks:** 2
- **Files modified:** 10 (7 deleted, 2 rewritten, 1 created)

## Accomplishments
- Deleted all 7 PostgreSQL-targeted Alembic migrations (001-007)
- Rewrote alembic.ini with empty sqlalchemy.url (env.py controls URL via Settings)
- Rewrote env.py with _ensure_thick_mode(), recviz_alembic_version, transaction_per_migration, compare_type
- Created fresh 001_initial_oracle_schema.py creating all 6 recviz_* tables with Oracle-appropriate types
- Migration passes full 9-point checklist (D-22)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite alembic.ini + env.py + delete 7 old migrations** - `009c7ae` (chore)
2. **Task 2: Generate and hand-review 001_initial_oracle_schema.py migration** - `9bf9a9c` (feat)

## Files Created/Modified
- `backend/app/migrations/alembic.ini` - Cleared sqlalchemy.url, no PG references
- `backend/app/migrations/env.py` - Oracle thick mode init, recviz_alembic_version, transaction_per_migration, compare_type/compare_server_default, small pool (2+0)
- `backend/app/migrations/versions/001_initial_oracle_schema.py` - Creates all 6 recviz_* tables with BLOB IS JSON, VARCHAR2(128) PKs, CLOB for text, SYSTIMESTAMP defaults
- `backend/app/migrations/versions/001_initial_schema.py` - **DELETED** (old PG migration)
- `backend/app/migrations/versions/002_add_datasets.py` - **DELETED**
- `backend/app/migrations/versions/003_add_charts.py` - **DELETED**
- `backend/app/migrations/versions/004_add_kpis.py` - **DELETED**
- `backend/app/migrations/versions/005_add_connections_portable_json.py` - **DELETED**
- `backend/app/migrations/versions/006_remove_dataset_superset_fields.py` - **DELETED**
- `backend/app/migrations/versions/007_dataset_database_id_to_string.py` - **DELETED**

## Decisions Made
- Wrote migration manually rather than autogenerating (no live Oracle connection available during execution); hand-reviewed against the full 9-point checklist
- Used `sa.text("SYSTIMESTAMP")` for server_default instead of `func.now()` -- SYSTIMESTAMP is Oracle-native and avoids any dialect translation ambiguity
- Used explicit `CASCADE CONSTRAINTS` on every DROP TABLE in downgrade since Oracle does not support cascading drops by default

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Alembic migration stack is Oracle-ready
- `alembic upgrade head` can be tested against a live Oracle instance in Plan 06
- All 6 recviz_* tables defined with Oracle-appropriate types
- env.py properly wires thick mode for standalone `alembic` CLI usage

## Self-Check: PASSED

- All 4 key files exist on disk
- Both task commits (009c7ae, 9bf9a9c) found in git log
- All 7 old PG migration files confirmed deleted

---
*Phase: 01-infrastructure-cutover*
*Completed: 2026-04-12*
