# Codebase Concerns

**Analysis Date:** 2026-04-11

> **Scope note:** This document verifies and expands on the concerns list carried in
> `CLAUDE.md` and agent memory, validated against the working tree on branch
> `feature/add-color-remove-postgres` at commit `7903fd0`. Several of the historical
> concerns (dead legacy dashboard components, missing cross-filter/drill-down,
> missing chart export/fullscreen) have already been **resolved** in-place; these
> are listed at the bottom under "Previously-Flagged Concerns: Status Update" so
> future agents do not chase stale work. Everything above that section is an
> **active, unresolved concern** in the current tree.

---

## Tech Debt

### Managed-dataset → data-source write-through is missing (CRITICAL — broken pipeline)

- **Issue:** The chart rendering pipeline queries `POST /api/data-sources/{id}/query`,
  which reads from `recviz_data_sources` via `ConfigStore.get_data_source()`. But
  the managed-dataset create/update endpoints write ONLY to `recviz_datasets` —
  no corresponding row is inserted into `recviz_data_sources`. A dataset created
  through the UI is therefore invisible to the chart pipeline, and any dashboard
  referencing it will 404 at query time.
- **Files:**
  - Writer (datasets): `backend/app/api/managed_datasets.py:62-87` (`create_managed_dataset`) — inserts only into `RecvizDataset`.
  - Reader (charts): `backend/app/services/config_store.py:22-26` (`get_data_source`) — reads `RecvizDataSource`.
  - Dependency wiring: `backend/app/core/dependencies.py:77-87` (`get_resolved_data_source`) — raises 404 if the ID is missing.
  - Models: `backend/app/db/models/dataset.py:14` (`recviz_datasets`) vs `backend/app/db/models/data_source.py:10-22` (`recviz_data_sources`).
  - Frontend caller: `frontend/src/components/builder/builder-page.tsx:66` maps `datasetId` → `dataSourceId` expecting them to be interchangeable.
  - Proof the split is intentional-but-incomplete: `scripts/seed-postgres.py:1028-1053` inserts paired rows into both tables (A10 "architectural guard" comment), and the comment explicitly says they must share the same string id. The API layer never performs this pairing.
- **Impact:** Any dataset created post-seed is unqueryable. Only seeded datasets work. This blocks the core "business users build dashboards" value proposition.
- **Fix approach:** Either (a) remove `recviz_data_sources` entirely and have `ConfigStore`/`QueryExecutor` read dataset + filter-mapping info directly from `recviz_datasets`, or (b) write to both tables from every managed-dataset mutation (create, update, delete). Option (a) is the cleaner long-term fix since `recviz_data_sources` only survives as a Superset-era compatibility shim.
- **Cross-ref:** Matches `project_broken_dashboard_pipeline` in agent memory.

### `recviz_data_sources` is a vestigial table

- **Issue:** `recviz_data_sources.config` holds a `DataSourceConfig` JSON blob that duplicates the `sql`, `database_id`, and `columns` fields already present in `recviz_datasets`, plus adds `database_routing`, `filter_mappings`, and a separate schema version. Two sources of truth for the same information.
- **Files:**
  - `backend/app/db/models/data_source.py:10-22`
  - `backend/app/models/data_source_config.py` (Pydantic model for the blob shape)
  - `backend/app/services/config_migrator.py:22-31` (no migrations registered — migration framework is effectively dead code)
  - `backend/app/migrations/versions/001_initial_schema.py:45` (table creation)
- **Impact:** Dataset-create endpoint and seed script have to keep two tables in sync. Filter-mapping edits in the UI have no path to the `recviz_data_sources.config.filter_mappings` array (no writer exists). Config migration pipeline (`migrate_config`) is imported and called on every read but has no registered migrations.
- **Fix approach:** Collapse into `recviz_datasets`: add `filter_mappings` and `database_routing` JSONB columns, drop `recviz_data_sources`, rewrite `QueryExecutor` to read from the single table.

### `alembic.ini` still points at `asyncpg` driver

- **Issue:** `backend/app/migrations/alembic.ini:3` hard-codes `sqlalchemy.url = postgresql+asyncpg://...` even though the application was converted to sync SQLAlchemy on 2026-04-10 (`backend/app/db/engine.py:1-12` docstring). Alembic will fail to run migrations against the live DB URL unless overridden via env.
- **Files:**
  - `backend/app/migrations/alembic.ini:3`
  - `backend/app/db/engine.py:19-25` (sync engine, psycopg2 in prod via `recviz_db_url`)
- **Impact:** Running `alembic upgrade head` from the repo root using the checked-in config will attempt to load `asyncpg`; confusing error for any new developer. Database name `superset_meta` in the URL is also vestigial.
- **Fix approach:** Switch to `postgresql+psycopg2://` and rename the DB to `recviz_meta`. Update `docker-compose.yml:8` (`POSTGRES_DB: superset_meta`) and `backend/app/config.py:8` (`recviz_db_url` default) in the same change.

### Stale Superset references in file/db names and code comments

