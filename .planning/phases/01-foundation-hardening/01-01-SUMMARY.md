---
phase: 01-foundation-hardening
plan: 01
subsystem: database
tags: [sqlalchemy, asyncpg, alembic, postgresql, jsonb, async, pydantic]

# Dependency graph
requires: []
provides:
  - "Async SQLAlchemy engine and session factory for PostgreSQL"
  - "RecvizDashboard and RecvizDataSource JSONB-backed models with schema_version"
  - "Alembic async migration infrastructure with initial migration"
  - "Config schema migration pipeline (migrate_config)"
  - "DB-backed async ConfigStore replacing JSON file reader"
  - "ResolvedDataSourceDep helper dependency for data source lookup+404"
  - "PostgreSQL seed script with column validation"
affects: [01-02, 01-03, 02-cross-filtering, 03-drill-down, 05-dataset-management]

# Tech tracking
tech-stack:
  added: [sqlalchemy-asyncio-2.0.49, asyncpg-0.31.0, alembic-1.18.4]
  patterns: [async-session-per-request, jsonb-config-storage, schema-versioning-pipeline]

key-files:
  created:
    - backend/app/db/engine.py
    - backend/app/db/base.py
    - backend/app/db/models/dashboard.py
    - backend/app/db/models/data_source.py
    - backend/app/services/config_migrator.py
    - backend/app/migrations/versions/001_initial_schema.py
    - backend/app/migrations/env.py
    - scripts/seed-postgres.py
  modified:
    - backend/app/services/config_store.py
    - backend/app/core/dependencies.py
    - backend/app/main.py
    - backend/app/services/query_engine.py
    - backend/app/api/dashboards.py
    - backend/app/api/data_sources.py
    - backend/app/config.py
    - backend/app/config/databases.json
    - backend/requirements.txt

key-decisions:
  - "QueryEngine accepts DataSourceConfig directly (Option B) instead of managing its own DB sessions"
  - "ResolvedDataSourceDep added to eliminate repeated lookup+404 patterns across endpoints"
  - "Merge endpoint uses ConfigStoreDep directly since it resolves multiple data sources from body"

patterns-established:
  - "Async session per request: get_db_session yields session with auto commit/rollback"
  - "JSONB config storage: full config JSON stored in JSONB column, validated through Pydantic on load"
  - "Schema migration pipeline: migrate_config runs on every config load, version field tracks schema"
  - "ResolvedDataSourceDep pattern: dependency resolves entity by path param with 404 handling"

requirements-completed: [INFR-01, INFR-02]

# Metrics
duration: 17min
completed: 2026-04-04
---

# Phase 01 Plan 01: Database Persistence Layer Summary

**Async SQLAlchemy + Alembic database layer with JSONB config models, replacing JSON-file ConfigStore with PostgreSQL-backed async service**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-04T18:08:48Z
- **Completed:** 2026-04-04T18:26:23Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments

- Built async SQLAlchemy engine with RecvizDashboard and RecvizDataSource models storing configs as JSONB with schema_version fields
- Set up Alembic async migration infrastructure with initial migration creating both recviz_ tables
- Replaced sync JSON-file ConfigStore with async DB-backed implementation using per-request session injection
- Updated all API endpoints (dashboards, data_sources) to use async ConfigStore calls and direct DataSourceConfig passing to QueryEngine
- Migrated databases.json from SQLite URIs to PostgreSQL, removed SQLite seed artifacts
- Created comprehensive seed-postgres.py with SQL template column validation and ID preservation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQLAlchemy async database layer with models and Alembic migrations** - `7434bde` (feat)
2. **Task 2: Replace ConfigStore with DB-backed implementation and update app lifecycle** - `16dc7e5` (feat)

## Files Created/Modified

- `backend/app/db/engine.py` - Async SQLAlchemy engine and session factory
- `backend/app/db/base.py` - DeclarativeBase for all models
- `backend/app/db/models/dashboard.py` - RecvizDashboard model with JSONB config
- `backend/app/db/models/data_source.py` - RecvizDataSource model with JSONB config
- `backend/app/db/models/__init__.py` - Model re-exports for Alembic discovery
- `backend/app/services/config_migrator.py` - Schema version migration pipeline
- `backend/app/services/config_store.py` - Rewritten: async DB-backed ConfigStore
- `backend/app/services/query_engine.py` - Updated: accepts DataSourceConfig directly
- `backend/app/core/dependencies.py` - Rewritten: DB session DI + ResolvedDataSourceDep
- `backend/app/main.py` - Updated: removed ConfigStore singleton, added engine disposal
- `backend/app/api/dashboards.py` - Updated: async ConfigStore calls
- `backend/app/api/data_sources.py` - Updated: uses ResolvedDataSourceDep
- `backend/app/config.py` - Added recviz_db_url setting
- `backend/app/config/databases.json` - Migrated SQLite to PostgreSQL URIs
- `backend/requirements.txt` - Added sqlalchemy[asyncio], asyncpg, alembic
- `backend/app/migrations/alembic.ini` - Alembic config for async PostgreSQL
- `backend/app/migrations/env.py` - Async migration runner
- `backend/app/migrations/script.py.mako` - Alembic migration template
- `backend/app/migrations/versions/001_initial_schema.py` - Initial table creation
- `scripts/seed-postgres.py` - PostgreSQL seed with column validation

## Decisions Made

- **QueryEngine Option B:** QueryEngine accepts DataSourceConfig directly instead of looking up data sources internally. Simpler than Option A (giving QueryEngine a session factory) and avoids QueryEngine managing DB sessions.
- **ResolvedDataSourceDep:** Created helper dependency to eliminate repeated data source lookup + 404 logic across 3 endpoints. Merge endpoint uses ConfigStoreDep since it resolves multiple sources from body.
- **Merge endpoint kept ConfigStoreDep:** The merge endpoint receives a list of source IDs in the request body, not a single path param, so ResolvedDataSourceDep cannot be used there.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- SQLAlchemy, asyncpg, and alembic packages were not yet installed. Resolved by running pip install before verification (expected for new dependencies).

## Known Stubs

None - all code paths are fully wired to PostgreSQL.

## User Setup Required

None - no external service configuration required. Docker Compose already provisions PostgreSQL.

## Next Phase Readiness

- Database persistence layer fully operational for Plans 02 and 03
- ConfigStore is async and session-scoped, ready for any future model additions
- Schema migration pipeline ready for future config schema changes
- Seed script can populate development PostgreSQL once Docker Compose is running

## Self-Check: PASSED

All 8 created files verified present. Both task commits (7434bde, 16dc7e5) verified in git log.

---
*Phase: 01-foundation-hardening*
*Completed: 2026-04-04*
