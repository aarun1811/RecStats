# Codebase Concerns

**Analysis Date:** 2026-04-09

## Tech Debt

**In-memory stores for production features (Views, Export, SQL History):**
- Issue: Three backend features use ephemeral Python dicts instead of database persistence. Data is lost on every server restart.
- Files: `backend/app/api/views.py` (saved views: `_views: dict`), `backend/app/api/export.py` (export jobs: `_jobs: dict`), `backend/app/api/sql.py` (query history: `_query_history: list`)
- Impact: Saved views disappear on backend restart. Export jobs are never executed (completely stubbed). Query history is session-only. Users cannot rely on saved views or export functionality.
- Fix approach: Migrate views to a `recviz_views` table via Alembic. Implement export with Celery + a `recviz_export_jobs` table. Move query history to the database or Redis with TTL.

**Export system is entirely stubbed:**
- Issue: PDF and Excel export endpoints accept requests and return `"pending"` job IDs, but never actually generate files. No Celery worker, no WeasyPrint/openpyxl integration.
- Files: `backend/app/api/export.py`
- Impact: Users see "Export queued" messages but never receive files. This is a visible feature gap.
- Fix approach: Implement Celery tasks that query data, render PDF via WeasyPrint (or Playwright), and generate Excel via openpyxl. Store results in filesystem or object storage, provide download endpoint.

**Reports page is a placeholder:**
- Issue: The reports page shows a static "coming soon" message with no functional content.
- Files: `frontend/src/routes/_app/reports/index.tsx`
- Impact: Navigation item leads to dead end. Consider hiding the nav link until the feature is implemented.
- Fix approach: Either implement scheduled report generation (depends on export system) or remove the nav item until ready.

**Superset as hard dependency despite planned removal:**
- Issue: CLAUDE.md memory notes "Superset ditched" for production (going direct oracledb from FastAPI), but the entire backend still requires Superset at startup. The `lifespan` function calls `superset.authenticate()` and `registrar.sync()` before the server is ready.
- Files: `backend/app/main.py` (lifespan), `backend/app/services/superset_client.py`, `backend/app/services/query_engine.py`, `backend/app/services/database_registrar.py`, `backend/app/services/dataset_sync.py`
- Impact: Backend cannot start without a running Superset instance. Migration to direct Oracle queries requires rewriting QueryEngine, DatabaseRegistrar, and DatasetSyncService.
- Fix approach: Create an abstraction layer (QueryExecutor interface) with Superset and direct-Oracle implementations. Feature-flag the backend to select at startup.

**Dataset update does not trigger re-sync to Superset:**
- Issue: `update_managed_dataset` sets `sync_status = "unsynced"` but does not call `sync_service.sync_dataset()`. The re-sync only happens on the next server restart (via `reconcile()`).
- Files: `backend/app/api/managed_datasets.py` (lines 117-146)
- Impact: After editing a dataset's SQL, the Superset virtual dataset still runs the old query until the backend restarts. Users see stale data.
- Fix approach: Call `await sync_service.sync_dataset(dataset)` after applying updates, similar to the `create_managed_dataset` endpoint pattern.

**`eslint-disable` for react-hooks/exhaustive-deps in dashboard-renderer:**
- Issue: Four `useEffect` hooks in `dashboard-renderer.tsx` and one in `config-filter-bar.tsx` suppress exhaustive-deps warnings. Dependencies are intentionally partial (e.g., `[config.id]` instead of `[config, initializeFilters, ...]`).
- Files: `frontend/src/components/dashboard/dashboard-renderer.tsx` (lines 80, 104, 143), `frontend/src/components/dashboard/config-filter-bar.tsx` (line 168), `frontend/src/components/layout/app-sidebar.tsx` (line 40)
- Impact: Stale closures possible if the suppressed dependencies change identity unexpectedly. Currently works because Zustand selectors are stable, but fragile for future refactors.
- Fix approach: Extract stable callbacks with `useCallback` and include all dependencies, or document why each suppression is safe.

**No service layer for managed CRUD routes:**
- Issue: Route handlers in `managed_charts.py`, `managed_kpis.py`, `managed_datasets.py`, `managed_dashboards.py`, and `search.py` contain direct SQLAlchemy queries. This violates the service-layer pattern documented in CLAUDE.md and acknowledged in `search.py` docstring as tech debt.
- Files: `backend/app/api/managed_charts.py`, `backend/app/api/managed_kpis.py`, `backend/app/api/managed_datasets.py`, `backend/app/api/managed_dashboards.py`, `backend/app/api/search.py`
- Impact: Business logic is coupled to HTTP handling. Testing requires full FastAPI test client. Reuse of query logic (e.g., reference checking) requires importing from route modules.
- Fix approach: Create service classes per entity (e.g., `DashboardService`, `DatasetService`) in `backend/app/services/`. Move SQLAlchemy operations there. Route handlers call services.

