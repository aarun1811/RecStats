# Phase 14: API Migration - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase, autonomous mode)

<domain>
## Phase Boundary

All API endpoints serve data from the direct engine -- no Superset HTTP calls remain in any code path, dataset management operates purely on RecViz tables. This phase rewires databases.py CRUD to recviz_connections, removes DatasetSyncService, and drops superset_id/sync_status from datasets.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase (API endpoint rewiring). Use ROADMAP phase goal, success criteria, Phase 12/13 deliverables, and codebase conventions to guide decisions.

Key context from prior phases:
- Phase 12 built: RecvizConnection model, EngineManager, ConnectionResolver, EncryptionService
- Phase 13 built: QueryExecutor (direct text() execution), query_utils, SQL Explorer rewrite
- databases.py currently proxies all CRUD through SupersetClient — needs rewriting to use recviz_connections table directly
- DatasetSyncService syncs datasets to Superset — needs complete removal
- superset_id and sync_status columns on RecvizDataset — need Alembic migration to remove

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/engine_manager.py` — EngineManager with engine pool (Phase 12)
- `backend/app/services/connection_resolver.py` — ConnectionResolver maps names to UUIDs (Phase 13)
- `backend/app/db/models/connection.py` — RecvizConnection ORM model (Phase 12)
- `backend/app/services/encryption.py` — EncryptionService for credential handling (Phase 12)
- `backend/app/services/uri_builder.py` — build_async_uri for dialect URIs (Phase 12)

### Established Patterns
- Service layer: route handlers call services, services call DB/engines
- Dependency injection via FastAPI Depends (EngineManagerDep, ConnectionResolverDep, DbSessionDep)
- Managed entity CRUD pattern from managed_dashboards.py, managed_charts.py, managed_kpis.py

### Integration Points
- `backend/app/api/databases.py` — needs full rewrite from Superset proxy to recviz_connections CRUD
- `backend/app/api/managed_datasets.py` — needs DatasetSyncService removal
- `backend/app/db/models/dataset.py` — needs superset_id/sync_status column removal
- `backend/app/services/dataset_sync.py` — to be deleted entirely

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-api-migration*
*Context gathered: 2026-04-09 via autonomous mode*
