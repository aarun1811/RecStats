# Codebase Concerns

**Analysis Date:** 2026-04-06

## Tech Debt

**Legacy hooks reference non-existent store property:**
- Issue: Three hooks (`use-chart-data.ts`, `use-kpi-data.ts`, `use-breaks-data.ts`) read `s.globalFilters` from the filter store, but the store interface defines `values`, `locked`, and `applied` -- there is no `globalFilters` property. These hooks would crash at runtime with `undefined` returned for every selector read.
- Files: `frontend/src/hooks/use-chart-data.ts`, `frontend/src/hooks/use-kpi-data.ts`, `frontend/src/hooks/use-breaks-data.ts`
- Impact: These hooks are dead code from the legacy dashboard system. They cannot be safely called. Any component importing them will get `undefined` filters, causing queries to fire with no filter context.
- Fix approach: Delete these three hooks. The active config-driven system uses `useDataSourceQuery` (`frontend/src/hooks/use-data-source-query.ts`) and `useDashboardKpis` (`frontend/src/hooks/use-dashboard-kpis.ts`) with the `applied` filter snapshot.

**Legacy prefetch hook targets dead API routes:**
- Issue: `usePrefetch` hardcodes chart IDs (`break-trend`, `breaks-by-category`, etc.) and hits `/api/charts/{chartId}/data` and `/api/custom/kpi`. These are the old Superset-datasource-mapped endpoints from `backend/app/api/charts.py` (the `CHART_DATASOURCE_MAP` and `CHART_QUERIES` dictionaries). The active system uses `/api/data-sources/{id}/query` and `/api/dashboards/{id}/kpis`.
- Files: `frontend/src/hooks/use-prefetch.ts`, `backend/app/api/charts.py`
- Impact: If called, prefetch would fire 7 network requests to the old API that depend on hardcoded Superset dataset IDs (3, 4, 5, 6). These IDs may not exist in a fresh deployment. Wasted bandwidth and potential 404/500 errors on startup.
- Fix approach: Delete `use-prefetch.ts`. If prefetching is desired, implement it in `dashboard-renderer.tsx` using the config-driven data source IDs from the dashboard config.

**Hardcoded Superset dataset IDs in legacy charts API:**
- Issue: `backend/app/api/charts.py` contains `CHART_DATASOURCE_MAP` mapping chart slugs to Superset dataset IDs (`5`, `4`, `6`, `3`). These are fragile numeric IDs assigned during seed setup. They differ per environment.
- Files: `backend/app/api/charts.py` (lines 18-29), `backend/app/api/custom.py` (lines 110, 124, 135, 149, 211)
- Impact: The old charts API and the KPI endpoint (`/api/custom/kpi`) both hardcode dataset IDs. In any non-dev environment, or after re-seeding, these IDs will be wrong, causing silent data mismatches or 404s from Superset.
- Fix approach: The config-driven system already solves this via named databases in `databases.json` resolved through `DatabaseRegistrar`. Migrate the remaining `/api/custom/kpi` endpoint to use config-driven data sources, then delete the old charts router entirely.

**Duplicate `_handle_httpx_error` / `_superset_unavailable` helper functions:**
- Issue: Identical error-handling helper functions are copy-pasted across three API modules: `custom.py`, `databases.py`, and inline in `charts.py` / `sql.py` (expanded into per-exception try/catch blocks with the same pattern).
- Files: `backend/app/api/custom.py` (lines 60-91), `backend/app/api/databases.py` (lines 45-76), `backend/app/api/charts.py` (lines 159-182, 195-223, 267-290), `backend/app/api/sql.py` (lines 63-98, 119-142)
- Impact: Any improvement to error handling (e.g., adding retry headers, changing status codes, adding structured logging) must be replicated in 4+ locations. High risk of inconsistency.
- Fix approach: Move `_handle_httpx_error` and `_superset_unavailable` to `backend/app/core/errors.py` as shared functions. Replace all per-module copies. Consider a FastAPI exception handler middleware that catches `httpx.*` exceptions globally.

**Export system is entirely stubbed:**
- Issue: Both `/api/export/pdf` and `/api/export/excel` endpoints immediately return `{"status": "pending"}` and store the job in an in-memory dict. No actual PDF or Excel generation ever occurs. The job status never transitions from `pending`.
- Files: `backend/app/api/export.py`
- Impact: The frontend export buttons (chart toolbar, grid toolbar) create jobs that will never complete. Users see "pending" forever.
- Fix approach: Implement Celery task workers with WeasyPrint (PDF) and openpyxl (Excel) as specified in the tech stack. Replace the in-memory `_jobs` dict with Redis-backed job tracking.