- **Issue:** Superset was removed on 2026-04-10 but several names and comments remain:
- **Files:**
  - `backend/app/config.py:8` — default DB URL ends in `/superset_meta`
  - `docker-compose.yml:8` — `POSTGRES_DB: superset_meta`
  - `backend/app/services/query_utils.py:6,106` — module docstring and `build_result_response` docstring talk about "Superset-compatible result response builder / Superset query result contract"
  - `backend/app/services/query_engine.py:3,13,184` — "Replaces the Superset-backed QueryEngine", "Superset-era output" for "zero-change frontend compatibility"
  - `backend/app/api/databases.py:610-613` — `POST /{db_id}/sync` is a no-op stub preserved for API compatibility; the route and its frontend caller should both be removed
  - `frontend/src/components/dashboard/config-chart-grid.tsx:58` — hard-codes `datasourceId: 0` with comment "config-driven charts don't use Superset datasource IDs"
  - `frontend/src/components/dashboard/dashboard-renderer.tsx:64` — comment references "Superset cache"
  - `frontend/src/hooks/use-dashboard-kpis.ts:16-27` — docstring documents the legacy-KPI-endpoint history; the hook itself is correct but the archaeology adds noise
- **Impact:** Cognitive load for agents and developers reading the code. Confusing for anyone who still thinks Superset is in the stack.
- **Fix approach:** One housekeeping pass — rename `superset_meta` → `recviz_meta`, delete `sync_datasets` endpoint and its frontend caller, drop Superset lineage from docstrings, kill `datasourceId: 0`.

### `CODEBASE_GUIDE.md` path and contents are stale

- **Issue:** `CLAUDE.md:318` and `CLAUDE.md:337` both point to `recviz/CODEBASE_GUIDE.md` but that file lives at `docs/CODEBASE_GUIDE.md`. The file is also dated **2026-03-28** and still describes the three-tier Superset architecture, two parallel dashboard systems (legacy vs config-driven), mock-mode fallback, and other facts that no longer reflect reality.
- **Files:**
  - `docs/CODEBASE_GUIDE.md:5` — "Last updated: 2026-03-28"
  - `docs/CODEBASE_GUIDE.md:38-45` — ASCII diagram shows React → FastAPI → Superset → Oracle/SQLite, which is no longer the architecture
  - `docs/CODEBASE_GUIDE.md:54-60` — "Two Parallel Systems" section describes a dead legacy dashboard that has been deleted
  - `CLAUDE.md:317` and `CLAUDE.md:337` — broken path references
- **Impact:** New agents are pointed at a stale guide as the authoritative reference. If an agent trusts the guide, it will hallucinate Superset integrations, legacy components that no longer exist, and mock-mode fallbacks that were never there in the post-Superset rewrite.
- **Fix approach:** Either update `docs/CODEBASE_GUIDE.md` to reflect the current as-built state (direct SQLAlchemy, no Superset, no Redis, config-driven dashboards only) or delete it and repoint `CLAUDE.md:318,337` to the new `.planning/codebase/` docs this agent produced.

### Large file: `backend/app/api/databases.py` (613 lines)

- **Issue:** `databases.py` is by far the largest backend file in the app (next largest is 267 lines). It mixes connection CRUD, live schema introspection (`/{db_id}/tables`, `/{db_id}/tables/{table}/columns`), a legacy no-op `/{db_id}/sync`, connection testing with two modes (by-id vs by-body), backend-specific SQL (Oracle `all_tables`/`all_views`/`all_mviews` unioning plus PostgreSQL `information_schema` branches), and the dead `sync_datasets` stub.
- **Files:** `backend/app/api/databases.py` (all 613 lines)
- **Impact:** Hard to navigate, hard to test any single piece, every small edit has to reason about all the other endpoints sharing the file.
- **Fix approach:** Extract schema-introspection into `backend/app/services/schema_introspection.py`, extract connection-test into `backend/app/services/connection_test.py`, drop the `sync_datasets` no-op entirely, and leave only thin CRUD handlers in the router file.

---

## Known Bugs

### `recviz_data_sources.filter_mappings` is never updated when a dataset is edited

- **Symptoms:** Seeded datasets work correctly (because `scripts/seed-postgres.py:1064-1074` writes a `_BASE_FILTER_MAPPINGS` array into `recviz_data_sources.config.filter_mappings`). Editing the dataset's SQL through the UI updates `recviz_datasets.sql` but leaves `recviz_data_sources.config.query` untouched, so the executed SQL will be the stale pre-edit version.
- **Files:**
  - `backend/app/api/managed_datasets.py:102-126` (`update_managed_dataset`) — writes only to `RecvizDataset`
  - `backend/app/services/query_engine.py:108-169` (`_build_sql`) — reads `ds.query` from `DataSourceConfig`, not `RecvizDataset.sql`
- **Trigger:** Edit any seeded dataset through `/datasets/:id/edit`, save, then render a chart that uses it. The chart will still execute the original seeded SQL.
- **Workaround:** Re-run the seed script (nuclear option) or manually UPDATE the `recviz_data_sources.config->>'query'` field.

### `recviz_data_sources.config.database_routing.database` is a schema/name, not a UUID

- **Symptoms:** `QueryExecutor._resolve_database` (`backend/app/services/query_engine.py:61-92`) returns a NAME (string), which is then passed to `ConnectionResolver.resolve(db_name)` to look up a UUID. But `RecvizDataset.database_id` (`backend/app/db/models/dataset.py:20`, migrated in `007_dataset_database_id_to_string.py`) already holds a UUID directly. The two systems use different identifier schemes for the same thing.
- **Files:**
  - `backend/app/services/query_engine.py:61-92` — name-based resolution
  - `backend/app/db/models/dataset.py:20` — UUID field
  - `backend/app/services/connection_resolver.py:61-69` — name-keyed cache
  - `backend/app/migrations/versions/007_dataset_database_id_to_string.py` — the schema change that created the mismatch
- **Trigger:** Any attempt to write a unified dataset-create flow that populates both tables will hit this immediately — the `database_id` fields have incompatible meanings.
- **Workaround:** None currently. This is a blocker for fixing the "Managed-dataset → data-source write-through is missing" concern above.