## Known Bugs

**Dataset update sync_status comparison is always false:**
- Symptoms: `sync_status` is never set to `"unsynced"` during updates because the comparison `dataset.sql != (body.sql or dataset.sql)` evaluates incorrectly when `body.sql` is the same as `dataset.sql` (comparison is against itself).
- Files: `backend/app/api/managed_datasets.py` (line 143)
- Trigger: Update a dataset with a new SQL query.
- Workaround: The `sync_status` is also set based on whether `sync_service.sync_dataset()` is called, but that call is missing from the update path entirely.

## Security Considerations

**No authentication on any endpoint:**
- Risk: Every API endpoint is publicly accessible. Any network-reachable client can read, create, update, and delete dashboards, datasets, charts, KPIs, and execute arbitrary SQL.
- Files: `backend/app/main.py` (no auth middleware), `backend/app/core/dependencies.py` (no auth dependencies)
- Current mitigation: None. CLAUDE.md notes "Auth strategy TBD (will be added later, likely SSO/SAML/OIDC)."
- Recommendations: Implement authentication before any production deployment. At minimum: add a JWT/bearer token middleware, protect all `/api/*` routes, create a user model.

**SQL execution endpoint allows arbitrary queries:**
- Risk: `POST /api/sql/execute` forwards user-provided SQL directly to Superset's SQL Lab. Any authenticated (currently: any) user can execute `DROP TABLE`, `UPDATE`, or `DELETE` statements. Superset may or may not enforce read-only, depending on database permission configuration.
- Files: `backend/app/api/sql.py` (lines 28-98)
- Current mitigation: Superset database permissions may restrict writes. No application-level query validation.
- Recommendations: Add a SQL parser/validator that rejects non-SELECT statements. Enforce `READ_ONLY` at the database connection level. Add audit logging for all SQL executions.

**SQL template injection in QueryEngine `_build_sql`:**
- Risk: Filter values are string-interpolated into SQL via `{{values}}` and `{{value}}` placeholders. The only sanitization is single-quote doubling (`replace("'", "''")`). This is basic but does not protect against all injection vectors (e.g., Unicode confusables, nested quotes in some DB dialects).
- Files: `backend/app/services/query_engine.py` (lines 127-151)
- Current mitigation: Single-quote escaping via `chr(39)*2` replacement. Superset executes the final SQL, which adds another layer but does not parameterize.
- Recommendations: Move to parameterized queries when migrating away from Superset. Use bind variables for Oracle/PostgreSQL. Add an allow-list for filter values where possible.

**CORS allows multiple origins with full credential support:**
- Risk: `allow_credentials=True` with specific origins is acceptable for dev, but the hardcoded origin list (`localhost:5173`, `localhost:3000`, `localhost:4200`) must be updated for production.
- Files: `backend/app/main.py` (lines 85-91)
- Current mitigation: Only localhost origins are whitelisted.
- Recommendations: Move allowed origins to environment configuration. Remove `allow_methods=["*"]` and `allow_headers=["*"]` in production.

**X-Frame-Options set to ALLOWALL:**
- Risk: The `XFrameOptionsMiddleware` sets `X-Frame-Options: ALLOWALL`, allowing the application to be embedded in any iframe. This enables clickjacking attacks.
- Files: `backend/app/main.py` (lines 94-99)
- Current mitigation: None. Comment says "internal tool, no auth."
- Recommendations: Restrict to same-origin or specific trusted embed domains. Use `Content-Security-Policy: frame-ancestors` instead.

**Hardcoded default credentials in config:**
- Risk: Default Superset credentials (`admin`/`admin`), database credentials (`recviz`/`recviz_dev`), and connection strings are hardcoded in `config.py`. These are overridable via `.env` but the defaults are insecure.
- Files: `backend/app/config.py` (lines 7-12)
- Current mitigation: `pydantic-settings` reads `.env` file. A `.env` file exists at `backend/.env`.
- Recommendations: Remove default values for credentials in production builds. Require explicit environment variable configuration.

## Performance Bottlenecks

**KPI computation fetches full datasets client-side:**
- Problem: `useDashboardKpis` fetches the entire result set from each KPI's data source and sums values in the browser. For large datasets (millions of rows), this transfers excessive data over the network.
- Files: `frontend/src/hooks/use-dashboard-kpis.ts`, `frontend/src/hooks/use-cross-filter-data.ts`
- Cause: The legacy server-side KPI endpoint was removed. Client-side aggregation was a pragmatic replacement but does not scale.
- Improvement path: Add a backend endpoint that computes KPI aggregations server-side (SQL `SUM`/`COUNT`/`AVG` with `GROUP BY`), returning only scalar values instead of full row sets.