**In-memory stores lose data on restart:**
- Issue: Three backend services use module-level in-memory dicts/lists that reset on every server restart:
  1. `_query_history` in `sql.py` -- SQL query history (list, capped at 50)
  2. `_jobs` in `export.py` -- export job tracking (dict)
  3. `_views` in `views.py` -- saved views (dict)
- Files: `backend/app/api/sql.py` (line 18), `backend/app/api/export.py` (line 12), `backend/app/api/views.py` (line 13)
- Impact: Users lose all SQL history, pending exports, and saved views on every backend restart. Multi-worker deployments (uvicorn with multiple workers) will have inconsistent state across workers.
- Fix approach: Move saved views to the PostgreSQL database (add SQLAlchemy model + migration). Move query history to Redis with TTL. Move export jobs to Celery result backend (Redis).

**Types barrel export violates convention:**
- Issue: `frontend/src/types/index.ts` re-exports all type modules via `export type *`. The project convention explicitly says "No barrel exports (no index.ts re-exporting everything from a folder)."
- Files: `frontend/src/types/index.ts`
- Impact: Low immediate impact since no component appears to import from `@/types` (all import from specific type files like `@/types/chart`). However, the file's existence invites future barrel imports that slow builds and create circular dependency risks.
- Fix approach: Delete `frontend/src/types/index.ts`.

**React Rules of Hooks violation in AgChartWrapper:**
- Issue: In `ag-chart-wrapper.tsx`, `useRef` (line 367) and `useState` (line 368) are called after conditional early returns (lines 338-364 for missingColumns, isLoading, error, and empty data checks). React hooks must always be called unconditionally and in the same order.
- Files: `frontend/src/components/charts/ag-chart-wrapper.tsx` (lines 367-368)
- Impact: React may produce unpredictable behavior or crash in development mode. The issue is masked because the early return paths are less common, but it is a correctness violation.
- Fix approach: Move the `containerRef` and `containerSize` state declarations to the top of the component, before any early returns (alongside the other `useRef`/`useState` calls on lines 230-231, 246).

## Known Bugs

**`useBreaksData` references nonexistent API endpoint:**
- Symptoms: Calling `useBreaksData` would POST to `/api/datasets/5/data?page=1&page_size=1000`, which does not exist in the router. The actual datasets endpoint is `/api/datasets/managed/{id}` (GET only, no data endpoint). This hook also reads `s.globalFilters` from the store (which does not exist).
- Files: `frontend/src/hooks/use-breaks-data.ts`
- Trigger: Any component importing and calling `useBreaksData()`
- Workaround: Hook is not imported by any active component. It is dead code.

**Reports page shows placeholder only:**
- Symptoms: Navigating to `/reports` shows a static placeholder message ("coming soon") with no actual functionality.
- Files: `frontend/src/routes/_app/reports/index.tsx`
- Trigger: Clicking "Reports" in sidebar navigation
- Workaround: None -- feature not implemented.

## Security Considerations

**No authentication on any endpoint:**
- Risk: Every API endpoint is publicly accessible. Any user with network access to the backend can execute arbitrary SQL, read all dashboard data, create/delete databases, and view all reconciliation data.
- Files: `backend/app/main.py` (no auth middleware), `backend/app/api/sql.py` (raw SQL execution), `backend/app/api/databases.py` (database CRUD)
- Current mitigation: Application is on internal network only. CORS restricts browser origins to localhost ports.
- Recommendations: Implement SSO/SAML/OIDC authentication middleware as noted in `CLAUDE.md` ("Auth strategy TBD"). Add role-based access control -- at minimum, separate read-only (dashboard viewer) from write (SQL executor, database admin) roles. The SQL Lab endpoint is especially dangerous without auth.

**Unrestricted SQL execution endpoint:**
- Risk: `/api/sql/execute` accepts arbitrary SQL strings and forwards them directly to Superset's SQL Lab API. No input validation, no query allowlisting, no statement type restriction (SELECT only). An attacker could execute DDL (DROP TABLE), DML (DELETE/UPDATE), or exfiltrate data.
- Files: `backend/app/api/sql.py` (lines 28-98), `backend/app/services/superset_client.py` (lines 157-174)
- Current mitigation: Superset may have its own query restrictions depending on database permissions. The Superset user is `admin` which typically has full access.
- Recommendations: Add SQL statement validation (allow SELECT only, reject DDL/DML). Implement query timeout limits. Add per-user query audit logging. Consider a query allowlist for production.