### `recviz_data_sources.database_routing.database` field populated with "superset_db_reconmgmt"

- **Symptoms:** `scripts/seed-postgres.py:1061` sets `DEFAULT_DATABASE_NAME = "superset_db_reconmgmt"`. This string is written into every seeded `DataSourceConfig.database_routing.database`. `ConnectionResolver` then has to resolve that string against `recviz_connections.name` — which works only because the seed also creates a matching connection row with that exact name.
- **Files:**
  - `scripts/seed-postgres.py:1061` — the string literal
  - `backend/app/services/connection_resolver.py:56` — cache key is `row.name`
- **Trigger:** A new deployment that skips the seed script and creates connections via the UI will have `recviz_connections.name = <lower_snake_from_display_name>`, which will NOT match the "superset_db_reconmgmt" hard-code baked into any seeded dataset configs. Migrations or manual intervention required.
- **Workaround:** Always run the seed script before creating custom connections, or manually update the `database_routing.database` field in every `recviz_data_sources` row.

---

## Security Considerations

### No authentication on any endpoint

- **Risk:** Every `/api/*` route is unauthenticated. Anyone who can reach the FastAPI host can read dashboards, list connections (metadata only — passwords are encrypted), execute arbitrary read-only SQL via `/api/sql/execute`, and register new connections with arbitrary credentials.
- **Files:**
  - `backend/app/main.py:184-205` — no auth middleware, no auth dependency registered on the router
  - `backend/app/core/dependencies.py` — defines `DbSessionDep`, `SupersetDep`, etc. but no `CurrentUserDep`
  - `backend/app/api/router.py:15-25` — includes every router without any `Depends(require_user)`
  - `frontend/src` — no `login`, `signin`, or `auth` files (only CSS-related "auth" mentions in shadcn components)
- **Current mitigation:** CORS is restricted to `localhost:5173/3000/4200` in dev (`backend/app/main.py:188`). `X-Frame-Options: SAMEORIGIN` prevents iframe embedding (`backend/app/main.py:195-200`). SQL Explorer enforces read-only at the statement level (`backend/app/services/query_utils.py:172-193`). Database passwords are encrypted at rest via Fernet (`backend/app/services/encryption.py`).
- **Recommendations:** Add an auth layer (likely SSO/SAML/OIDC per CLAUDE.md "Auth strategy TBD"). Every `/api/*` route should have a `Depends(require_user)` guard. Add a per-user audit log for `/api/sql/execute` and all connection-mutation endpoints. Before any production deployment, add CSRF protection if cookie auth is chosen.
- **Cross-ref:** Concern #6 from the initial list. Verified — still completely absent.

### SQL Explorer read-only validator is string-based and may miss edge cases

- **Risk:** `validate_read_only` (`backend/app/services/query_utils.py:172-193`) rejects multi-statement queries by checking for `;` in the stripped body and requires the statement to start with `SELECT`, `WITH`, or `EXPLAIN` after optional comments. It does not parse the SQL. A cleverly constructed `SELECT` with a `WITH ... INSERT` CTE (PostgreSQL supports writable CTEs) would pass the regex.
- **Files:**
  - `backend/app/services/query_utils.py:166-193`
  - `backend/app/api/sql.py:51-77` (calls the validator)
- **Current mitigation:** The database user should be read-only (defense in depth — acknowledged in the validator docstring). Pagination wrapping (`wrap_with_pagination`) also neutralizes many injection attempts by wrapping the whole thing in a subquery.
- **Recommendations:** (a) Grant the SQL-Explorer DB role SELECT-only privileges at the database level. (b) Add a test case specifically for `WITH ins AS (INSERT INTO ... RETURNING *) SELECT * FROM ins` to confirm it's rejected. (c) Consider using `sqlparse` for a real AST check.

### Filter values are interpolated into SQL via string substitution

- **Risk:** `QueryExecutor._build_sql` (`backend/app/services/query_engine.py:108-169`) builds WHERE clauses by string-substituting filter values into `{{values}}` / `{{value}}` / `{{date_range_clause}}` placeholders. Single quotes are escaped by doubling (`'` → `''`), but there is no parameter binding. The date range clause is even worse: `value` is coerced via `int(fval)` for the interval, but the final string is concatenated into SQL (`f"BETWEEN SYSDATE - {value} AND SYSDATE"`).
- **Files:**
  - `backend/app/services/query_engine.py:94-106` (`_build_date_range_clause`)
  - `backend/app/services/query_engine.py:132-156` (filter substitution)
- **Current mitigation:** Single-quote doubling for string values; `int()` cast for date range. Filter definitions are not user-controlled at query time — they come from the dataset config. End-user input only supplies VALUES, not SQL.
- **Recommendations:** Replace the template system with SQLAlchemy `text()` bindparams (or real parameterized queries) so the execution layer never sees raw string interpolation for user values. This is especially important before the system accepts user-authored dataset SQL with custom filter mappings.

### Dataset query response contains raw DB values without sanitization

- **Risk:** `build_result_response` (`backend/app/services/query_utils.py:101-159`) returns the full row payload as-is (tuples converted to dicts). If a row contains HTML or JavaScript in a text column and the frontend ever renders it without escaping, XSS is possible.
- **Files:**
  - `backend/app/services/query_utils.py:101-159`
  - `frontend/src/components/dashboard/config-data-grid.tsx` (AG Grid default escaping applies)
  - `frontend/src/lib/chart-export.ts` (CSV export pipes raw values through)
