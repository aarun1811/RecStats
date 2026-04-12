---
phase: 01-infrastructure-cutover
plan: 01
subsystem: infra
tags: [oracle, oracledb, sqlalchemy, pydantic-settings, blob-is-json, alembic]

# Dependency graph
requires: []
provides:
  - Oracle-only Settings class with recviz_db_url, oracle_client_lib_dir, recviz_encryption_key
  - Cleaned requirements.txt with no PG/async dependencies
  - OracleJSON TypeDecorator with BLOB IS JSON check constraint
  - PortableJSON backward-compat alias
  - DeclarativeBase with MetaData naming conventions for Alembic
affects: [01-02, 01-03, 01-04, 01-05, 01-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [OracleJSON BLOB IS JSON via SchemaType _set_table hook, MetaData naming_convention for deterministic constraint names]

key-files:
  created: []
  modified:
    - backend/app/config.py
    - backend/requirements.txt
    - backend/.env.example
    - backend/app/db/types.py
    - backend/app/db/base.py

key-decisions:
  - "Single recviz_db_url field with no default -- app fails fast if env not configured"
  - "oracle_client_lib_dir as separate config field for thick mode enforcement"
  - "PortableJSON = OracleJSON grace alias retained for backward compat through this milestone"
  - "BLOB IS JSON pattern chosen over CLOB for Oracle 19c JSON storage"

patterns-established:
  - "OracleJSON(TypeDecorator, SchemaType): BLOB impl with _set_table IS JSON constraint"
  - "MetaData naming_convention: ix/uq/ck/fk/pk patterns for Alembic deterministic names"
  - "No-default required config fields: app crashes on startup if env vars missing"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-08, INFRA-09, INFRA-16]

# Metrics
duration: 3min
completed: 2026-04-12
---

# Phase 01 Plan 01: Oracle-Only Config Foundation Summary

**Oracle-only config.py with 3 required fields, pruned requirements.txt (no PG/async), OracleJSON BLOB IS JSON type with SchemaType hook, and Base MetaData naming conventions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-12T09:20:16Z
- **Completed:** 2026-04-12T09:22:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Rewrote config.py to Oracle-only with 3 required fields (recviz_db_url, oracle_client_lib_dir, recviz_encryption_key) and zero PG/Superset/async references
- Pruned requirements.txt: removed psycopg2-binary, asyncpg, sqlalchemy[asyncio]; retained plain sqlalchemy + oracledb thick mode
- Rewrote .env.example with 4 documented env vars and Docker Oracle connection string
- Implemented OracleJSON(TypeDecorator, SchemaType) with BLOB impl and _set_table IS JSON check constraint
- Added PortableJSON = OracleJSON grace alias so all existing ORM model imports continue working
- Augmented Base with MetaData naming_convention for deterministic Alembic constraint names (ix/uq/ck/fk/pk)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite config.py + requirements.txt + .env.example** - `9bd78d6` (feat)
2. **Task 2: Rewrite types.py + augment base.py** - `04473f3` (feat)

## Files Created/Modified
- `backend/app/config.py` - Oracle-only Settings class with 3 required fields, no defaults
- `backend/requirements.txt` - Cleaned dependency list: no psycopg2, asyncpg, or sqlalchemy[asyncio]
- `backend/.env.example` - Four required env vars documented with Docker Oracle connection string
- `backend/app/db/types.py` - OracleJSON TypeDecorator with BLOB IS JSON pattern, PortableJSON alias
- `backend/app/db/base.py` - DeclarativeBase with MetaData naming convention dict

## Decisions Made
- Single `recviz_db_url` field with no default value -- app fails fast on startup if env not configured, preventing silent fallback to wrong database
- `oracle_client_lib_dir` as separate config field rather than relying on env-only detection, making thick mode path explicit and debuggable
- Retained `PortableJSON = OracleJSON` grace alias for backward compatibility -- all existing ORM model files (`connection.py`, `dashboard.py`, etc.) import `PortableJSON` and continue working without modification; Phase 8 removes this alias
- Chose BLOB over CLOB for Oracle 19c JSON storage -- BLOB IS JSON is the recommended pattern for 19c per Oracle documentation, and bytes encode/decode ensures proper handling

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- Config foundation ready for engine.py (Plan 02) to consume `settings.recviz_db_url` and `settings.oracle_client_lib_dir`
- OracleJSON type ready for Alembic migration generation (Plan 03/04)
- Base naming convention ensures Alembic autogenerate produces deterministic constraint names
- PortableJSON alias means ORM models do not need modification until Phase 8

## Self-Check: PASSED

- All 5 modified files exist on disk
- All 2 task commits verified in git log (9bd78d6, 04473f3)
- SUMMARY.md created at expected path

---
*Phase: 01-infrastructure-cutover*
*Completed: 2026-04-12*