**CORS allows wildcard methods and headers:**
- Risk: `allow_methods=["*"]` and `allow_headers=["*"]` is overly permissive. Combined with `allow_credentials=True`, this could enable CSRF-like attacks from whitelisted origins.
- Files: `backend/app/main.py` (lines 85-91)
- Current mitigation: Only localhost origins are allowed. No authentication cookies exist yet.
- Recommendations: Restrict to specific HTTP methods (`GET`, `POST`, `PUT`, `DELETE`) and required headers (`Content-Type`, `Authorization`) once auth is added.

**X-Frame-Options set to ALLOWALL:**
- Risk: Any external page can embed the RecViz backend in an iframe, enabling clickjacking attacks.
- Files: `backend/app/main.py` (lines 94-99)
- Current mitigation: Internal tool with no sensitive actions exposed via UI clicks.
- Recommendations: Switch to `SAMEORIGIN` or use `Content-Security-Policy: frame-ancestors 'self'` to restrict framing to trusted origins only. The embed route (`frontend/src/routes/embed/`) can be whitelisted separately.

**Default credentials in config:**
- Risk: `backend/app/config.py` contains default Superset credentials (`admin`/`admin`) and database connection strings with plaintext passwords. While overridden by `.env` in practice, the defaults are committed to source control.
- Files: `backend/app/config.py` (lines 7-9, 11-12)
- Current mitigation: `.env` file is gitignored. These are only dev defaults.
- Recommendations: Remove default password values. Require explicit env var configuration. Fail fast on startup if critical secrets are missing.

**Credential sanitization is incomplete:**
- Risk: `sanitize_detail()` in `backend/app/core/errors.py` only redacts `postgresql://`, `oracle://`, and `hive://` URI patterns. SQLite, MySQL, MSSQL, and other connection strings would be exposed in error responses.
- Files: `backend/app/core/errors.py` (lines 18-23)
- Current mitigation: PostgreSQL is the only dev database; Oracle/Hive in production.
- Recommendations: Use a generic regex pattern like `\w+://[^\s]+` to redact all URI-format strings.

## Performance Bottlenecks

**Search endpoint fetches all charts and datasets from Superset:**
- Problem: `/api/search` calls `superset.list_charts()` and `superset.list_datasets()` on every search request, then filters client-side with `q in name.lower()`. No pagination, no Superset-side filtering, no caching.
- Files: `backend/app/api/search.py` (lines 34-51, 54-71)
- Cause: Superset's list API returns all records. For a deployment with hundreds of datasets, this is slow and wasteful.
- Improvement path: Use Superset's `q` filter parameter to push search to the server. Cache the full list with a short TTL (30s) if Superset-side search is insufficient. Consider indexing searchable entities in Redis or the sidecar DB.

**Database datasets endpoint loads ALL datasets then filters:**
- Problem: `/api/databases/{db_id}/datasets` calls `superset.list_datasets()` to fetch every dataset in Superset, then filters by `database_id` in Python. With many datasets across many databases, most fetched data is discarded.
- Files: `backend/app/api/databases.py` (lines 136-168)
- Cause: Using Superset's bulk list API without filter parameters.
- Improvement path: Use Superset's query parameter API to filter by `database_id` server-side: `/api/v1/dataset/?q=(filters:!((col:database_id,opr:eq,value:{db_id})))`.

**Cross-filter and drill-down operate on full dataset in memory:**
- Problem: Cross-filtering and drill-down work by filtering the full query response array client-side. For large datasets (10,000+ rows), `applyCrossFilters` and `applyDrillFilters` iterate all rows on every filter change.
- Files: `frontend/src/lib/cross-filter.ts`, `frontend/src/hooks/use-drill-down.ts` (lines 66-140)
- Cause: Design choice to avoid network calls for interactivity. Works well up to ~10K rows.
- Improvement path: For now, this is acceptable per design doc (cross-filters are client-side by spec). If datasets grow beyond 50K rows, add server-side drill-down via the QueryEngine or add Web Worker offloading.

**No query result pagination on config-driven data sources:**
- Problem: `QueryEngine.execute()` fetches up to `DEFAULT_MAX_ROWS = 10_000` rows in a single response. There is no cursor-based pagination for the config-driven data source query API.
- Files: `backend/app/services/query_engine.py` (line 14, lines 199-237), `backend/app/api/data_sources.py` (lines 23-33)
- Cause: Single-query design suitable for aggregated dashboard data. Detail-level drill-down grids may exceed 10K rows.
- Improvement path: Add offset/limit parameters to the query endpoint. The frontend `ConfigDataGrid` already supports client-side pagination (`PAGE_SIZE = 50` in `config-data-grid.tsx`), but server-side pagination would reduce payload size.