- **Current mitigation:** AG Grid escapes cell values by default. ECharts and AG Charts also escape tooltip text. React's JSX escapes by default.
- **Recommendations:** Document this assumption — any new custom cell renderer or chart tooltip override must escape DB values. Consider a small lint rule or test harness that flags `dangerouslySetInnerHTML` on row data.

### CORS allow_origins hard-coded to localhost

- **Risk:** `backend/app/main.py:188` hard-codes CORS to `["http://localhost:5173", "http://localhost:3000", "http://localhost:4200"]`. In the RHEL/Oracle production deployment (per agent memory `project_rhel_deploy_state`), the frontend is served from the SAME origin as the backend (via `StaticFiles` mount in `backend/app/main.py:219-232`), so CORS is not needed. But if someone later deploys behind a reverse proxy on a different origin, CORS will silently block all requests with no useful error message.
- **Files:** `backend/app/main.py:186-192`
- **Current mitigation:** Same-origin SPA serving in prod.
- **Recommendations:** Read CORS origins from an env var (`CORS_ALLOWED_ORIGINS`) with the localhost list as default. Document the prod-same-origin assumption in `docs/DEPLOYMENT.md`.

### Backend `.env` file present but not documented as required

- **Files:** `backend/.env` exists on this dev machine (checked with `ls`, contents NOT read). `backend/app/config.py:6` declares `recviz_encryption_key: SecretStr` with no default — the application will fail to start without the env var being set.
- **Impact:** A developer who clones the repo without running a setup script will get a cryptic pydantic-settings validation error on first `uvicorn` launch.
- **Recommendations:** Ship a `backend/.env.example` (no such file exists in the repo) documenting the required `RECVIZ_ENCRYPTION_KEY`, `RECON_DB_URL`, `RECVIZ_DB_URL` variables. The test suite already works around this via `backend/tests/conftest.py` setting a hard-coded test key.

---

## Performance Bottlenecks

### KPI aggregation runs client-side over full datasets (CRITICAL for stated scale)

- **Problem:** `useDashboardKpis` (`frontend/src/hooks/use-dashboard-kpis.ts:28-161`) fetches every KPI source dataset via `POST /api/data-sources/:id/query`, then iterates all rows in JavaScript to compute SUM/AVG/MIN/MAX/COUNT. `useCrossFilterData` does the same work a second time after cross-filters are applied (`frontend/src/hooks/use-cross-filter-data.ts:1-89`).
- **Files:**
  - `frontend/src/hooks/use-dashboard-kpis.ts:80-137`
  - `frontend/src/hooks/use-cross-filter-data.ts:60-82`
  - `frontend/src/lib/kpi-aggregator.ts` (the recompute logic)
- **Cause:** The KPI backend endpoint referenced in the `use-dashboard-kpis.ts:16-27` docstring (`POST /api/dashboards/:id/kpis`) was deleted in Phase 10 legacy cleanup, and the replacement is a full client-side re-aggregation. `DEFAULT_MAX_ROWS = 10_000` (`backend/app/services/query_engine.py:38`) caps every response at 10k rows, but that's still 10k × (number of KPI datasets) over the wire per dashboard render.
- **Impact (against CLAUDE.md "Data volume: Millions of rows" requirement):** Any dataset with more than ~10k distinct rows will silently return truncated results with `truncated: true` and compute WRONG KPI values because the tail of the data is missing. At ~10k rows the wire cost is ~1–5 MB per dataset per filter change, multiplied by the number of KPIs on the dashboard. This is a three-orders-of-magnitude mismatch with the stated scale.
- **Improvement path:** Re-introduce a server-side KPI endpoint that computes SUM/AVG/COUNT/MIN/MAX with a single aggregated SQL query per KPI. Keep the client-side recompute for cross-filter drilling, but only over the *already-filtered* tail of the data (which is small by definition). Long-term: push cross-filter predicates to the DB so we never need the raw rows at all.
- **Cross-ref:** Memory item `feedback_research_rigor` explicitly calls out this class of mistake ("reason about real production data volumes").

### In-memory SQL query history does not survive restart or scale across workers

- **Problem:** `backend/app/api/sql.py:30-41` stores the SQL Explorer query history in a module-level `_query_history` list, capped at 200 entries. Single-worker uvicorn only. Comment on line 31 acknowledges this.
- **Files:** `backend/app/api/sql.py:30-41,176-178`
- **Cause:** "Simple for now" scaffolding that never got promoted to DB-backed storage.
- **Improvement path:** New table `recviz_sql_history` with columns `id, user_id, database_id, sql, status, row_count, executed_at, error`. On multi-worker deployments each user can see their own history.

### In-memory saved views store loses data on every restart

- **Problem:** `backend/app/api/views.py:12-44` uses a module-level `_views: dict[str, SavedView]` to hold saved dashboard views (filter presets users save via "Save View"). All data is lost on process restart. Multi-worker uvicorn will have each worker holding a different, non-authoritative copy.
- **Files:** `backend/app/api/views.py:1-44`
- **Cause:** Same scaffold-first pattern as the SQL history store.
- **Improvement path:** Add `recviz_saved_views` table and a proper CRUD service. Likely same PR as SQL history since both are in-memory stores with identical lifetime problems.

### ConnectionStatusTracker is in-memory only

- **Problem:** `ConnectionStatusTracker` (`backend/app/services/connection_status.py`) tracks runtime connection health in-memory. Status displayed to users in Settings is read from the DB row instead (`backend/app/api/databases.py:96-116`), but the tracker is still the signal source for live request-level mark_unreachable/mark_connected and the in-process "last known state" — these observations are lost on restart, and the startup sweep (`backend/app/main.py:91-157`) has to reconstruct everything.
- **Files:**
  - `backend/app/services/connection_status.py:1-37`
  - `backend/app/main.py:91-159` (startup sweep)
  - `backend/app/api/databases.py:96-116` (reads from DB, not tracker)
