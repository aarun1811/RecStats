# Codebase Concerns

**Analysis Date:** 2026-04-05

## Tech Debt

**Legacy hooks reference non-existent store property `globalFilters`:**
- Issue: Three hooks (`use-kpi-data.ts`, `use-chart-data.ts`, `use-breaks-data.ts`) reference `useFilterStore((s) => s.globalFilters)` but the current `filter-store.ts` has no `globalFilters` property. The store was refactored to use `values`/`applied`/`locked` but these hooks were never updated. They are dead code from the pre-config-driven system.
- Files: `frontend/src/hooks/use-kpi-data.ts`, `frontend/src/hooks/use-chart-data.ts`, `frontend/src/hooks/use-breaks-data.ts`
- Impact: These hooks would crash at runtime if invoked. They are currently unused by the active config-driven dashboard system but remain importable. Any developer referencing them will hit an immediate runtime error.
- Fix approach: Delete all three files. The config-driven system uses `use-data-source-query.ts` and `use-dashboard-kpis.ts` instead.

**Legacy prefetch hook targets defunct chart IDs:**
- Issue: `use-prefetch.ts` hardcodes chart IDs like `break-trend`, `breaks-by-category` from the old Superset-direct chart system and calls `/api/custom/kpi` and `/api/charts/{id}/data`. These endpoints still exist but are part of the legacy system, not the active config-driven dashboards.
- Files: `frontend/src/hooks/use-prefetch.ts`
- Impact: Wastes network calls on mount to endpoints the active dashboards do not use. Does not prefetch the actual data needed by config-driven dashboards.
- Fix approach: Either delete the hook or rewrite it to prefetch config-driven dashboard data (dashboard configs + data source queries for the default dashboard).

**Hardcoded Superset datasource IDs in legacy chart endpoint:**
- Issue: `backend/app/api/charts.py` contains `CHART_DATASOURCE_MAP` and `CHART_QUERIES` with hardcoded Superset datasource IDs (3, 4, 5, 6). The config-driven system uses `backend/app/api/data_sources.py` instead and resolves databases dynamically. The `charts.py` endpoints are vestigial.
- Files: `backend/app/api/charts.py`
- Impact: Confusing to maintain two parallel data paths. The legacy endpoints bypass the `QueryEngine` and `DatabaseRegistrar` entirely, going straight to Superset chart data API with hardcoded IDs. If datasets are re-created in Superset, these IDs break.
- Fix approach: Deprecate and remove `charts.py`. All chart data should flow through `data_sources.py` > `QueryEngine`.

**Hardcoded Superset datasource IDs in legacy custom/KPI endpoint:**
- Issue: `backend/app/api/custom.py` hardcodes datasource IDs 5 and 6 for KPI queries, and datasource ID 3 for counterparties. Same problem as `charts.py`.
- Files: `backend/app/api/custom.py`
- Impact: KPIs from the legacy system are computed via 4 separate Superset queries with hardcoded IDs. The config-driven system uses `backend/app/api/dashboards.py` KPI endpoint instead.
- Fix approach: Remove or mark as deprecated. All KPI computation should flow through config-driven `dashboards/{id}/kpis`.

**Hardcoded dataset column definitions:**
- Issue: `backend/app/api/datasets.py` contains `DATASET_COLUMNS` dict mapping dataset ID 5 to a fixed list of 20 column names. This is brittle and specific to one demo dataset.
- Files: `backend/app/api/datasets.py`
- Impact: Only dataset ID 5 returns row-level data. All other dataset IDs return 404. The endpoint is unused by the config-driven system.
- Fix approach: Remove or refactor. Config-driven data sources define columns in their JSON configs.

**Backend tests use old `ConfigStore()` constructor (pre-DB migration):**
- Issue: `test_config_store.py` and `test_query_engine.py` instantiate `ConfigStore()` with no arguments. The current `ConfigStore.__init__` requires an `AsyncSession` argument (DB-backed). These tests will fail.
- Files: `backend/tests/test_config_store.py`, `backend/tests/test_query_engine.py`
- Impact: Backend tests are broken. Cannot run `pytest` successfully.
- Fix approach: Rewrite tests to use async fixtures with a test database session, or mock the session.

