---
phase: 06-dashboards-page
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, oracle, config-store, data-pipeline]

# Dependency graph
requires:
  - phase: 01-infrastructure-cutover
    provides: RecvizDataset + RecvizConnection ORM models, Oracle engine
  - phase: 03-datasets-page
    provides: Dataset CRUD pipeline populating recviz_datasets
provides:
  - ConfigStore reads from recviz_datasets + recviz_connections (not recviz_data_sources)
  - DataSourceConfig built from dataset fields with static routing to connection name
  - Dashboard data pipeline works for both seeded and user-created datasets
affects: [06-dashboards-page, 08-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns: [dataset-to-config builder pattern in ConfigStore]

key-files:
  created: []
  modified:
    - backend/app/services/config_store.py
    - frontend/src/components/dashboard/config-chart-grid.tsx

key-decisions:
  - "ConfigStore builds DataSourceConfig from RecvizDataset fields + RecvizConnection name lookup"
  - "Batch connection loading in list_data_sources to avoid N+1 queries"
  - "Graceful None return when connection lookup fails for orphaned datasets"
  - "filter_mappings defaults to empty list (dashboard config owns filter definitions)"

patterns-established:
  - "Dataset-to-config: ConfigStore._build_config converts ORM model to Pydantic config"
  - "Connection name routing: DatabaseRoutingMapping.database = connection.name for ConnectionResolver compatibility"

requirements-completed: [DASH-03, DASH-09]

# Metrics
duration: 2min
completed: 2026-04-13
---

# Phase 6 Plan 1: Dashboard Pipeline Fix Summary

**Rewired ConfigStore from Superset-era recviz_data_sources to recviz_datasets + recviz_connections, fixing 404s for user-created dashboard datasets**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-13T03:57:07Z
- **Completed:** 2026-04-13T03:58:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ConfigStore now reads from recviz_datasets + recviz_connections instead of the Superset-era recviz_data_sources table
- DataSourceConfig built from dataset fields (sql -> query, database_id -> connection name lookup, columns -> ColumnDef list)
- Both seeded and user-created dashboards resolve through the same pipeline
- Superset-era comment cleaned up in config-chart-grid.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire ConfigStore to read from recviz_datasets + recviz_connections** - `f77334c` (feat)
2. **Task 2: Verify API endpoints work with rewired ConfigStore** - `253bc78` (chore)

## Files Created/Modified
- `backend/app/services/config_store.py` - Rewired to read RecvizDataset + RecvizConnection, build DataSourceConfig from dataset fields
- `frontend/src/components/dashboard/config-chart-grid.tsx` - Updated Superset-era datasourceId comment

## Decisions Made
- ConfigStore._build_config extracts only name, type, label from dataset.columns JSON (ignores role, aggregation, format fields from the dataset editor)
- list_data_sources batch-loads all connections with a single IN query to avoid N+1
- Orphaned datasets (connection not found) are logged with a warning and skipped, not crashed
- filter_mappings set to empty list -- filter definitions are stored in dashboard config, not datasets

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dashboard data pipeline is fixed -- dashboards built from user-created datasets will no longer 404
- Ready for Plan 02 (dashboard list page polish) and subsequent renderer/builder plans
- recviz_data_sources table left intact per D-03 -- Phase 8 Alembic audit scope

## Self-Check: PASSED

- All created/modified files exist on disk
- All commit hashes found in git log
- No stubs or placeholders found in modified files
- No new threat surface introduced beyond plan's threat model

---
*Phase: 06-dashboards-page*
*Completed: 2026-04-13*
