# Codebase Concerns

**Analysis Date:** 2026-04-09

## Tech Debt

**In-Memory Stores (Export, Views, SQL History):**
- Issue: Three API modules use volatile in-memory dicts instead of database storage. Data is lost on every process restart. The export system is entirely stubbed (no actual PDF/Excel generation occurs).
- Files: `backend/app/api/export.py`, `backend/app/api/views.py`, `backend/app/api/sql.py` (lines 32-35)
- Impact: Export endpoints accept requests but never produce files. Saved views vanish on restart. SQL history is per-worker and not shared across uvicorn workers. Users cannot rely on any of these features in production.
- Fix approach: Migrate `_views` and `_query_history` to `recviz_*` tables in PostgreSQL. Implement actual PDF generation (WeasyPrint or Playwright) and Excel generation (openpyxl) behind the export endpoints. Add a Celery task queue or background tasks for async export jobs.

**Reports Page Is a Placeholder:**
- Issue: The entire reports page is a static "coming soon" message with no functionality.
- Files: `frontend/src/routes/_app/reports/index.tsx`
- Impact: Navigation link exists in the sidebar but leads to a dead-end. Users see an unfinished feature.
- Fix approach: Either implement scheduled export/report generation or remove the route and sidebar link until ready.

**No-op Dataset Sync Endpoint:**
- Issue: `POST /api/databases/{db_id}/sync` returns a hardcoded success response with `dataset_count: 0`. It was preserved for API compatibility after Superset removal but does nothing.
- Files: `backend/app/api/databases.py` (lines 306-309)
- Impact: Frontend code calling this endpoint gets misleading success responses. Dead code that confuses maintainers.
- Fix approach: Either implement real schema introspection (query `information_schema` or Oracle `ALL_TAB_COLUMNS`) or remove the endpoint and update any frontend callers.

**Backward Compatibility Alias:**
- Issue: `QueryEngine = QueryExecutor` alias at module bottom exists solely for old import paths.
- Files: `backend/app/services/query_engine.py` (line 271)
- Impact: Minor confusion. Two names for the same class in the codebase.
- Fix approach: Grep for `QueryEngine` imports, update them to `QueryExecutor`, and remove the alias.

**Expose In SQLLab Field:**
- Issue: `_build_response()` hardcodes `"expose_in_sqllab": True` -- a Superset-era field that no longer has meaning since Superset was removed.
- Files: `backend/app/api/databases.py` (line 59)
- Impact: Misleading API response field. Frontend may still reference it.
- Fix approach: Remove the field from the response and any frontend code that reads it.

**Client-Side KPI Aggregation:**
- Issue: KPI values are computed entirely in the browser by fetching raw data source rows and aggregating in JavaScript. This works but scales poorly -- for millions of rows, the browser must download and iterate over all of them.
- Files: `frontend/src/hooks/use-dashboard-kpis.ts`
- Impact: Performance degrades linearly with data volume. For MIN/MAX aggregations, the code does a double scan (first sums, then re-scans). Memory pressure on large datasets.
- Fix approach: Add a backend `POST /api/kpis/compute` endpoint that runs aggregate SQL (`SELECT SUM/AVG/COUNT/MIN/MAX(col) FROM ...`) and returns scalar values. Keep client-side as fallback for small datasets.

## Known Bugs

**SQL Explorer Missing Database ID:**
- Symptoms: The SQL execute mutation in the explorer sends `{ sql }` but omits `database_id`. The backend requires a valid connection UUID in `body.database_id`.
- Files: `frontend/src/routes/_app/explorer/index.tsx` (line 33), `backend/app/api/sql.py` (line 47: `database_id: str = ""`)
- Trigger: Run any query in the SQL Explorer without selecting a database first.
- Workaround: The backend defaults to `""` which will fail with a 404 "Database connection '' not found". User must select a database.

**DashboardRenderer ESLint Suppression Hints at Stale Closure:**
- Symptoms: Multiple `// eslint-disable-line react-hooks/exhaustive-deps` suppressions in the dashboard renderer suggest dependencies are intentionally omitted from effect arrays.
- Files: `frontend/src/components/dashboard/dashboard-renderer.tsx` (lines 80, 104, 143)
- Trigger: If the omitted deps change, effects may use stale references. The `handleRefresh` callback references `reset` (from useAutoRefresh) but omits it from deps.
- Workaround: Currently works because the omitted deps are stable, but fragile if code is refactored.

## Security Considerations