**Duplicated error handling boilerplate across API endpoints:**
- Issue: Every endpoint in `charts.py`, `datasets.py`, `sql.py` repeats the same `try/except httpx.ConnectError... httpx.TimeoutException... httpx.HTTPStatusError...` pattern with near-identical error formatting. `custom.py` and `databases.py` partially consolidate via `_handle_httpx_error()` helper but the pattern is inconsistent.
- Files: `backend/app/api/charts.py`, `backend/app/api/datasets.py`, `backend/app/api/sql.py`, `backend/app/api/databases.py`, `backend/app/api/custom.py`
- Impact: ~40 lines of boilerplate per endpoint. Each new endpoint copies the same pattern. Risk of inconsistent error formatting.
- Fix approach: Create a FastAPI exception handler middleware that catches httpx exceptions globally, or use a decorator. Apply `_handle_httpx_error()` pattern from `custom.py`/`databases.py` across all modules.

**`data-source-sheet.tsx` is 769 lines with excessive prop drilling:**
- Issue: The `DataSourceSheet` component passes 20+ individual props to `FormView` and 16 to `DetailView`. Each form field has its own `useState` instead of using a form library or single state object.
- Files: `frontend/src/components/settings/data-source-sheet.tsx`
- Impact: Difficult to add new fields, easy to introduce bugs. Each new form field requires adding useState + prop + handler in 3 places.
- Fix approach: Extract form state into a single object or use `react-hook-form`. Consider splitting `DetailView` and `FormView` into separate files.

## Known Bugs

**In-memory stores lose data on backend restart:**
- Symptoms: SQL query history, saved views, and export job statuses disappear after every `uvicorn` restart.
- Files: `backend/app/api/sql.py` (line 18: `_query_history`), `backend/app/api/views.py` (line 13: `_views`), `backend/app/api/export.py` (line 12: `_jobs`)
- Trigger: Any backend restart (code change with `--reload`, deployment, crash recovery).
- Workaround: None. Data is silently lost.

**Export endpoints are entirely stubbed:**
- Symptoms: `/api/export/pdf` and `/api/export/excel` accept requests and return a `job_id` with status `"pending"`, but no actual export processing ever occurs. The job status never transitions to `"complete"` or `"failed"`.
- Files: `backend/app/api/export.py`
- Trigger: Any user attempting to export a dashboard or chart.
- Workaround: None. Feature is not implemented.

**SQL query history has unbounded growth:**
- Symptoms: `_query_history` list grows without bound during a server session. Every SQL execution inserts a record.
- Files: `backend/app/api/sql.py` (line 18)
- Trigger: Heavy SQL explorer usage during a single server session.
- Workaround: The `get_history` endpoint only returns 50 entries, but memory usage still grows.

## Security Considerations

**No authentication or authorization on any endpoint:**
- Risk: Every API endpoint is publicly accessible. Any user with network access can execute arbitrary SQL, delete databases, view all dashboards, and access all data.
- Files: `backend/app/main.py` (no auth middleware), all route files in `backend/app/api/`
- Current mitigation: None. CORS limits origins to localhost ports only, but that only protects browser-based cross-origin requests, not direct API calls.
- Recommendations: Implement authentication middleware (SSO/SAML/OIDC as noted in CLAUDE.md). Add authorization checks per endpoint. The `config.py` notes auth is TBD.

**SQL injection risk in QueryEngine template rendering:**
- Risk: `QueryEngine._build_sql()` constructs SQL strings via template variable replacement (e.g., `{{values}}`, `{{value}}`, `{{column}}`). Filter values are escaped with single-quote doubling (`str(val).replace("'", "''")`), but column names validated against a whitelist. However, the escaping is minimal -- no parameterized queries.
- Files: `backend/app/services/query_engine.py` (lines 97-131)
- Current mitigation: Column names are validated against `ds.columns` (line 87-93). Single quotes in values are escaped (line 109, 115). The `{{column}}` placeholder validates against allowed columns.
- Recommendations: While the current escaping prevents basic injection, consider moving to parameterized queries via Superset's native filter mechanism instead of string substitution. Add explicit SQL injection tests for edge cases (backslash sequences, unicode, multi-line values).

**Superset credentials in plaintext defaults:**
- Risk: `backend/app/config.py` defaults `superset_username` and `superset_password` to `"admin"/"admin"`. Database connection strings default to `recviz:recviz_dev`.
- Files: `backend/app/config.py`
- Current mitigation: Values can be overridden via `.env` file or environment variables.
- Recommendations: Remove default passwords from code. Require them to be set via environment variables in production. Add startup validation that rejects default credentials.