**Superset pagination not used for list operations:**
- Problem: `superset_client.list_datasets()` and `superset_client.list_databases()` fetch all records without pagination parameters. The `databases.py` endpoint then filters and paginates in Python memory.
- Files: `backend/app/services/superset_client.py` (lines 127-133, 188-190), `backend/app/api/databases.py` (lines 136-168)
- Cause: Superset API supports `page` and `page_size` query params, but the client does not pass them.
- Improvement path: Add `page` and `page_size` params to `SupersetClient.list_datasets()` and `list_databases()`. Pass through from API endpoints.

**Large component files:**
- Problem: Several components exceed 500 lines, making them hard to maintain and slow to parse mentally.
- Files: `frontend/src/components/settings/data-source-sheet.tsx` (794 lines), `frontend/src/components/kpis/kpi-builder.tsx` (624 lines), `frontend/src/components/charts/chart-builder.tsx` (584 lines), `frontend/src/components/builder/filter-config-dialog.tsx` (576 lines), `frontend/src/components/dashboard/config-chart-grid.tsx` (550 lines), `frontend/src/components/builder/builder-page.tsx` (540 lines)
- Cause: Complex multi-step forms and composite views accumulated code over phases.
- Improvement path: Extract sub-components (e.g., `DataSourceSheet` already has `DetailView` and `FormView` -- move them to separate files). Extract form logic into custom hooks.

**No query result caching on the backend:**
- Problem: Every data source query goes through Superset to the underlying database. There is no backend caching layer for frequently-accessed dashboard data.
- Files: `backend/app/services/query_engine.py`, `backend/app/api/data_sources.py`
- Cause: Redis is configured in `docker-compose.yml` and `config.py` but never used by the application code (only by Superset internally).
- Improvement path: Add Redis-based query result caching in `QueryEngine.execute()` with configurable TTL per data source. Key by (data_source_id, filters_hash).

## Fragile Areas

**Filter initialization and auto-apply timing in DashboardRenderer:**
- Files: `frontend/src/components/dashboard/dashboard-renderer.tsx` (lines 92-126)
- Why fragile: Three `useEffect` hooks interact with filter state: (1) initializes defaults from config, (2) auto-applies when single-select options load, (3) clears cross-filters when global filters change. The `hasAutoApplied` ref prevents duplicate auto-apply but depends on React's effect execution order.
- Safe modification: When changing filter initialization logic, trace through all three effects. Add integration tests that verify the init -> auto-apply -> data-fetch sequence.
- Test coverage: `filter-store.test.ts` covers the store, but no integration test covers the renderer's effect orchestration.

**Cross-filter + drill-down interaction in ConfigChartGrid:**
- Files: `frontend/src/components/dashboard/config-chart-grid.tsx` (550 lines), `frontend/src/hooks/use-cross-filter.ts`, `frontend/src/hooks/use-drill-down.ts`, `frontend/src/stores/filter-store.ts`, `frontend/src/stores/drill-store.ts`
- Why fragile: A single chart component (`QueryChartItemWithDrill`) manages data fetching, cross-filter application, drill-down navigation, fullscreen dialog state, and chart toolbar. Changes to one feature's data flow can break another.
- Safe modification: Write the cross-filter test that verifies clicking chart A filters chart B's data. Verify drill-down does not interfere with cross-filter state.
- Test coverage: Unit tests exist for `cross-filter.ts` and `drill-store.ts` individually, but no integration test covers them working together in a dashboard context.

**API client key transformation:**
- Files: `frontend/src/lib/api-client.ts` (lines 36-55)
- Why fragile: The `transformKeys` function recursively converts snake_case to camelCase for all JSON responses, except keys listed in `DATA_KEYS` (`rows`, `columns`, `data`, `config`). If a new API endpoint returns snake_case keys that should NOT be transformed (e.g., database column names in a new context), the `DATA_KEYS` set must be updated.
- Safe modification: When adding new API endpoints that return data with DB column names, verify the key transform behavior. Add the skip key to `DATA_KEYS` if needed.
- Test coverage: No dedicated tests for the key transformation logic.

**Builder store layout serialization roundtrip:**
- Files: `frontend/src/stores/builder-store.ts` (lines 39-112), `frontend/src/components/builder/builder-page.tsx` (lines 55-135)
- Why fragile: `buildItemsFromConfig` converts `DashboardConfig` to `BuilderItem[]` (with KPI row offsets for chart positioning). `serializeConfig` converts back. The roundtrip must be lossless -- any field that `buildItemsFromConfig` does not read is lost when re-saving.
- Safe modification: When adding new fields to `DashboardChartConfig` or `KpiConfig`, update both `buildItemsFromConfig` and `serializeConfig`. Consider a roundtrip test.
- Test coverage: No tests for the config-to-builder-to-config roundtrip.