**No Authentication or Authorization:**
- Risk: Every API endpoint is completely unauthenticated. Any network-reachable client can read, create, update, and delete dashboards, datasets, database connections (including encrypted credentials), and execute arbitrary read-only SQL against data sources.
- Files: `backend/app/main.py` (no auth middleware), `backend/app/api/router.py` (all routers included without auth guards)
- Current mitigation: Application is on a private network. CORS restricts browser origins to localhost ports. `X-Frame-Options: SAMEORIGIN` prevents clickjacking.
- Recommendations: Implement SSO/SAML/OIDC authentication middleware. Add role-based authorization (viewer vs. editor vs. admin). Protect sensitive endpoints (database CRUD, SQL execution) with elevated permissions. This is the single highest-priority security gap.

**CORS Hardcoded to Localhost Origins:**
- Risk: CORS `allow_origins` only lists three localhost ports. Production deployment will fail CORS preflight checks unless updated.
- Files: `backend/app/main.py` (lines 81)
- Current mitigation: Works for local development.
- Recommendations: Make CORS origins configurable via environment variable (`RECVIZ_CORS_ORIGINS`). For production, restrict to the actual deployment hostname.

**SQL Injection Surface in Query Templates:**
- Risk: `_build_sql()` constructs SQL via string interpolation on filter values. While single quotes are escaped (`chr(39)*2`), the approach is inherently fragile. Template placeholders (`{{filters}}`, `{{values}}`, `{{date_range_clause}}`) are replaced via string substitution, not parameterized queries.
- Files: `backend/app/services/query_engine.py` (lines 104-165)
- Current mitigation: Single-quote escaping for filter values. `validate_read_only()` for SQL Explorer. Column name regex validation for `{{column}}` placeholder.
- Recommendations: Migrate to SQLAlchemy parameterized queries where possible. For complex templates, use a proper SQL builder. Ensure data source database users have minimal read-only permissions (defense in depth).

**Database Passwords Sent in Plaintext Over HTTP:**
- Risk: `DatabaseCreate` and `TestConnectionRequest` models accept plaintext passwords in the request body. If the FastAPI server is not behind HTTPS, passwords transit in cleartext.
- Files: `backend/app/models/database.py` (lines 18, 29, 49), `backend/app/api/databases.py` (line 164)
- Current mitigation: Passwords are encrypted at rest via Fernet before storage in the database. In transit: no TLS configured at the application level.
- Recommendations: Ensure Nginx/reverse proxy terminates TLS in production. Consider never accepting raw passwords in API -- use a secrets vault or reference-based credential injection.

**SQL Explorer Read-Only Enforcement Is Regex-Based:**
- Risk: `validate_read_only()` uses a regex allowlist to verify SQL starts with SELECT/WITH/EXPLAIN. While it also rejects semicolons (preventing multi-statement attacks), sophisticated SQL injection or database-specific DML syntax could bypass regex parsing.
- Files: `backend/app/services/query_utils.py` (lines 164-191)
- Current mitigation: Defense in depth note in the code -- "the database user should also have read-only permissions."
- Recommendations: Ensure production database connections use read-only database accounts. The regex is a good first layer but should not be the only protection.

## Performance Bottlenecks

**Full Dataset Download for Every Chart:**
- Problem: Each chart fetches its entire data source result set (up to 10,000 rows) even when the chart only needs aggregated summary data. Multiple charts sharing the same data source trigger separate queries.
- Files: `backend/app/services/query_engine.py` (line 33: `DEFAULT_MAX_ROWS = 10_000`), `frontend/src/hooks/use-data-source-query.ts`
- Cause: TanStack Query deduplicates by `['data-source', dataSourceId, filters]`, so charts with the same data source and filters share a cache entry. However, charts with different data sources each fetch 10K rows independently.
- Improvement path: Add server-side aggregation endpoints that return pre-computed summaries. For the current architecture, the 10K row limit prevents catastrophic payloads, but still transfers far more data than a chart needs.

**Cross-Filter Re-Aggregation Is O(n) Per Chart:**
- Problem: When cross-filters change, every chart re-filters its entire dataset client-side via `applyCrossFilters()`. For dashboards with many charts and large datasets, this creates a cascade of `useMemo` recalculations.
- Files: `frontend/src/lib/cross-filter.ts`, `frontend/src/hooks/use-cross-filter.ts`
- Cause: Each chart runs its own filter pass over the data array. No indexing or pre-computed filter structures.
- Improvement path: For large datasets, consider pre-building column indexes (Map<value, rowIndices>) once when data arrives, then intersect index sets on cross-filter change. For typical dashboard sizes (<10K rows), current approach is acceptable.

