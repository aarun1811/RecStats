# Phase 12: Engine Foundation - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The infrastructure for direct database queries exists -- connections are stored securely in RecViz's own table, async engines are pooled per database, and all ORM models work on both PostgreSQL and Oracle. This phase does NOT touch API endpoints or remove Superset -- it builds the new foundation alongside the existing system.

</domain>

<decisions>
## Implementation Decisions

### Connection Storage
- **D-01:** New `recviz_connections` table stores all data source connection details. Schema: `id` (UUID PK), `name` (unique), `display_name`, `backend` (oracle/postgresql), `host`, `port`, `database_name`, `username`, `encrypted_password`, `schema_name`, `extra_params` (JSON), `status`, `last_tested_at`, `created_at`, `updated_at`.
- **D-02:** Auto-migrate `databases.json` entries into the table on first boot via a one-time startup migration. After migration, the JSON file is no longer read. `databases.prod.json` is dropped -- production connections configured via UI or the same migration path.
- **D-03:** Connection testing uses `SELECT 1` (PostgreSQL) or `SELECT 1 FROM DUAL` (Oracle) with a 10-second timeout via a disposable temporary engine.

### Credential Encryption
- **D-04:** Fernet symmetric encryption for passwords at rest. Key from `RECVIZ_ENCRYPTION_KEY` env var. Add to `.env.example` with a generated dev default.
- **D-05:** Passwords encrypted before DB write, decrypted at engine creation time. URI built from decrypted fields at runtime -- never stored as a full URI.

### Cross-Dialect Type Migration
- **D-06:** Single Alembic migration changes all JSONB columns across all 5 models (dashboards, charts, datasets, KPIs, data_sources) to portable `sa.JSON()`. On PostgreSQL this is functionally identical (JSON type). On Oracle this maps to CLOB with IS JSON constraint.
- **D-07:** Use `sa.JSON().with_variant(JSONB(), "postgresql")` so PostgreSQL still gets native JSONB performance while Oracle gets CLOB-based JSON. This is backwards-compatible -- no data loss, no application code changes needed.

### Async Engine Pool
- **D-08:** New `EngineManager` service: `dict[str, AsyncEngine]` keyed by connection UUID. Lazily creates engines on first query. Disposes engine on connection update/delete. Pre-warms all registered connections on startup.
- **D-09:** Pool settings per engine: `pool_size=5`, `max_overflow=10`, `pool_timeout=30`, `pool_recycle=1800`, `pool_pre_ping=True`. Conservative for single-tenant use (~12 users).
- **D-10:** PostgreSQL uses `postgresql+asyncpg://` dialect. Oracle uses `oracle+oracledb://` dialect (SQLAlchemy 2.0.25+ auto-selects async). Thin mode only for Oracle -- no Oracle Instant Client required.

### URI Builder
- **D-11:** Extend existing `uri_builder.py` to generate async dialect URIs from connection table fields. PostgreSQL: `postgresql+asyncpg://user:pass@host:port/dbname`. Oracle: `oracle+oracledb://user:pass@host:port/?service_name=SID`.

### Dev Experience
- **D-12:** No change to local dev workflow: `docker compose up` (PostgreSQL only) + `uvicorn`. Only new env var is `RECVIZ_ENCRYPTION_KEY` with a dev default in `.env.example`.
- **D-13:** Oracle not tested locally -- SQLAlchemy dialect abstraction + portable JSON type handles the gap. Oracle validated during RHEL deployment only.

### Claude's Discretion
- Exact Alembic migration structure (single file vs split per table)
- EngineManager internal error handling and logging
- Connection table column sizes and constraints
- Startup migration sequencing (migrate JSON before or after Alembic)
- Test structure for engine pool lifecycle

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Engine
- `backend/app/db/engine.py` -- Existing async engine setup (metadata DB). New EngineManager follows same pattern.
- `backend/app/db/base.py` -- SQLAlchemy Base class for ORM models
- `backend/app/core/dependencies.py` -- Dependency injection patterns (SupersetDep, DbSessionDep)

### ORM Models (all need JSONB migration)
- `backend/app/db/models/dashboard.py` -- RecvizDashboard with JSONB config column
- `backend/app/db/models/chart.py` -- RecvizChart with JSONB config column
- `backend/app/db/models/dataset.py` -- RecvizDataset with JSONB columns + superset_id
- `backend/app/db/models/kpi.py` -- RecvizKpi with JSONB config column
- `backend/app/db/models/data_source.py` -- RecvizDataSource with JSONB config column

### Connection Management
- `backend/app/config/databases.json` -- Current connection definitions (to be migrated)
- `backend/app/config/databases.prod.json` -- Production connection definitions
- `backend/app/models/database_config.py` -- Current DatabaseEntry Pydantic model
- `backend/app/services/uri_builder.py` -- Existing URI builder to extend
- `backend/app/services/connection_status.py` -- ConnectionStatusTracker (reusable)

### Configuration
- `backend/app/config.py` -- Settings class with superset_url, redis_url, etc.
- `backend/app/migrations/env.py` -- Alembic environment config

### Research
- `.planning/research/STACK.md` -- SQLAlchemy async Oracle patterns, python-oracledb 3.4.2
- `.planning/research/ARCHITECTURE.md` -- Dual engine strategy, DataSourceEnginePool design
- `.planning/research/PITFALLS.md` -- JSONB blocker, pool sizing, thin mode requirement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/db/engine.py`: Existing async engine creation pattern -- EngineManager follows the same `create_async_engine()` + `async_sessionmaker()` approach
- `backend/app/services/uri_builder.py`: Already builds SQLAlchemy URIs from form fields -- extend with async dialect prefixes
- `backend/app/services/connection_status.py`: In-memory status tracker -- reuse for engine pool health tracking
- `backend/app/core/dependencies.py`: Dependency injection patterns -- add `EngineManagerDep` following same pattern as `DbSessionDep`

### Established Patterns
- All ORM models inherit from `Base` (`backend/app/db/base.py`) with `mapped_column()` declarative style
- Alembic migrations use separate `recviz_alembic_version` table to avoid Superset conflicts
- Config via `pydantic_settings.BaseSettings` with `.env` file support
- Service layer pattern: services injected via `FastAPI.Depends()` in route handlers

### Integration Points
- `backend/app/main.py` lifespan: Where engine pool initialization and databases.json migration will run on startup
- `backend/app/core/dependencies.py`: Where `EngineManagerDep` will be added for route handler injection
- All 5 existing migrations in `backend/app/migrations/versions/`: New migration (005) adds connections table + migrates JSONB columns

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- user deferred all decisions to Claude's best judgment. Key user directive: "make the best decision everywhere."

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 12-engine-foundation*
*Context gathered: 2026-04-09*