## Fragile Areas

**Config-driven dashboard system depends on exact JSON schema:**
- Files: `backend/app/services/config_store.py`, `backend/app/services/config_migrator.py`, `backend/app/models/dashboard_config.py`, `backend/app/models/data_source_config.py`
- Why fragile: Dashboard and data source configs are stored as JSON blobs in PostgreSQL. The `ConfigStore` validates them against Pydantic models on every read. Any schema change that is not backward-compatible will break all existing dashboards. The migration system (`config_migrator.py`) exists but has no registered migrations yet (`CURRENT_SCHEMA_VERSION = 1`).
- Safe modification: Always register a migration in `config_migrator.py` when changing `DashboardConfig` or `DataSourceConfig` Pydantic models. Test migrations against existing JSON configs in seed data.
- Test coverage: `backend/tests/test_config_store.py` exists but does not test schema migration paths.

**AgChartWrapper `buildSeries` function:**
- Files: `frontend/src/components/charts/ag-chart-wrapper.tsx` (lines 44-212)
- Why fragile: Single function mapping 14 chart types to AG Charts series configs. Each branch has different key resolution logic (some use `metricColumns`, some use positional `columns[]`). The fallback chain (`categoryColumn ?? first non-metric ?? columns[0] ?? 'category'`) can produce incorrect mappings if data schema changes.
- Safe modification: Add new chart types as new `case` branches. Always test with real data from the target data source. Run `ag-chart-wrapper.test.ts` after changes.
- Test coverage: `frontend/src/components/charts/ag-chart-wrapper.test.ts` covers `buildSeries` for most types but not edge cases with missing or renamed columns.

**Filter store `applied` snapshot mechanism:**
- Files: `frontend/src/stores/filter-store.ts` (lines 49-53), `frontend/src/components/dashboard/dashboard-renderer.tsx` (lines 86-94)
- Why fragile: The filter system uses a two-phase pattern: `values` (staging) and `applied` (committed). The `DashboardRenderer` has special auto-apply logic (lines 87-94) that triggers once when filters auto-fill. If this auto-apply fires at the wrong time (before filter options load), charts may fetch with incomplete filters.
- Safe modification: Test filter initialization flow with dependent filters (where filter B's options depend on filter A's value). Verify the `hasAutoApplied` ref prevents double-apply.
- Test coverage: `frontend/src/stores/filter-store.test.ts` tests basic store operations but not the auto-apply timing in `DashboardRenderer`.

**QueryEngine SQL template expansion:**
- Files: `backend/app/services/query_engine.py` (lines 105-163)
- Why fragile: Builds SQL from template strings with `{{filters}}`, `{{values}}`, `{{column}}` placeholders. Uses regex cleanup (`re.sub(r"\{\{[^}]+\}\}", "", sql)`) to strip unmatched templates. A typo in the template (e.g., `{{filtes}}`) would silently produce a query with extra template text.
- Safe modification: Add validation that no `{{...}}` markers remain after expansion. Log the final SQL at debug level. Run `backend/tests/test_query_engine.py` which covers template expansion.
- Test coverage: `backend/tests/test_query_engine.py` covers basic template expansion but does not test malformed templates or the regex cleanup path.

## Scaling Limits

**Single Superset auth token shared across all requests:**
- Current capacity: All backend requests share one `SupersetClient` instance with one JWT token. Token refresh happens when the token is >25 minutes old.
- Limit: Under high concurrency, multiple requests may simultaneously detect an expired token and race to re-authenticate. The `ensure_authenticated` method has no lock, so multiple concurrent requests could trigger redundant auth calls.
- Scaling path: Add an asyncio lock around token refresh. Consider a background task that refreshes the token proactively before expiry.

**In-memory query history unbounded under concurrent use:**
- Current capacity: `_query_history` list grows unbounded (only capped at 50 on read via `[:50]`). Each entry is appended at position 0 (`insert(0, record)`).
- Limit: Under sustained SQL Lab usage, memory grows linearly. `list.insert(0, ...)` is O(n) for large lists.
- Scaling path: Use `collections.deque(maxlen=50)` for bounded in-memory history, or move to Redis/PostgreSQL.

## Dependencies at Risk

**AG Grid / AG Charts Enterprise license:**
- Risk: AG Grid Enterprise 33 and AG Charts Enterprise 11 are commercial products requiring per-developer licenses. The codebase imports `ag-charts-enterprise` and `ag-grid-enterprise` without visible license key configuration.
- Impact: Charts and grids may show watermarks or restrict features in production without valid license keys.
- Migration plan: Ensure enterprise license keys are configured via environment variables. AG Grid Community is a fallback for grid-only features but loses advanced filtering, Excel export, and row grouping.

