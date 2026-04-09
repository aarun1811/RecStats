# Phase 15: Superset Removal - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/deletion phase, autonomous mode)

<domain>
## Phase Boundary

Superset, Redis, and all associated code are completely removed from the project -- the system runs with only FastAPI + PostgreSQL (dev) or FastAPI + Oracle (prod). This is pure cleanup: delete files, remove dependencies, simplify Docker Compose.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure deletion/cleanup phase. Key targets:
- Delete superset_client.py, database_registrar.py, superset/ directory
- Remove httpx dependency from requirements.txt
- Remove Redis from docker-compose.yml and all config references
- Remove superset_url, superset_username, superset_password, redis_url from config.py
- Clean up main.py lifespan (remove Superset auth, registrar sync steps)
- Remove DatabaseRegistrar and SupersetDep from dependencies.py
- Verify app starts with only FastAPI + PostgreSQL

</decisions>

<code_context>
## Existing Code Insights

### Files to Delete
- `backend/app/services/superset_client.py`
- `backend/app/services/database_registrar.py`
- `backend/app/models/database_config.py`
- `backend/app/config/databases.json`
- `backend/app/config/databases.prod.json`
- `superset/` directory (entire)
- `backend/tests/test_database_registrar.py`
- `backend/tests/test_dataset_sync.py` (if still exists)

### Files to Modify
- `backend/app/config.py` — remove superset_url, superset_username, superset_password, redis_url
- `backend/app/main.py` — remove Superset lifespan steps
- `backend/app/core/dependencies.py` — remove SupersetDep, DatabaseRegistrarDep
- `backend/requirements.txt` — remove httpx, redis
- `docker/docker-compose.yml` or `docker-compose.yml` — remove Redis service
- `backend/tests/test_config_store.py` — remove Superset references if any

### Integration Points
- main.py lifespan is the central wiring point — most Superset refs live here

</code_context>

<specifics>
## Specific Ideas

No specific requirements — pure cleanup phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 15-superset-removal*
*Context gathered: 2026-04-09 via autonomous mode*