**Chart Theme Resolution Creates DOM Elements:**
- Problem: `cssColorToHex()` creates and appends a temporary DOM element for every CSS color resolution, which triggers layout reflow.
- Files: `frontend/src/lib/chart-themes.ts` (lines 33-46)
- Cause: Needed to resolve oklch/hsl CSS colors to hex for chart libraries that don't support CSS color functions.
- Improvement path: Cache resolved colors in a Map keyed by the CSS variable value. Only create DOM elements on cache miss or theme change.

## Fragile Areas

**Dashboard Config Shape Is Unvalidated on Backend:**
- Files: `backend/app/services/config_store.py` (line 15: "no Pydantic validation, because the shape is defined by the frontend builder and is evolving"), `backend/app/db/models/dashboard.py` (line 17: `config: Mapped[dict]` -- raw JSONB)
- Why fragile: Dashboard configs are stored as opaque JSONB. The backend performs zero validation on the config structure. A malformed config from the builder or a direct API call will be saved silently and crash the frontend renderer.
- Safe modification: Always validate `DashboardConfig` shape on write (POST/PUT) using the frontend type definition as a Pydantic model. Add a `schema_version` migration path.
- Test coverage: No backend tests validate dashboard config structure. Frontend type `DashboardConfig` in `frontend/src/types/dashboard-config.ts` defines the expected shape but it's not enforced server-side.

**Data Source Config Migration:**
- Files: `backend/app/services/config_migrator.py`, `backend/app/services/config_store.py` (line 26: `migrate_config(row.config)`)
- Why fragile: Data source configs pass through a migration function on every read. If migration logic has a bug or doesn't handle a new field, every data source query breaks.
- Safe modification: Write migration tests for every config version transition. Add version tracking to detect unapplied migrations.
- Test coverage: No dedicated tests for `config_migrator.py` found.

**Builder Store updateItemConfig Uses Partial Spread:**
- Files: `frontend/src/stores/builder-store.ts` (lines 168-184)
- Why fragile: `updateItemConfig` accepts `Partial<BuilderChartRef> | Partial<BuilderKpiRef> | Partial<BuilderGridRef>` and spreads it into the current config. Type narrowing is based on `item.type`, but the `updates` parameter is a union type -- TypeScript cannot guarantee the updates match the item type at the call site.
- Safe modification: Use discriminated union or overloaded function signatures to ensure chart updates only apply to chart items.
- Test coverage: No unit tests for builder store mutations.

**Config-Chart-Grid Is a 551-Line Component:**
- Files: `frontend/src/components/dashboard/config-chart-grid.tsx` (551 lines)
- Why fragile: Contains three inner components (`QueryChartItemWithDrill`, `KpiValuesChartItem`, `ChartItemSkeleton`) plus the main `ConfigChartGrid`. Heavy hook usage (useDataSourceQuery, useCrossFilter, useDrillDown) in `QueryChartItemWithDrill` means refactoring requires understanding all interaction states.
- Safe modification: Extract `QueryChartItemWithDrill` and `KpiValuesChartItem` to separate files. Each has distinct data-fetching patterns and can be tested independently.
- Test coverage: No direct tests for this component.

**Data-Source-Sheet Is the Largest Component (794 Lines):**
- Files: `frontend/src/components/settings/data-source-sheet.tsx` (794 lines)
- Why fragile: Manages create/edit/detail modes, connection testing, dataset listing, form state, and validation all in one component. High cyclomatic complexity.
- Safe modification: Split into `DataSourceCreateForm`, `DataSourceEditForm`, and `DataSourceDetail` components composed within the sheet.
- Test coverage: No tests found.

## Scaling Limits

**In-Memory Connection Status Tracker:**
- Current capacity: Works for single-process deployment.
- Limit: Status data is not shared across workers. With multiple uvicorn workers, each has its own status tracker. Status resets on every restart.
- Files: `backend/app/services/connection_status.py`
- Scaling path: For multi-worker: persist status to Redis or the metadata database. For single-worker: current approach is fine.

**In-Memory SQL History (200 Entries):**
- Current capacity: 200 most recent queries per worker.
- Limit: Lost on restart. Not shared across workers. No pagination.
- Files: `backend/app/api/sql.py` (lines 32-42)
- Scaling path: Persist to `recviz_query_history` table. Add pagination and user scoping (when auth is added).