- **Impact:** Two sources of truth (in-memory tracker + DB rows) that can drift under multi-worker load.
- **Improvement path:** Eliminate the in-memory tracker. On every query error, UPDATE the `recviz_connections` row directly. Use PostgreSQL LISTEN/NOTIFY or a periodic poll if other workers need to know about status changes.

### `MergeEngine` builds a full in-memory hash join per merge

- **Problem:** `MergeEngine._merge_two` (`backend/app/services/merge_engine.py:23-67`) builds a dict keyed by the merge columns over the right-side dataset, iterates every left-side row, and concatenates matching dicts. No streaming, no partial results. At `DEFAULT_MAX_ROWS = 10000` and two 10k-row inputs, each merge is O(20k) dict allocations and 2x the memory footprint.
- **Files:** `backend/app/services/merge_engine.py:23-67`
- **Cause:** Simple, correct implementation that does not consider the data volume target.
- **Improvement path:** Push the merge down to SQL (`UNION ALL` + `JOIN` in a single query against the target DB). The `QueryExecutor` already has the dialect awareness needed. This is also a correctness win because the merge will then respect DB collation rules.

### Dashboard charts each issue their own `/api/data-sources/:id/query` request

- **Problem:** Each chart on a dashboard calls `useDataSourceQuery(chart.dataSourceId, filters)` which produces its own `POST /api/data-sources/:id/query` call. Dashboards with N charts against M datasets produce up to N queries even if several charts share the same dataset. TanStack Query's cache deduplicates by `queryKey` (`['data-source', id, filters]`), which helps with same-dataset chart duplication, but different filter snapshots cause cache misses.
- **Files:**
  - `frontend/src/hooks/use-data-source-query.ts:11-22`
  - `frontend/src/components/dashboard/config-chart-grid.tsx` (one useQuery per chart)
- **Cause:** One chart → one hook call pattern.
- **Improvement path:** Add a dataset-batch endpoint `POST /api/data-sources/batch-query` that accepts `[{id, filters}]` and returns results in one round trip. Only useful when HTTP/2 multiplexing isn't available, but it cuts the request overhead.

---

## Fragile Areas

### Dataset schema versioning is wired but inert

- **Files:**
  - `backend/app/services/config_migrator.py:1-31` — `_migrations: dict[int, MigrationFunc] = {}` is never populated
  - `backend/app/services/config_store.py:26` — calls `migrate_config(row.config)` on every read
  - `backend/app/db/models/data_source.py:15` — `schema_version: Mapped[int]` defaults to 1
- **Why fragile:** The framework exists, no migrations are registered, and the `CURRENT_SCHEMA_VERSION = 1` constant means there is no version drift to handle today. The moment someone adds a v2 field to `DataSourceConfig` without a migration, `ConfigStore` will return raw-unmigrated dicts and `DataSourceConfig.model_validate` will fail with a Pydantic error that has nothing to do with migrations.
- **Safe modification:** Before touching `DataSourceConfig`, bump `CURRENT_SCHEMA_VERSION`, register a migration via `@register_migration(from_version=1)`, and add a test that reads a v1 blob and asserts it upgrades.
- **Test coverage:** Zero. The migrator has no unit tests.

### Oracle empty-string-is-null coercion is manual and scattered

- **Files:**
  - `backend/app/api/managed_datasets.py:28-47` (`_to_response` for datasets)
  - `backend/app/api/managed_charts.py:29-47` (`_to_response` for charts)
  - `backend/app/api/managed_dashboards.py:27-43` (`_to_response` for dashboards)
  - `backend/app/api/managed_kpis.py` (same pattern, verified via code read earlier)
- **Why fragile:** Every response builder includes an identical `description=ds.description or ""` coercion with a paragraph-long comment explaining the Oracle quirk. Any new entity type that follows the "description is always a string" contract needs a fifth copy. Anyone who writes a new response field that holds a string will have to discover this quirk through a production Oracle failure.
- **Safe modification:** Extract into a custom SQLAlchemy `TypeDecorator` or a mixin that coerces `None` → `""` on read for all text columns whose ORM field is declared non-nullable with `server_default=""`. Apply to the ORM layer so route handlers don't have to remember.
- **Test coverage:** `backend/tests/test_description_none_coercion.py` (141 lines) exists — covers the pattern for one entity. Not parametrized across all four.

### `config_chart-grid.tsx` is 551 lines, three inner components, and the fullscreen-dialog state machine

- **Files:** `frontend/src/components/dashboard/config-chart-grid.tsx` (all 551 lines)
- **Why fragile:** Contains three inner components (`ConfigChartCell`, `ConfigKpiChartCell`, `ConfigChartGrid`), each with their own cross-filter + drill-down + fullscreen state, and two near-identical `<ChartWrapperProps>` call sites per cell (once inside the grid card, once inside the fullscreen dialog). A fix in one place has to be replicated to two other cells and both call sites — five places per change.
- **Safe modification:** Before adding a new chart interaction, write a Playwright test against a seeded dashboard so regressions are caught.
- **Test coverage:** No component-level tests for `config-chart-grid.tsx`. Covered indirectly by `frontend/e2e/parity-dashboards.spec.ts` and `frontend/e2e/dashboard-view-regression.spec.ts`.

### `frontend/src/components/settings/data-source-sheet.tsx` is 874 lines

