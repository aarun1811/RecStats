---
phase: 12-engine-foundation
plan: 01
subsystem: database
tags: [sqlalchemy, typedecorator, jsonb, oracle, postgresql, cross-dialect]

# Dependency graph
requires: []
provides:
  - "PortableJSON TypeDecorator (JSONB on PostgreSQL, CLOB on Oracle)"
  - "All 5 ORM models using PortableJSON instead of JSONB"
  - "models/__init__.py exporting all 5 model classes"
affects: [12-02, 12-03, 13-query-engine]

# Tech tracking
tech-stack:
  added: []
  patterns: ["TypeDecorator with load_dialect_impl for cross-dialect column types"]

key-files:
  created:
    - "backend/app/db/types.py"
    - "backend/tests/test_portable_json.py"
  modified:
    - "backend/app/db/models/dashboard.py"
    - "backend/app/db/models/chart.py"
    - "backend/app/db/models/dataset.py"
    - "backend/app/db/models/kpi.py"
    - "backend/app/db/models/data_source.py"
    - "backend/app/db/models/__init__.py"

key-decisions:
  - "TypeDecorator with load_dialect_impl chosen over sa.JSON().with_variant() because sa.JSON() does NOT compile on Oracle in SA 2.0.49"
  - "PortableJSON instantiated with () in mapped_column since TypeDecorator requires an instance"

patterns-established:
  - "Cross-dialect types via TypeDecorator: create in db/types.py, dispatch via load_dialect_impl"
  - "Oracle columns store JSON as Text/CLOB with Python-side json.dumps/json.loads"

requirements-completed: [DIAL-01]

# Metrics
duration: 2min
completed: 2026-04-09
---

# Phase 12 Plan 01: PortableJSON TypeDecorator Summary

**Cross-dialect PortableJSON TypeDecorator rendering JSONB on PostgreSQL and CLOB on Oracle, replacing all JSONB column types across 5 ORM models**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-09T11:05:53Z
- **Completed:** 2026-04-09T11:08:49Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created PortableJSON TypeDecorator that compiles to JSONB on PostgreSQL and CLOB on Oracle via load_dialect_impl dispatch
- Replaced all JSONB column types across 5 ORM models (dashboard, chart, dataset, kpi, data_source) with PortableJSON()
- Fixed models/__init__.py to export all 5 model classes (was missing RecvizChart and RecvizKpi)
- 9 comprehensive tests covering DDL compilation, bind param serialization, result value deserialization, and cache_ok flag

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for PortableJSON** - `e5067a1` (test)
2. **Task 1 (GREEN): Implement PortableJSON TypeDecorator** - `105fbe8` (feat)
3. **Task 2: Replace JSONB with PortableJSON in all 5 models** - `4fccb5c` (feat)

_Note: Task 1 was TDD with RED/GREEN commits. No REFACTOR needed._

## Files Created/Modified
- `backend/app/db/types.py` - PortableJSON TypeDecorator with load_dialect_impl, process_bind_param, process_result_value
- `backend/tests/test_portable_json.py` - 9 tests: DDL compilation (PG/Oracle), bind param, result value, cache_ok
- `backend/app/db/models/dashboard.py` - JSONB -> PortableJSON() for config column
- `backend/app/db/models/chart.py` - JSONB -> PortableJSON() for config column
- `backend/app/db/models/dataset.py` - JSONB -> PortableJSON() for columns column
- `backend/app/db/models/kpi.py` - JSONB -> PortableJSON() for config column
- `backend/app/db/models/data_source.py` - JSONB -> PortableJSON() for config column
- `backend/app/db/models/__init__.py` - Added RecvizChart and RecvizKpi exports

## Decisions Made
- TypeDecorator with load_dialect_impl chosen over sa.JSON().with_variant() because sa.JSON() does NOT compile on Oracle in SQLAlchemy 2.0.49 (no visit_JSON in Oracle dialect)
- PortableJSON instantiated with () in mapped_column calls since TypeDecorator requires an instance, not a class reference
- None value handling: returns None unchanged regardless of dialect (no serialization of None)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in test_config_store.py (ConfigStore constructor signature mismatch) -- not related to this plan's changes, confirmed by testing against pre-change state. Out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PortableJSON type ready for use in new models (Plan 02: RecvizConnection model)
- All existing models Oracle-compatible at the type level
- models/__init__.py properly exports all 5 classes for Alembic env.py autodiscovery
- Plan 03 (Alembic migration) can reference PortableJSON in migration scripts
