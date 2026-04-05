# Phase 4: Data Source Connectivity - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate Oracle and Hive databases via Superset with a connection management UI for the dev team to add, edit, and test connections. Install production database drivers (python-oracledb, pyhive) in the Superset Docker image. Upgrade the existing data sources management UI with dynamic backend-specific forms, connection health status tracking, and test-before-save enforcement.

**Scope reduction:** Elasticsearch integration (DATA-03) is deferred to a future phase. This phase covers DATA-01, DATA-02, and DATA-04 only.

</domain>

<decisions>
## Implementation Decisions

### Connection Form UX
- **D-01:** Dynamic form fields per backend type. User selects backend (Oracle, PostgreSQL, Hive) first, then the form shows only fields relevant to that backend. Oracle: host, port, service_name, schema. Hive: host, port, database, auth type. PostgreSQL: host, port, database.
- **D-02:** Oracle connections use service_name only — no SID or TNS alias support. Modern Oracle standard. Matches the existing `uri_builder.py` pattern.
- **D-03:** Test Connection is required before first save (create). Prevents orphaned broken connections. Edit mode allows saving without re-testing if only the display name changed.
- **D-04:** Connection pool settings (pool_size, max_overflow, timeout) are config-only — managed in `superset_config.py` or `databases.json`, not exposed in the UI.
- **D-05:** Passwords are never returned to the frontend. Superset stores credentials in its database but the API never sends them back. Edit form shows a `••••••••` placeholder — user must re-enter password only when changing it.

### Connection Health & Status
- **D-06:** On-demand test only — no background health checks. Status updates when user clicks "Test Connection" or when a query fails. Three states: `connected` (last test/query passed), `unreachable` (last test/query failed), `untested` (never tested).
- **D-07:** Query failures propagate to status. When `QueryEngine` gets a connection error for a database, mark that database as `unreachable` in the management UI. Status clears to `connected` on next successful test or query.
- **D-08:** Minimal metadata in detail view: backend type, created date, last tested date, current status, dataset count. No query analytics.
- **D-09:** Colored dot status indicator on data source cards — green (connected), red (unreachable), gray (untested). Subtle, space-efficient.

### Driver Installation
- **D-10:** Install all database drivers in the Superset Docker image: `python-oracledb` (thin mode — no Oracle Client libraries needed), `pyhive` + `thrift` for Hive, `psycopg2-binary` for PostgreSQL. Image is production-ready regardless of which databases are configured.
- **D-11:** Use `python-oracledb` instead of `cx_Oracle`. Modern replacement, thin mode is pure Python. Update `uri_builder.py` to generate `oracle+oracledb://` URIs instead of `oracle+cx_oracle://`.

### Environment Configuration
- **D-12:** Separate config files per environment: `databases.json` (dev), `databases.prod.json` (production). `DATABASES_CONFIG_PATH` env var selects which file to load. Dev configs stay hardcoded to PostgreSQL; prod configs point to real Oracle/Hive instances.
- **D-13:** PostgreSQL-only for local dev. No Hive or Oracle containers in docker-compose. Drivers are installed in the Superset image but PostgreSQL stands in for all databases locally.

### Navigation
- **D-14:** Connection management stays under Settings > Data Sources tab (existing location). No dedicated top-level nav item. Database management is a dev-team admin task.

### Claude's Discretion
- Dynamic form field layout and validation messaging
- DataSourceSheet component refactoring to support backend-specific form sections
- How connection status state is tracked (in-memory cache, database column, or Zustand store)
- How QueryEngine propagates connection errors back to status tracking
- Hive auth mechanism fields (Kerberos, LDAP, or none — depends on Superset support)
- Last tested timestamp storage location

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — database management
- `backend/app/api/databases.py` — Full CRUD routes for databases, already proxies to Superset. Needs status tracking additions.
- `backend/app/services/database_registrar.py` — Syncs databases.json into Superset on startup, caches name→ID mapping. May need env-aware config loading.
- `backend/app/services/uri_builder.py` — Builds SQLAlchemy URIs for Oracle, PostgreSQL, Hive, ES. Needs oracle+oracledb:// update.
- `backend/app/services/superset_client.py` — All database CRUD methods (list, create, update, delete, test_connection)
- `backend/app/services/query_engine.py` — Query execution. Needs connection error → status propagation.
- `backend/app/models/database_config.py` — DatabaseEntry, DatabasesConfig Pydantic models
- `backend/app/models/database.py` — DatabaseCreate, DatabaseUpdate, TestConnectionRequest Pydantic models
- `backend/app/config/databases.json` — Current dev database definitions (all PostgreSQL)