**CORS allows wildcard methods and headers:**
- Risk: `allow_methods=["*"]` and `allow_headers=["*"]` in CORS config is overly permissive.
- Files: `backend/app/main.py` (lines 65-71)
- Current mitigation: `allow_origins` is limited to three localhost addresses.
- Recommendations: Restrict to actually used methods (`GET`, `POST`, `PUT`, `DELETE`) and specific required headers.

**X-Frame-Options set to ALLOWALL:**
- Risk: Any origin can embed the application in an iframe, enabling potential clickjacking attacks.
- Files: `backend/app/main.py` (lines 74-79, `XFrameOptionsMiddleware`)
- Current mitigation: None. Comment says "internal tool, no auth."
- Recommendations: When auth is added, restrict to `SAMEORIGIN` or specific allowed origins. The embed route (`/embed/dashboards/$dashboardId`) needs iframe support but should be scoped.

**Database connection URIs visible in API responses:**
- Risk: The `sanitize_detail()` function in `core/errors.py` redacts connection strings from error messages, but only for `postgresql://`, `oracle://`, and `hive://`. Other URI schemes (e.g., `sqlite://`, `mysql://`) are not redacted.
- Files: `backend/app/core/errors.py`
- Current mitigation: Partial redaction of three URI schemes.
- Recommendations: Add a generic URI pattern redaction (`\w+://[^\s]+`).

## Performance Bottlenecks

**N+1 query pattern in KPI endpoint:**
- Problem: `backend/app/api/dashboards.py` `get_dashboard_kpis` iterates over each KPI config and each source, executing a separate Superset query for every source. A dashboard with 4 KPIs x 2 sources = 8 sequential Superset queries.
- Files: `backend/app/api/dashboards.py` (lines 53-69)
- Cause: Sequential `for kpi in config.kpis: for source in kpi.sources: await query_engine.execute(...)` with no parallelism.
- Improvement path: Use `asyncio.gather()` to execute all KPI queries concurrently. Group queries by data source ID to deduplicate (multiple KPIs may share the same data source).

**Search endpoint fetches all charts and datasets:**
- Problem: `backend/app/api/search.py` calls `superset.list_charts()` and `superset.list_datasets()` on every search request, then filters client-side by string matching.
- Files: `backend/app/api/search.py` (lines 38-51, 54-68)
- Cause: Superset list endpoints return all items. No server-side filtering or pagination.
- Improvement path: Pass `q` parameter to Superset API for server-side filtering, or cache the chart/dataset lists with a short TTL.

**Database datasets pagination fetches all datasets:**
- Problem: `backend/app/api/databases.py` `list_database_datasets` calls `superset.list_datasets()` (fetching ALL datasets), filters by database ID, then paginates in Python.
- Files: `backend/app/api/databases.py` (lines 114-146)
- Cause: Superset API does not support filtering datasets by database ID directly.
- Improvement path: Cache the full dataset list per database with a short TTL, or pass Superset API query params for filtering.

**No staleTime/gcTime configuration in data source queries:**
- Problem: `use-data-source-query.ts` uses TanStack Query defaults (0ms staleTime) instead of the project convention of 5-minute staleTime. Every re-render or filter application triggers a refetch even for unchanged filter combinations.
- Files: `frontend/src/hooks/use-data-source-query.ts`
- Cause: Missing `staleTime` and `gcTime` configuration.
- Improvement path: Add `staleTime: 5 * 60 * 1000` and `gcTime: 30 * 60 * 1000` per project conventions in CLAUDE.md.

## Fragile Areas

**`config-chart-grid.tsx` (550 lines) -- complex state orchestration:**
- Files: `frontend/src/components/dashboard/config-chart-grid.tsx`
- Why fragile: `QueryChartItemWithDrill` manages 6+ concerns in a single component: data fetching, cross-filtering, drill-down state, fullscreen mode, chart export refs, hover state. It references 3 stores (filter, drill, queryClient) and 5 hooks.
- Safe modification: Extract the data flow logic (fetching + filtering + drilling) into a custom hook `useChartWithDrillData(chart, options)`. Keep the JSX render function thin.
- Test coverage: No unit tests. Only E2E tests via `chart-showcase.spec.ts` with approximate canvas click coordinates.

