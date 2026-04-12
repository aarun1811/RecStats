---
phase: 01-infrastructure-cutover
plan: 05
subsystem: infra
tags: [oracle, oracledb, cleanup, seed-data, grep-audit]

# Dependency graph
requires:
  - phase: 01-infrastructure-cutover (01-01)
    provides: OracleJSON BLOB IS JSON type, Oracle-native ORM models
provides:
  - Oracle seed script with 2 connections, 3 datasets, 3 charts, 2 KPIs, 1 dashboard, 1 data source
  - Zero PG/Superset/Redis references in code/config files (outside legacy migrations)
  - Clean CLAUDE.md verified for milestone
affects: [01-03-alembic-migration, 02-settings, 03-datasets, 04-charts, 05-kpis, 06-dashboards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Oracle seed script uses oracledb directly with named bind variables and BLOB IS JSON"
    - "DatabaseBackend type narrowed to 'oracle' only throughout frontend and backend"

key-files:
  created:
    - scripts/seed-oracle.py
  modified:
    - backend/app/services/uri_builder.py
    - backend/app/services/engine_manager.py
    - backend/app/services/query_utils.py
    - backend/app/api/databases.py
    - backend/app/models/database.py
    - frontend/src/types/database.ts
    - frontend/src/components/settings/data-source-sheet.tsx
    - frontend/src/components/settings/data-source-card.tsx

key-decisions:
  - "Legacy migration files (002, 006, 007) left untouched -- plan 01-03 will nuke and regenerate all migrations"
  - "seed/ directory deleted alongside scripts/ residue (3 additional PG seed files found via grep)"

patterns-established:
  - "DatabaseBackend = 'oracle' only -- no multi-backend support in this codebase"
  - "Seed script uses DELETE+INSERT idempotency, not MERGE INTO, for dev simplicity"

requirements-completed: [INFRA-17, INFRA-24, INFRA-25]

# Metrics
duration: 16min
completed: 2026-04-12
---

# Phase 01 Plan 05: Residue Cleanup + Oracle Seed Summary

**Deleted all PG/Docker/Superset residue (40+ files), created Oracle seed script with rich data for Phase 2+, repo-wide grep audit passes zero hits**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-12T09:31:13Z
- **Completed:** 2026-04-12T09:47:17Z
- **Tasks:** 2
- **Files modified:** 50 (23 deleted + 27 modified)

## Accomplishments
- Deleted docker-compose.yml, docker/, deployment/, docs/ (16 stale Superset-era docs), seed/ (3 PG seed scripts), and 4 scripts (setup-superset-local.sh, generate-seed-db.py, mock-audit.sh, seed-postgres.py)
- Created scripts/seed-oracle.py with rich data: 2 connections, 3 datasets, 3 charts, 2 KPIs, 1 dashboard with layout referencing all charts/KPIs, 1 data source -- enough for Phase 2-7 verification
- Repo-wide grep audit: removed all postgresql/JSONB/asyncpg/psycopg2/superset/redis/celery references from code and config files; narrowed DatabaseBackend to oracle-only in both frontend and backend
- CLAUDE.md verified clean -- only "No X" prohibition rules remain

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete residue files/dirs + rewrite seed script** - `843b5d3` (feat)
2. **Task 2: Repo-wide grep audit + CLAUDE.md verification** - `f8c0cfa` (chore)

## Files Created/Modified

**Deleted (Task 1):**
- `docker-compose.yml` -- PG container definition
- `docker/init-db.sql` -- PG init script
- `deployment/` -- empty dir
- `docs/` -- 16 stale Superset-era docs + subdirs
- `scripts/setup-superset-local.sh`, `scripts/generate-seed-db.py`, `scripts/mock-audit.sh`, `scripts/seed-postgres.py`

**Created (Task 1):**
- `scripts/seed-oracle.py` -- Oracle seed script with oracledb, BLOB IS JSON, named bind variables

**Deleted (Task 2):**
- `seed/create_recon_db.py`, `seed/register_superset.py`, `seed/register_test_datasets.py`

**Modified (Task 2):**
- `backend/app/services/uri_builder.py` -- Removed PG backend, PG sync dialect
- `backend/app/services/engine_manager.py` -- Removed PG health check, PG connect_args
- `backend/app/services/query_utils.py` -- Removed PG OID map references, PG pagination
- `backend/app/services/query_engine.py` -- Removed psycopg2 comment reference
- `backend/app/services/connection_resolver.py` -- Removed PG dialect comment
- `backend/app/services/config_store.py` -- Changed JSONB to JSON in comment
- `backend/app/api/databases.py` -- Removed PG schema introspection branches
- `backend/app/api/sql.py` -- Removed psycopg2 comment reference
- `backend/app/models/database.py` -- Narrowed Literal to "oracle" only
- `backend/app/db/models/connection.py` -- Updated backend comment
- `backend/app/migrations/alembic.ini` -- Fixed URL to Oracle
- `backend/tests/test_uri_builder.py` -- Removed PG tests
- `backend/tests/test_connection_model.py` -- Removed PG DDL tests
- `backend/tests/test_portable_json.py` -- Rewrote for OracleJSON BLOB
- `backend/tests/test_query_utils.py` -- Removed PG pagination tests
- `backend/tests/test_schema_introspection.py` -- Removed PG introspection tests
- `backend/tests/test_test_connection_by_id.py` -- Changed test backend to oracle
- `frontend/src/types/database.ts` -- Narrowed DatabaseBackend to 'oracle'
- `frontend/src/components/settings/data-source-card.tsx` -- Oracle-only labels/colors
- `frontend/src/components/settings/data-source-sheet.tsx` -- Oracle-only backend fields, selector, defaults
- `frontend/src/components/datasets/dataset-row.tsx` -- Default backend oracle
- `frontend/src/components/datasets/dataset-card.tsx` -- Default backend oracle
- `frontend/src/components/explorer/schema-browser.test.tsx` -- Changed mock to oracle
- `frontend/src/hooks/use-dashboard-kpis.ts` -- JSONB to JSON in comment

## Decisions Made
- Legacy Alembic migration files (002, 006, 007) containing postgresql_using and superset_id references left untouched because plan 01-03 will nuke and regenerate all migrations as a single Oracle-native initial migration
- Discovered and deleted seed/ directory (3 old PG seed scripts) that was not listed in the plan but found during grep audit (Deviation Rule 1)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deleted seed/ directory found during grep audit**
- **Found during:** Task 2 (Repo-wide grep audit)
- **Issue:** seed/ directory with 3 PG seed scripts (create_recon_db.py, register_superset.py, register_test_datasets.py) not listed in plan's delete targets but contained postgresql/psycopg2/superset references
- **Fix:** Deleted via git rm -r seed/
- **Files modified:** seed/create_recon_db.py, seed/register_superset.py, seed/register_test_datasets.py
- **Verification:** Grep audit returns 0 hits after deletion
- **Committed in:** f8c0cfa (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - additional files found during audit)
**Impact on plan:** Essential for the grep audit to pass zero hits. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All PG/Docker/Superset residue is removed from code and config files
- Oracle seed script ready for use once Oracle Cloud is provisioned and tables are created (plan 01-03)
- Remaining migration file references (plan 01-03 scope) are the only known grep hits
- CLAUDE.md is clean and ready for all subsequent phases

---
*Phase: 01-infrastructure-cutover*
*Completed: 2026-04-12*