- **Files:** `frontend/src/components/settings/data-source-sheet.tsx`
- **Why fragile:** Largest frontend file in the repo. Holds the create/edit form, test-connection state machine, schema introspection browser, and the delete-with-references check. Every business-logic change touches a different region of the same component.
- **Safe modification:** Isolated to the sheet — no cross-file impact if the form structure changes. But internally, the component is big enough that state-bug regressions are likely.
- **Test coverage:** `frontend/src/components/settings/data-source-sheet.test.tsx` exists.

### Oracle thick mode init is fragile to path changes

- **Files:** `backend/app/main.py:17-28`
- **Why fragile:** Hard-codes `/opt/oraclient/19.3_64/lib` as the Instant Client path, with a broad `except Exception` that silently falls back to thin mode. In local dev with no Instant Client installed, this always falls back to thin, so any Oracle-thick-mode-only behavior (e.g., NCS 871 national character set support) is never exercised on dev laptops. A silent fallback to thin mode on a prod box with the wrong Instant Client path would fail queries against Oracle databases with unsupported character sets.
- **Safe modification:** Config-driven the path (`ORACLE_INSTANT_CLIENT_DIR` env var, default `/opt/oraclient/19.3_64/lib`). Log loud warnings on fallback. Add a healthcheck endpoint that reports `oracledb.is_thin_mode`.
- **Test coverage:** None (import-time side effects are hard to test).

---

## Scaling Limits

### Single-worker uvicorn assumption baked into in-memory stores

- **Current capacity:** Tested with single-worker uvicorn. Production RHEL deployment (per agent memory) runs the same way.
- **Limit:** Multi-worker uvicorn (`--workers N`) will fail because:
  - SQL query history (`backend/app/api/sql.py:30-41`) is per-worker
  - Saved views (`backend/app/api/views.py:12-44`) are per-worker
  - Connection status tracker (`backend/app/services/connection_status.py`) is per-worker, can only be partially reconciled via DB reads
- **Scaling path:** Move these three stores to the metadata DB (`recviz_sql_history`, `recviz_saved_views`) and eliminate the in-memory tracker.

### Dataset row hard-cap at 10,000

- **Current capacity:** `DEFAULT_MAX_ROWS = 10_000` in `backend/app/services/query_engine.py:38`, enforced via SQL-level pagination wrapper.
- **Limit:** Any dataset that legitimately needs to return more than 10k rows (e.g., a detail-level drill-down) will see `truncated: true` and the trailing rows will be silently dropped.
- **Scaling path:** (a) Expose `max_rows` as a per-chart config (already supported via the function argument — just needs a UI path), or (b) add server-side pagination with infinite scroll in the grid, or (c) push aggregation to the DB so raw-row transfers become unnecessary.

### Engine pool defaults are fixed at 5 connections per backend

- **Current capacity:** `DEFAULT_POOL_KWARGS = {"pool_size": 5, "max_overflow": 10, ...}` (`backend/app/services/engine_manager.py:31-37`). Per-backend, not per-worker.
- **Limit:** 5 concurrent queries per database. 6th query blocks for up to `pool_timeout = 30s` waiting for a connection.
- **Scaling path:** Expose pool size as an env var. Monitor via a `/metrics` endpoint that reports current engine pool saturation.

---

## Dependencies at Risk

### `oracledb>=3.3.0` thick mode requires Oracle Instant Client 19.3 installed at `/opt/oraclient/19.3_64/lib`

- **Risk:** Hard-coded path (`backend/app/main.py:20`) means the app is coupled to a specific Instant Client install location. Any production box with a different path silently falls back to thin mode, which does not support NCS 871 national character set.
- **Impact:** Queries against Oracle DBs with NCS 871 will return corrupt strings or fail outright.
- **Migration plan:** Read the path from env var `ORACLE_INSTANT_CLIENT_DIR`, default to `/opt/oraclient/19.3_64/lib`, fail loudly on init errors instead of `logger.warning`.

### AG Grid / AG Charts Enterprise licenses

- **Risk:** `ag-grid-enterprise@35.0.1` and `ag-charts-enterprise@13.0.1` are in `frontend/package.json`. The enterprise modules register at startup (`frontend/src/main.tsx`). No license key setup is present in the repo.
- **Impact:** In production, AG Grid will display a "free trial" watermark unless a license is provided via `LicenseManager.setLicenseKey(...)` before `ModuleRegistry.registerModules(...)`.
- **Migration plan:** (a) Add `VITE_AG_GRID_LICENSE_KEY` to the env config and wire it in `frontend/src/main.tsx` before module registration. (b) Document the license procurement process.

### No lockfile for backend Python deps

- **Risk:** `backend/requirements.txt` pins exact versions but there is no transitive lockfile (e.g., no `pip-tools` `requirements.lock` or Poetry lock). Indirect deps can drift between `pip install -r requirements.txt` runs.
- **Impact:** Non-reproducible builds. A prod deploy from a freshly pulled requirements.txt on a new day can pick up different versions of sub-dependencies than the dev machine.
- **Migration plan:** Adopt `pip-tools` (`pip-compile requirements.in > requirements.txt` with hashes) or migrate to `uv pip compile` / `poetry export`.

---

## Missing Critical Features

### Export (PDF/Excel) for dashboards is not implemented