**Engine Pool Per Connection:**
- Current capacity: Each database connection gets a pool of 5+10 (pool_size + max_overflow = 15 max connections).
- Limit: With N registered databases, the backend can hold up to 15*N database connections open. For 20+ databases, this is 300+ connections -- may hit database server limits.
- Files: `backend/app/services/engine_manager.py` (lines 22-28: `DEFAULT_POOL_KWARGS`)
- Scaling path: Reduce `pool_size` for infrequently-used databases. Add idle engine disposal (dispose engines not used in X minutes). Monitor connection counts.

## Dependencies at Risk

**AG Grid / AG Charts Enterprise Licensing:**
- Risk: Enterprise features require valid license keys. The codebase imports `AllEnterpriseModule` in `frontend/src/main.tsx`. Without a license, AG Grid watermarks appear and enterprise features (row grouping, pivoting, charts) may be restricted.
- Impact: Production deployment without license = degraded UI with watermarks.
- Migration plan: Ensure license keys are provisioned for production. Alternatively, evaluate open-source alternatives if licensing becomes an issue.

**next-themes in Non-Next.js App:**
- Risk: `next-themes` (0.4.6) is designed for Next.js but used here in a Vite/React SPA. While it works (it's framework-agnostic at runtime), it receives updates targeting Next.js features and may diverge.
- Files: `frontend/src/components/layout/theme-provider.tsx`
- Impact: Low immediate risk. Future versions may add Next.js-specific APIs that don't work in Vite.
- Migration plan: If breakage occurs, replace with a lightweight custom ThemeProvider (~30 lines) that toggles the `dark` class on `<html>`.

## Missing Critical Features

**Authentication / Authorization:**
- Problem: No auth exists anywhere in the stack. Every endpoint is public.
- Blocks: Production deployment, multi-user features (user-specific saved views, audit trails), role-based access control.

**Export (PDF/Excel):**
- Problem: Export endpoints are stubbed. They accept requests, return fake job IDs, but never produce files.
- Files: `backend/app/api/export.py`
- Blocks: Users cannot generate reports, export dashboards, or share offline artifacts.

**Saved Views Persistence:**
- Problem: Saved filter views use an in-memory dict and vanish on restart.
- Files: `backend/app/api/views.py`
- Blocks: Users cannot save and recall dashboard filter configurations reliably.

## Test Coverage Gaps

**Frontend Component Tests (Critical Gap):**
- What's not tested: Dashboard renderer, config-chart-grid, config-filter-bar, config-data-grid, config-kpi-row, builder pages, settings pages, explorer pages -- essentially all UI components that compose the application.
- Files: All components in `frontend/src/components/dashboard/`, `frontend/src/components/builder/`, `frontend/src/components/settings/`, `frontend/src/components/explorer/`
- Risk: Regressions in data flow (filter -> query -> render -> cross-filter -> drill) go undetected. 17 test files exist for 214 source files (~8% coverage by file count).
- Priority: High -- the dashboard rendering pipeline is the core product surface.

**Backend API Integration Tests Are Mock-Heavy:**
- What's not tested: Real database interactions. All 19 backend test files use mock/fixture-based testing with `httpx.AsyncClient` and patched services.
- Files: `backend/tests/` (19 test files)
- Risk: Tests pass but real queries, connection pooling, and migration behavior are untested. Schema changes in PostgreSQL/Oracle could break queries silently.
- Priority: Medium -- the mock tests do validate API contract and error handling well. Real integration tests require a test database.

**No Tests for Config Migrator:**
- What's not tested: `config_migrator.py` -- the service that migrates data source configs between versions.
- Files: `backend/app/services/config_migrator.py`
- Risk: A migration bug corrupts all data source configs on read, breaking every dashboard query.
- Priority: High -- this is on the critical path for every data source query.

**No Tests for Builder Store:**
- What's not tested: `builder-store.ts` -- 213 lines of complex state management (add/remove items, update layouts, filter CRUD, undo/redo integration).
- Files: `frontend/src/stores/builder-store.ts`
- Risk: Builder saves malformed dashboard configs that crash the renderer. Layout calculations (KPI row offsets, chart positioning) are untested.
- Priority: Medium -- builder is used less frequently than viewer, but bugs here corrupt dashboard configs.

**No E2E Tests for Core Flows:**
- What's not tested: Playwright config exists (`frontend/playwright.config.ts`) and an `e2e/` directory exists, but no end-to-end tests cover the critical user journey: open dashboard -> apply filters -> view charts -> cross-filter -> drill down.
- Files: `frontend/e2e/`
- Risk: Full-stack regressions (frontend + backend + database) are caught only by manual testing.
- Priority: Medium -- unit and integration tests cover individual layers, but the glue between them is untested.

---

*Concerns audit: 2026-04-09*