**Apache Superset as headless engine:**
- Risk: Superset is used purely as a query engine but is a full-featured BI platform with its own release cadence, breaking API changes, and dependency conflicts. The `SupersetClient` relies on undocumented API behavior (e.g., the `/api/v1/chart/data` payload shape).
- Impact: Superset version upgrades may break the query pipeline silently. The REST API is not versioned with stability guarantees.
- Migration plan: Pin Superset version in Docker. Add integration tests that verify query payload/response shapes against the actual Superset instance. Consider abstracting query execution behind an interface that could swap Superset for direct SQLAlchemy.

## Missing Critical Features

**No authentication or authorization:**
- Problem: No user identity, no session management, no role-based access control.
- Blocks: Production deployment, audit logging, per-user saved views, dashboard ownership.

**No PDF/Excel export:**
- Problem: Export endpoints are stubs that never produce files.
- Blocks: Scheduled reporting, on-demand data export, compliance report generation.

**No Elasticsearch integration:**
- Problem: The architecture specifies Elasticsearch for search/realtime data, but no ES client, service, or endpoint exists.
- Blocks: Real-time break monitoring, full-text search across reconciliation records.

**No Celery task infrastructure:**
- Problem: Celery is in the tech stack but not configured. No `celery_app.py`, no worker entrypoint, no task definitions.
- Blocks: Background export jobs, scheduled report generation, async query execution for large datasets.

## Test Coverage Gaps

**No tests for API route handlers:**
- What's not tested: All FastAPI route handlers (`backend/app/api/*.py`) -- 12 router modules with ~50 endpoints total. No integration or unit tests for request validation, error responses, or response shapes.
- Files: `backend/app/api/charts.py`, `backend/app/api/custom.py`, `backend/app/api/dashboards.py`, `backend/app/api/databases.py`, `backend/app/api/data_sources.py`, `backend/app/api/export.py`, `backend/app/api/search.py`, `backend/app/api/sql.py`, `backend/app/api/views.py`, `backend/app/api/managed_charts.py`, `backend/app/api/managed_datasets.py`
- Risk: API contract changes (response shapes, status codes, error formats) go undetected. The frontend depends on exact response shapes via `api-client.ts` key transformation.
- Priority: High -- API contract stability is critical for frontend/backend decoupling.

**No tests for dashboard or chart rendering components:**
- What's not tested: `config-chart-grid.tsx` (550 lines), `dashboard-renderer.tsx`, `config-filter-bar.tsx`, `config-kpi-row.tsx`, `config-data-grid.tsx` -- the entire dashboard rendering pipeline.
- Files: All `frontend/src/components/dashboard/*.tsx` except `grid-toolbar.test.tsx`
- Risk: Cross-filter integration, drill-down behavior, KPI re-aggregation, and conditional grid visibility could regress silently.
- Priority: High -- these components contain the core user-facing logic.

**No tests for EChartWrapper or exotic chart types:**
- What's not tested: `echart-wrapper.tsx` (389 lines) including `buildEChartsOption` for all 7 EChart types (sankey, radar, sunburst, gauge, funnel, graph, parallel).
- Files: `frontend/src/components/charts/echart-wrapper.tsx`
- Risk: EChart option generation could produce invalid configs for edge-case data shapes (empty arrays, missing columns, numeric category keys).
- Priority: Medium -- ECharts are used for exotic chart types only, lower usage frequency.

**No E2E tests:**
- What's not tested: Full user flows (load dashboard, apply filters, see charts update, drill down, export).
- Files: No Playwright or Cypress test files exist outside of the Vitest config exclusion pattern.
- Risk: Integration issues between frontend, backend, and Superset are only caught manually.
- Priority: Medium -- the project has Playwright available but no test suite.

**Backend services tested in isolation only:**
- What's not tested: The interaction between `QueryEngine`, `DatabaseRegistrar`, `ConfigStore`, and `SupersetClient` under realistic conditions. Tests use mocks exclusively.
- Files: `backend/tests/test_query_engine.py`, `backend/tests/test_database_registrar.py`, `backend/tests/test_config_store.py`
- Risk: Mocking can mask real API behavior (e.g., Superset returning unexpected shapes, database registrar cache inconsistencies).
- Priority: Low for now (unit tests cover business logic), but integration tests needed before production.

---

*Concerns audit: 2026-04-06*