### Frontend — data sources UI
- `frontend/src/components/settings/data-sources-tab.tsx` — Grid/list view with search, card/row rendering
- `frontend/src/components/settings/data-source-sheet.tsx` — Sheet for create/edit/detail. Needs backend-specific dynamic form.
- `frontend/src/components/settings/data-source-card.tsx` — Card view of a database. Needs status dot.
- `frontend/src/components/settings/data-source-row.tsx` — Row view. Needs status dot.
- `frontend/src/components/settings/data-sources-toolbar.tsx` — Search, view toggle, add button
- `frontend/src/hooks/use-databases.ts` — Full hooks: useDatabases, useCreateDatabase, useUpdateDatabase, useDeleteDatabase, useTestConnection, useSyncDatasets
- `frontend/src/types/database.ts` — DatabaseInfo, DatabaseCreate, DatabaseUpdate, TestConnectionRequest types

### Superset container
- `superset/Dockerfile` — Currently installs psycopg2-binary only. Needs python-oracledb, pyhive, thrift.
- `superset/superset_config.py` — Superset config, may need connection pool settings

### Project context
- `.planning/PROJECT.md` — Project vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` — DATA-01, DATA-02, DATA-04 requirements for this phase
- `CLAUDE.md` — Coding conventions, tech stack, project structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `databases.py` API: Full CRUD already built — list, get, create, update, delete, test, sync. All proxy to Superset. Needs status tracking and test-before-save enforcement.
- `use-databases.ts`: Complete hook set — all mutations with query invalidation. Ready to use as-is.
- `DataSourcesTab`: Working grid/list view with search. Needs status dots on cards/rows.
- `DataSourceSheet`: Create/edit/detail slide-over. Needs refactoring for dynamic backend-specific fields.
- `uri_builder.py`: Generates correct URIs per backend. Needs oracle+oracledb:// dialect swap.
- `DatabaseRegistrar`: Auto-syncs databases.json to Superset on startup. Works as-is, needs env-aware config path.

### Established Patterns
- FastAPI `Depends()` for SupersetClient injection (`SupersetDep`)
- `_handle_httpx_error()` for consistent Superset error mapping
- Pydantic v2 models for all request/response shapes
- TanStack Query with query key invalidation on mutations
- Shadcn Sheet component for slide-over forms

### Integration Points
- `backend/app/main.py` lifespan — DatabaseRegistrar.sync() runs on startup, needs env-aware config path
- `backend/app/config.py` Settings — needs `databases_config_path` to support prod/dev files
- `frontend/src/routes/_app/settings/index.tsx` — Settings page with Data Sources tab (existing)
- `docker-compose.yml` — Superset service uses `superset/Dockerfile`

</code_context>

<specifics>
## Specific Ideas

- The existing data sources UI and backend are 70-80% built. The primary work is: (1) dynamic form fields per backend type, (2) connection status tracking with colored dots, (3) test-before-save enforcement, (4) driver installation in Dockerfile, (5) uri_builder dialect update, (6) environment-specific config files.
- Passwords never leave the backend — this is important for security even though auth isn't implemented yet. Superset stores credentials internally, the list/get endpoints strip them.
- Connection status propagation from QueryEngine errors means the management UI passively reflects database health without explicit health check infrastructure.
- python-oracledb thin mode is a big win — avoids the nightmare of installing Oracle Instant Client in the Docker image.

</specifics>

<deferred>
## Deferred Ideas

- **Elasticsearch integration (DATA-03)** — Dual path via Superset SQL (elasticsearch-dbapi) and sidecar (elasticsearch-py for complex aggregations, nested queries, full-text search). Deferred to a future phase per user request.
- **Connection pool settings in UI** — Pool size, max overflow, timeout configurable per connection. Currently config-file-only.
- **Query analytics per database** — Total queries, average latency, last query time. Monitoring concern, not v1.

</deferred>

---

*Phase: 04-data-source-connectivity*
*Context gathered: 2026-04-05*