## Scaling Limits

**In-memory query history (unbounded list):**
- Current capacity: `_query_history` is a Python list that grows with every SQL execution.
- Limit: Only the last 50 entries are returned via `GET /api/sql/history`, but the list itself is never pruned.
- Scaling path: Add `_query_history = _query_history[:100]` after inserts, or migrate to database/Redis.

**Single httpx.AsyncClient for all Superset requests:**
- Current capacity: One `httpx.AsyncClient(timeout=120.0)` with default connection pool (100 connections).
- Limit: Under heavy concurrent dashboard loads, Superset proxy calls may queue behind the connection pool. The 120s timeout is very long and could tie up connections.
- Scaling path: Configure `httpx.AsyncClient` pool limits explicitly. Consider separate clients for fast (metadata) vs. slow (query execution) operations. Reduce timeout for metadata calls.

**Client-side aggregation for cross-filter KPI recomputation:**
- Current capacity: Works for datasets with < 50K rows.
- Limit: For million-row datasets, `useCrossFilterData` fetches all rows to the browser, applies cross-filters in JS, then re-aggregates. Memory and CPU constraints will cause browser freezes.
- Scaling path: Compute cross-filtered KPIs server-side. Send only the cross-filter predicates to the backend; return pre-aggregated scalar results.

## Dependencies at Risk

**Apache Superset as query engine:**
- Risk: Project memory notes Superset is being abandoned for production. The entire query pipeline (QueryEngine, DatabaseRegistrar, DatasetSync) depends on Superset's REST API. Migration is a large effort.
- Impact: Every data query, database registration, and dataset sync breaks without Superset.
- Migration plan: Replace `SupersetClient` calls with direct `oracledb`/`asyncpg` queries. Build a `DirectQueryEngine` that generates SQL and executes against connection pools. Phase out `DatabaseRegistrar` in favor of a config-driven connection manager.

**AG Grid / AG Charts Enterprise:**
- Risk: Enterprise licenses are required for production use. Features like heatmap, treemap, waterfall charts, and advanced grid features depend on Enterprise modules.
- Impact: Without a valid license, enterprise features display watermarks or are disabled.
- Migration plan: Ensure license procurement is tracked. No open-source alternative matches AG Grid's feature set at this scale.

## Missing Critical Features

**Authentication and authorization:**
- Problem: No user identity, no role-based access, no audit trail.
- Blocks: Production deployment, multi-user dashboard sharing, edit permissions, audit compliance.

**Server-side export (PDF/Excel):**
- Problem: Export endpoints are fully stubbed. No Celery worker configured.
- Blocks: Business users cannot export dashboard snapshots for offline review or email distribution.

**Saved views persistence:**
- Problem: In-memory store loses all saved views on restart.
- Blocks: Users cannot bookmark specific filter configurations for quick access.

## Test Coverage Gaps

**No integration tests for dashboard rendering pipeline:**
- What's not tested: The full flow from filter apply -> API call -> data transform -> chart render -> cross-filter interaction.
- Files: `frontend/src/components/dashboard/dashboard-renderer.tsx`, `frontend/src/components/dashboard/config-chart-grid.tsx`
- Risk: Filter/chart/drill interactions are the core user experience. Regressions here are high-impact.
- Priority: High

**No tests for API client key transformation:**
- What's not tested: `transformKeys()` and `DATA_KEYS` skip-set behavior in `api-client.ts`.
- Files: `frontend/src/lib/api-client.ts`
- Risk: Adding a new endpoint with unexpected key casing silently corrupts data.
- Priority: Medium

**No backend endpoint integration tests:**
- What's not tested: Backend tests use mocked `AsyncSession` and `SupersetClient`. No tests verify actual HTTP request/response contracts, status codes, or error payloads.
- Files: `backend/tests/` (all test files mock the database layer)
- Risk: Pydantic model mismatches, missing fields, or incorrect status codes go undetected until manual testing.
- Priority: Medium

**No tests for builder config roundtrip:**
- What's not tested: `buildItemsFromConfig` -> user edits -> `serializeConfig` produces valid, equivalent config.
- Files: `frontend/src/stores/builder-store.ts`, `frontend/src/components/builder/builder-page.tsx`
- Risk: Adding a new dashboard config field without updating both directions causes data loss on save.
- Priority: Medium

**No E2E test coverage for data source management:**
- What's not tested: Create/edit/delete database connections, test connection flow, dataset sync.
- Files: `frontend/src/components/settings/data-source-sheet.tsx`, `backend/app/api/databases.py`
- Risk: The data source sheet (794 lines) has the most complex form state in the app. No automated verification.
- Priority: Low (manual testing covers this during development)

---

*Concerns audit: 2026-04-09*