**AG Chart `buildSeries()` function -- chart type switch exhaustion:**
- Files: `frontend/src/components/charts/ag-chart-wrapper.tsx` (lines 44-193)
- Why fragile: A single switch statement handles 12 chart types. Each branch has subtly different column resolution logic. Adding a new chart type requires understanding all branches. Returns `null` for unsupported types.
- Safe modification: Test any new chart type against the `chart-showcase` dashboard. Verify column resolution with real data, not just unit tests. The `chart-factory.test.tsx` covers type routing but not data mapping.
- Test coverage: `ag-chart-wrapper.test.ts` covers `buildSeries` for some types. Missing coverage for heatmap, treemap, waterfall, scatter, combo.

**ECharts wrapper `buildEChartsOption()` -- parallel structure to AG Charts:**
- Files: `frontend/src/components/charts/echart-wrapper.tsx` (lines 50-226)
- Why fragile: Another switch statement handling 7 ECharts types with subtly different column resolution. Must stay synchronized with AG Charts wrapper conventions for config-driven resolution. No shared abstraction.
- Safe modification: Changes to ECharts wrapper should mirror any convention changes in AG Charts wrapper (category/metric resolution, column validation).
- Test coverage: No unit tests for `buildEChartsOption`.

**Filter store apply/reset lifecycle:**
- Files: `frontend/src/stores/filter-store.ts`, `frontend/src/components/dashboard/dashboard-renderer.tsx`
- Why fragile: The `DashboardRenderer` orchestrates filter initialization, auto-apply, cross-filter clearing, and drill reset across multiple `useEffect` hooks with `hasAutoApplied` ref. The ordering between `initializeFilters`, `applyFilters`, and the auto-apply effect is sequence-sensitive. Changing the dependency arrays or adding a new effect can break the initialization flow.
- Safe modification: Test with dashboards that have default filter values, dashboards with no filters, and embed mode with locked URL filters. Verify the filter bar state after navigation between dashboards.
- Test coverage: `filter-store.test.ts` covers store operations but not the orchestration in `DashboardRenderer`.

**QueryEngine SQL template rendering:**
- Files: `backend/app/services/query_engine.py` (lines 75-133)
- Why fragile: Regex-based template replacement (`{{filters}}`, `{{values}}`, `{{column}}`) is order-dependent. The leftover template cleanup (`re.sub(r"\{\{[^}]+\}\}", "", sql)`) silently removes unmatched placeholders, which can mask configuration errors. Schema prefix stripping uses regex on known schemas which can match unintended table names.
- Safe modification: Always add a corresponding test in `test_query_engine.py` for new filter mappings or template patterns. Verify schema stripping does not affect table names that coincidentally contain schema prefixes.
- Test coverage: `test_query_engine.py` has 9 tests covering SQL building, dialect handling, escaping, and schema stripping. Tests are broken due to `ConfigStore` constructor change (see Tech Debt section).

## Scaling Limits

**In-memory SQL query history:**
- Current capacity: Unbounded list in `_query_history` within a single process.
- Limit: With `--workers N`, each Uvicorn worker has its own history. Heavy usage causes memory growth.
- Scaling path: Move to database-backed storage or Redis. Apply TTL-based cleanup.

**Single Superset auth token shared across all requests:**
- Current capacity: One `SupersetClient` instance with one access token, refreshed every 25 minutes.
- Limit: All concurrent requests share the same token. If re-authentication takes time, concurrent requests may fail with 401. The `_request` method retries on 401 but is not thread-safe against simultaneous re-auth attempts.
- Scaling path: Add token refresh locking (asyncio.Lock is present in `DatabaseRegistrar` but not in `SupersetClient`) or use a token refresh background task.

**Client-side cross-filter re-aggregation:**
- Current capacity: Works well for dashboard datasets under ~10K rows.
- Limit: Cross-filter data layer (`use-cross-filter-data.ts`) fetches full dataset rows client-side and recomputes KPIs in JavaScript. With datasets over 50K rows, this will cause UI lag.
- Scaling path: Move cross-filter recomputation to the backend with filtered queries, or use Web Workers for client-side aggregation.

## Dependencies at Risk