- **Problem:** CLAUDE.md and the concerns-list carry "Export (PDF/Excel) entirely stubbed — backend endpoints exist but return placeholders". Verified: **no export router is even registered** — it was removed entirely.
  - `backend/app/api/router.py:15-25` — no export router imported
  - No `backend/app/api/export.py` source file exists. Only `backend/app/api/__pycache__/export.cpython-312.pyc` and `backend/app/models/__pycache__/export.cpython-312.pyc` survive as .pyc artifacts.
  - `backend/requirements.txt` — no `weasyprint`, `reportlab`, `openpyxl`, or any PDF/Excel library
- **What does exist:** AG Grid built-in Excel export via `handleExcelExport()` in `frontend/src/components/dashboard/grid-toolbar.tsx:65-82`, and CSV export per chart via `chart-factory.exportCSV()` (`frontend/src/components/charts/chart-factory.tsx:77-82`). These are client-side only and export a single grid/chart.
- **Blocks:** Dashboard-wide PDF snapshots, scheduled PDF/Excel exports, email delivery. `frontend/src/routes/_app/reports/index.tsx` is a placeholder that says "coming soon".

### Reports / scheduled exports page is a placeholder

- **Files:** `frontend/src/routes/_app/reports/index.tsx:1-19`
- **Problem:** Entire route renders a "coming soon" empty state with a FileBarChart icon and the text "Scheduled exports and on-demand report generation are coming soon." No backend support, no UI, no data model.
- **Blocks:** Any "scheduled report delivery" feature. CLAUDE.md originally listed `Celery` as a dependency — Celery has since been removed from `backend/requirements.txt`, so there is also no task-queue infrastructure to build on.

### No audit log for data-modifying or query operations

- **Problem:** No `recviz_audit_log` table. No hook on `/api/sql/execute`, no hook on managed-entity CRUD endpoints.
- **Blocks:** Regulatory compliance (Citi GRU is a financial unit), security incident forensics, "who deleted this dashboard" support cases.

### No RBAC — users cannot be restricted from specific dashboards or datasets

- **Problem:** Authentication is absent (see Security Considerations). Even if it were added, there is no per-entity permission model (no `recviz_dashboard_permissions`, no `user_id` foreign key on anything).
- **Blocks:** "Business users view dashboards X and Y but not Z" requirement. "Devs can create datasets, users can only use existing ones" requirement (CLAUDE.md "Project" section mentions this as a core use case).

---

## Test Coverage Gaps

### 10 deleted backend API test files (cross-ref: memory `project_backend_test_coverage_gap`)

- **What's not tested:** Verified by comparing `backend/tests/*.py` (13 live files) against `backend/tests/__pycache__/*.pyc` (24 cached files). The following test files have .pyc artifacts but no .py source — they were deleted:
  - `test_config_store.py`
  - `test_connection_resolver.py`
  - `test_databases_api.py`
  - `test_engine_manager.py`
  - `test_managed_charts.py`
  - `test_managed_datasets.py`
  - `test_managed_kpis.py`
  - `test_query_engine.py`
  - `test_search.py`
  - `test_sql_api.py`
- **Files affected:** The seven API surface areas now have **zero regression tests**:
  - `backend/app/api/databases.py` (613 lines — the largest file in the app)
  - `backend/app/api/managed_charts.py`
  - `backend/app/api/managed_datasets.py`
  - `backend/app/api/managed_kpis.py`
  - `backend/app/api/search.py`
  - `backend/app/api/sql.py`
  - Service layer: `backend/app/services/config_store.py`, `backend/app/services/connection_resolver.py`, `backend/app/services/engine_manager.py`, `backend/app/services/query_engine.py`
- **Risk:** Any change to dataset/chart/kpi/dashboard CRUD or the SQL Explorer is unprotected. The broken dataset→data-source pipeline (above) would have been caught by a `test_managed_datasets.py` test that verifies a freshly-created dataset is queryable via `/api/data-sources/{id}/query`.
- **Priority:** **High.** Without these tests, the broken pipeline and other regressions can merge silently. The memory item flags this as the highest-priority debt.

### No end-to-end test for "create dataset via UI → render chart over it"

- **What's not tested:** The complete happy path for a net-new dataset: navigate to `/datasets/new`, configure SQL + columns, save, navigate to `/charts/new`, pick the dataset, configure a chart, add to a dashboard, open dashboard, see data.
- **Files affected:**
  - `frontend/e2e/parity-dashboards.spec.ts` (view seeded dashboards)
  - `frontend/e2e/parity-builder.spec.ts` (builder UI actions)
  - `frontend/e2e/parity-explorer.spec.ts` (SQL explorer)
  - No file covering end-to-end "build new everything, query it, see data"
- **Risk:** The broken dataset→data-source pipeline is exactly the regression this test would have caught. Flagged as **critical gap** given the project's core value proposition.
- **Priority:** **High.** The single most valuable test to add.

### No tests for Oracle empty-string coercion across all four managed entities

- **What's not tested:** `backend/tests/test_description_none_coercion.py` covers one entity. The same coercion logic is duplicated in four `_to_response` helpers and is prone to drift.
- **Files affected:** `backend/app/api/managed_datasets.py`, `managed_charts.py`, `managed_dashboards.py`, `managed_kpis.py`.
- **Priority:** **Medium.** Best fixed by extracting to a shared helper and then covering with one parametrized test.

### No tests for chart-export CSV/PNG/SVG paths

- **What's not tested:** `frontend/src/lib/chart-export.test.ts` exists and covers some helpers. The actual integration — AG Chart download → CSV file with correct headers, ECharts SVG export — has no Playwright coverage.
- **Files affected:** `frontend/src/lib/chart-export.ts`, `frontend/src/components/charts/chart-factory.tsx:57-89`, `frontend/src/components/dashboard/chart-toolbar.tsx`.
- **Priority:** **Medium.** Chart export is a user-visible feature with a dropdown menu — regressions would be embarrassing.