**AG Grid/Charts Enterprise licensing:**
- Risk: AG Grid Enterprise 33 and AG Charts Enterprise 11 are commercial libraries requiring valid licenses. No license keys are configured in the codebase. Development watermarks may appear.
- Impact: Legal risk in production. Watermark overlays on charts and grids.
- Migration plan: Ensure license keys are properly configured before production deployment.

**ECharts `echarts-for-react` wrapper:**
- Risk: `echarts-for-react` is a community wrapper with infrequent updates. The codebase imports `ReactEChartsCore` from `echarts-for-react/lib/core` which is an internal path.
- Impact: May break on ECharts major version updates.
- Migration plan: Use ECharts directly with a thin custom wrapper (the `EChartWrapper` component already handles most of the integration logic).

## Missing Critical Features

**No authentication system:**
- Problem: No user authentication, session management, or authorization exists anywhere in the stack.
- Blocks: Cannot deploy to production. Cannot implement user-specific saved views, audit logging, or role-based dashboard access.

**Export functionality entirely unimplemented:**
- Problem: PDF and Excel export endpoints exist but do nothing. The frontend "Reports" page is a placeholder. Chart-level export (PNG/SVG) works client-side but dashboard-level export does not.
- Blocks: Users cannot generate offline reports, share data snapshots, or meet compliance requirements for data export.

**No rate limiting or request throttling:**
- Problem: No rate limiting on SQL execution, data source queries, or any other endpoint.
- Blocks: A single user executing rapid queries could overwhelm Superset. No protection against accidental or malicious query floods.

## Test Coverage Gaps

**No integration tests for API endpoints:**
- What's not tested: None of the FastAPI route handlers have test coverage. All backend tests are unit tests for individual services (`ConfigStore`, `QueryEngine`, `DatabaseRegistrar`, `MergeEngine`).
- Files: `backend/app/api/*.py` (all route files)
- Risk: API contract changes (request/response shape) go undetected. Middleware interactions (CORS, error handling) are untested.
- Priority: High

**Backend tests are broken (ConfigStore constructor mismatch):**
- What's not tested: `test_config_store.py` and `test_query_engine.py` cannot run because they use the old `ConfigStore()` constructor (no args) but the class now requires `AsyncSession`.
- Files: `backend/tests/test_config_store.py`, `backend/tests/test_query_engine.py`
- Risk: Regressions in config loading and SQL building go undetected.
- Priority: High

**No tests for chart wrappers' data mapping:**
- What's not tested: `buildEChartsOption()` in `echart-wrapper.tsx` has zero test coverage. `buildSeries()` in `ag-chart-wrapper.tsx` has partial coverage (missing heatmap, treemap, waterfall, scatter, combo).
- Files: `frontend/src/components/charts/echart-wrapper.tsx`, `frontend/src/components/charts/ag-chart-wrapper.tsx`
- Risk: Chart rendering silently breaks for specific viz types when column names change. The chart-showcase E2E test validates rendering but not data correctness.
- Priority: Medium

**No tests for DashboardRenderer orchestration:**
- What's not tested: The interaction between filter initialization, auto-apply, cross-filter clearing, and drill reset in `DashboardRenderer`.
- Files: `frontend/src/components/dashboard/dashboard-renderer.tsx`
- Risk: Race conditions or state ordering bugs when navigating between dashboards or applying filters.
- Priority: Medium

**No tests for API client key transformation:**
- What's not tested: `api-client.ts` transforms snake_case response keys to camelCase, with skip logic for `rows` and `columns` keys. No test validates this transformation.
- Files: `frontend/src/lib/api-client.ts`
- Risk: Key transformation bugs cause silent data corruption. The `use-chart-data.ts` `syncColumns` function exists specifically as a workaround for a key transformation edge case.
- Priority: Medium

**E2E tests depend on approximate canvas coordinates:**
- What's not tested: Cross-filter and drill-down E2E tests click on approximate canvas coordinates. If chart data or layout changes, clicks may miss data points entirely.
- Files: `frontend/e2e/chart-showcase.spec.ts` (lines 97-101, 145-147)
- Risk: Tests pass even when interactions fail (the tests check `isVisible` and skip assertions if false). False-passing tests.
- Priority: Low (acceptable for E2E, per test comments)

---

*Concerns audit: 2026-04-05*