### No tests for `use-dashboard-kpis.ts` client-side aggregation correctness

- **What's not tested:** SUM/AVG/MIN/MAX/COUNT re-aggregation logic, `percentage_of` trend computation, and the behavior when a KPI references multiple data sources (`kpi.sources[]` with length > 1).
- **Files affected:** `frontend/src/hooks/use-dashboard-kpis.ts:80-154`, `frontend/src/lib/kpi-aggregator.ts`, `frontend/src/lib/kpi-aggregator.test.ts` (exists but coverage scope unknown).
- **Priority:** **High.** KPIs are displayed as primary numbers on every dashboard — wrong values here are the most visible possible bug.

### Large frontend files lack component-level tests

- **What's not tested:** `config-chart-grid.tsx` (551 lines), `data-source-sheet.tsx` (874 lines), `kpi-builder.tsx` (624 lines), `chart-builder.tsx` (584 lines), `filter-config-dialog.tsx` (576 lines), `builder-page.tsx` (540 lines). Each one either has no test file or has a small unit test for one sub-concern.
- **Risk:** State-machine bugs, effect-dependency drifts, and prop-threading errors are all difficult to spot in large components without tests.
- **Priority:** **Medium.** E2E tests (Playwright) provide some coverage for the happy path but miss edge cases.

---

## Previously-Flagged Concerns: Status Update

The following concerns from CLAUDE.md and agent memory have been **verified as already resolved** on this branch. Future agents should not chase these.

### Two parallel dashboard systems (legacy + config-driven) — RESOLVED

- **Original claim:** CLAUDE.md line 300 describes `filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx` as "dead code that would crash at runtime" in `frontend/src/components/dashboard/`.
- **Verified state:** `find frontend/src -name "filter-bar.tsx" -o -name "kpi-row.tsx" -o -name "chart-grid.tsx"` returns **zero results**. Only the config-driven counterparts (`config-filter-bar.tsx`, `config-kpi-row.tsx`, `config-chart-grid.tsx`) exist. The legacy components have been deleted.

### Cross-filtering and drill-down missing from config-driven dashboards — RESOLVED

- **Original claim:** "Cross-filtering and drill-down not in config-driven dashboards".
- **Verified state:** `frontend/src/components/dashboard/config-chart-grid.tsx` imports both `useCrossFilter` (line 14) and `useDrillDown` (line 15) and wires them into both `ConfigChartCell` and `ConfigKpiChartCell` (lines 124-179, 368-390). `DashboardRenderer` passes `crossFilterEnabled` and `drillDownEnabled` from `config.features` (`frontend/src/components/dashboard/dashboard-renderer.tsx:145-146`). A dedicated `<CrossFilterBar>` component (`frontend/src/components/dashboard/cross-filter-bar.tsx`) renders active cross-filter pills.

### Chart export / fullscreen missing from config-driven charts — RESOLVED

- **Original claim:** "Chart export/fullscreen NOT in config-driven charts".
- **Verified state:** `ChartFactory` (`frontend/src/components/charts/chart-factory.tsx:52-99`) forwards a `ChartRef` that exposes `downloadImage(format, fileName)`, `exportCSV(fileName)`, `copyToClipboard()`, and `supportsSVG`. `ChartToolbar` (`frontend/src/components/dashboard/chart-toolbar.tsx:30-80+`) renders a Download dropdown with PNG / SVG / CSV / Clipboard options and a fullscreen button. `ChartFullscreenDialog` (`frontend/src/components/dashboard/chart-fullscreen-dialog.tsx`) is wired in `config-chart-grid.tsx:277-300` with identical state.

### Superset code still present — RESOLVED (mostly)

- **Original claim:** "Superset was recently abandoned for production; code may still reference Superset in places".
- **Verified state:** Superset is **gone from runtime**. `backend/requirements.txt` has no Superset, no httpx, no redis. `docker-compose.yml` only runs PostgreSQL. `backend/app/main.py` has no Superset client initialization. `backend/app/services/superset_client.py` does not exist. What remains is only historical-reference text (documented in "Stale Superset references" above): the DB name `superset_meta`, some docstring lineage notes, a dead `/api/databases/{id}/sync` no-op endpoint, and a hard-coded `datasourceId: 0` in the frontend. These are cosmetic, not functional.

### `recviz_data_sources` table never written — PARTIALLY RESOLVED

- **Original claim:** Memory item `project_broken_dashboard_pipeline` says "post-Superset chart renderer still reads recviz_data_sources (never written); needs architectural fix before dashboards can render".
- **Verified state:** The table IS populated — but only by `scripts/seed-postgres.py:1028-1053` (seeded rows only), not by any API endpoint. Seeded datasets render correctly. User-created datasets (via `/api/datasets/managed` POST) are written only to `recviz_datasets` and do NOT appear in `recviz_data_sources`, so they are unqueryable through `/api/data-sources/{id}/query`. The pipeline is functional for seeded data and broken for user-created data. This is the **most important active concern** (see "Managed-dataset → data-source write-through is missing" at the top of this document).

### Backend test coverage gap — VERIFIED STILL ACTIVE

- **Original claim:** Memory item `project_backend_test_coverage_gap` — 10 async-mocked test files deleted in Unit 0 cleanup.
- **Verified state:** Exact match. See "10 deleted backend API test files" in Test Coverage Gaps above.

---

*Concerns audit: 2026-04-11. Verified against working tree on branch `feature/add-color-remove-postgres` at commit `7903fd0`.*
