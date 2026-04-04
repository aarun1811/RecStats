# Codebase Concerns

**Analysis Date:** 2026-04-04

## Tech Debt

**Dual Dashboard Systems (Legacy vs. Config-Driven):**
- Issue: Two parallel dashboard implementations coexist. The legacy system uses hardcoded chart IDs and a `GlobalFilters` interface with fixed fields (`region`, `desk`, `status`, etc.). The config-driven system uses generic `Record<string, FilterValue>` keyed by filter ID. Both reference `useFilterStore` but expect incompatible store shapes.
- Files:
  - Legacy: `frontend/src/components/dashboard/filter-bar.tsx`, `frontend/src/components/dashboard/kpi-row.tsx`, `frontend/src/components/dashboard/chart-grid.tsx`, `frontend/src/hooks/use-kpi-data.ts`, `frontend/src/hooks/use-chart-data.ts`, `frontend/src/hooks/use-breaks-data.ts`
  - Config-driven: `frontend/src/components/dashboard/dashboard-renderer.tsx`, `frontend/src/components/dashboard/config-filter-bar.tsx`, `frontend/src/components/dashboard/config-chart-grid.tsx`, `frontend/src/components/dashboard/config-data-grid.tsx`, `frontend/src/components/dashboard/config-kpi-row.tsx`
  - Shared store: `frontend/src/stores/filter-store.ts`
- Impact: Legacy components reference `s.globalFilters`, `s.updateGlobalFilter`, and `s.resetGlobalFilters` which do not exist on the current `FilterStore` interface (the store exposes `values`, `applied`, `setFilterValue`, `resetFilters`). These legacy components would crash at runtime. The legacy system also uses backend routes (`/api/charts/*`, `/api/custom/kpi`, `/api/datasets/5/data`) that still work but return mock data when Superset is down. The config-driven system uses `/api/dashboards/*` and `/api/data-sources/*` routes that execute real SQL via the QueryEngine.
- Fix approach: Remove the entire legacy dashboard system (filter-bar.tsx, kpi-row.tsx, chart-grid.tsx, chart-panel.tsx, use-kpi-data.ts, use-chart-data.ts, use-breaks-data.ts, use-cross-filter.ts, use-drill-down.ts, cross-filter-bar.tsx, drill-breadcrumb.tsx) and the legacy backend routes (`/api/charts/*`, `/api/custom/kpi`, `/api/datasets/*/data`). Before removal, port the cross-filter and drill-down logic into the config-driven system, which currently lacks these features.

**Pervasive Mock Data Fallback Pattern:**
- Issue: Every backend API route follows a `try: superset_call() except Exception: return MOCK_DATA` pattern. When Superset is unavailable (or any error occurs), the API silently falls back to hardcoded mock data from `backend/app/mock_data.py`. This masks real errors and makes debugging impossible.
- Files: `backend/app/api/charts.py` (lines 137-153, 156-167, 180-212), `backend/app/api/custom.py` (lines 60-131, 134-161, 171-193), `backend/app/api/databases.py` (lines 38-57, 60-79, 82-124, 127-165, 168-199, 202-214, 217-228), `backend/app/api/datasets.py` (lines 15-18, 22-48, 91-130), `backend/app/api/sql.py` (lines 25-69, 77-88), `backend/app/api/search.py` (lines 17-47)
- Impact: Users see stale hardcoded data with no indication that the real data source failed. In production, this would show completely wrong numbers (e.g., always 149,819 total breaks) without any error signal.
- Fix approach: Replace the `except Exception: pass` + mock fallback with proper error handling: return HTTP error codes when Superset fails, let the frontend display error states (which are already built into the config-driven components via TanStack Query error handling). Keep mock data only as an explicit dev mode toggle (e.g., `MOCK_MODE=true` env var).

**In-Memory State for Persistent Data:**
- Issue: Multiple features use in-memory Python dicts/lists for state that should persist: saved views, export jobs, query history, and mock database CRUD.
- Files: `backend/app/api/views.py` (`_views: dict`), `backend/app/api/export.py` (`_jobs: dict`), `backend/app/api/sql.py` (`_query_history: list`), `backend/app/api/databases.py` (`_mock_databases: list`, `_mock_next_id: int`)
- Impact: All saved views, export jobs, and query history are lost on every server restart. The mock database store also uses mutable module-level globals, which are not thread-safe.
- Fix approach: Move persistent state to PostgreSQL or Redis. For query history, Redis with TTL is appropriate. For saved views, use PostgreSQL. For export jobs, use Celery + Redis (already documented as the intended architecture).

**Blanket Exception Swallowing:**
- Issue: 22 instances of bare `except Exception: pass` across backend API routes. Errors are silently swallowed with no logging, no error classification, no user feedback.
- Files: Every file in `backend/app/api/` contains multiple instances. See grep results above.
- Impact: Impossible to diagnose production issues. A typo in a Superset query, a network timeout, a schema mismatch -- all produce the same behavior: silent fallback to mock data.
- Fix approach: At minimum, add `logger.exception()` in every except block. Better: catch specific exceptions (httpx.HTTPStatusError, httpx.TimeoutException, ValueError) and return appropriate HTTP status codes. Remove bare `except Exception: pass`.

**Reports Page is Entirely Fake:**
- Issue: The reports page at `frontend/src/routes/_app/reports/index.tsx` renders hardcoded `MOCK_REPORTS` data with no backend integration. "Generate Now" calls the export API which returns a stub job ID that never completes. Download, pause, delete, and "Schedule Report" buttons are non-functional.
- Files: `frontend/src/routes/_app/reports/index.tsx`, `backend/app/api/export.py`
- Impact: The feature appears functional to users but does nothing. Export jobs are created in memory but never processed.
- Fix approach: Either remove the reports page and mark it as "coming soon", or implement the export pipeline (Celery task queue, WeasyPrint for PDF, openpyxl for Excel) as described in CLAUDE.md.

**Legacy `GlobalFilters` Type Still Referenced:**
- Issue: The type `GlobalFilters` in `frontend/src/types/filter.ts` and the backend model `GlobalFilters` in `backend/app/models/filters.py` represent the legacy fixed-field filter shape (region, desk, status, etc.). The config-driven system uses generic `Record<string, FilterValue>`. Both exist and are used by different parts of the codebase.
- Files: `frontend/src/types/filter.ts`, `backend/app/models/filters.py`, `backend/app/api/charts.py`, `backend/app/api/custom.py`, `backend/app/api/datasets.py`
- Impact: Two incompatible filter type systems. New config-driven dashboards cannot use the legacy chart/KPI endpoints because those expect the old `GlobalFilters` shape.
- Fix approach: Remove legacy `GlobalFilters` type and all routes that depend on it once legacy dashboard components are removed.

## Known Bugs

**Legacy Components Reference Non-Existent Store Properties:**
- Symptoms: `filter-bar.tsx` calls `useFilterStore((s) => s.globalFilters)` and `s.updateGlobalFilter` and `s.resetGlobalFilters`. The current `filter-store.ts` does not export these properties -- it has `values`, `applied`, `setFilterValue`, `resetFilters`. Would produce a runtime crash (undefined property access).
- Files: `frontend/src/components/dashboard/filter-bar.tsx` (lines 58-64), `frontend/src/hooks/use-kpi-data.ts` (line 7), `frontend/src/hooks/use-chart-data.ts` (line 19), `frontend/src/hooks/use-breaks-data.ts` (line 13), `frontend/src/components/dashboard/chart-grid.tsx` (line 55)
- Trigger: Navigating to any route that renders the legacy `FilterBar`, `KpiRow`, or `ChartGrid` components.
- Workaround: These legacy components are not currently rendered by any active route (all dashboard routes use `DashboardRenderer` which uses config-driven components).

**Search Endpoint Always Searches Mock Dashboards and Datasets:**
- Symptoms: The search API searches `MOCK_DASHBOARDS` for dashboards and `MOCK_DATASETS` for datasets regardless of Superset availability. Only chart search attempts to use Superset.
- Files: `backend/app/api/search.py` (lines 23-26, 43-44)
- Trigger: Using the command palette search (Cmd+K).
- Workaround: None. Dashboard search results are always from mock data.

**Dataset List Always Returns Mock:**
- Symptoms: `GET /api/datasets` always returns `MOCK_DATASETS` with a comment "Always return mock datasets with full column info for schema browser". This ignores Superset entirely.
- Files: `backend/app/api/datasets.py` (lines 14-18)
- Trigger: Opening the SQL Explorer schema browser.
- Workaround: None. Schema browser shows fake table/column definitions.

## Security Considerations

**No Authentication on Any Endpoint:**
- Risk: The entire FastAPI backend is unauthenticated. Any user or script with network access can query data, execute SQL, create/delete databases, and export data.
- Files: `backend/app/main.py` (no auth middleware), `backend/app/core/dependencies.py` (no auth dependency)
- Current mitigation: None. CLAUDE.md notes "Auth strategy TBD (will be added later, likely SSO/SAML/OIDC)."
- Recommendations: Implement authentication before any production deployment. At minimum, add a shared API key via middleware for internal use. For production, implement OIDC/SAML with a FastAPI dependency that validates JWT tokens on every request.

**SQL Injection via SQL Explorer:**
- Risk: The SQL Explorer at `POST /api/sql/execute` passes user-provided SQL directly to Superset's SQLLab API, which in turn executes it against the configured database. There is no query sanitization, no allowlisting, no read-only enforcement.
- Files: `backend/app/api/sql.py` (lines 25-69), `backend/app/services/superset_client.py` (lines 137-154)
- Current mitigation: Superset itself may enforce some restrictions depending on role configuration. The mock SQL executor only supports SELECT (line 99). But when Superset is available, any SQL is forwarded.
- Recommendations: Enforce read-only queries (reject anything that isn't SELECT). Add a SQL parser/validator. Implement database-level read-only users. Add query audit logging.

**Hardcoded Default Credentials:**
- Risk: Superset admin credentials are hardcoded as defaults: `superset_username: str = "admin"`, `superset_password: str = "admin"`. Database credentials in docker-compose are also visible (`recviz:recviz_dev`).
- Files: `backend/app/config.py` (lines 7-9), `docker-compose.yml` (lines 5-7)
- Current mitigation: Intended to be overridden by `.env` file, but defaults are dangerous if `.env` is missing.
- Recommendations: Remove default values for sensitive config. Require explicit env vars. Fail fast on startup if credentials are not provided.

**X-Frame-Options ALLOWALL:**
- Risk: The `XFrameOptionsMiddleware` sets `X-Frame-Options: ALLOWALL`, allowing the API to be embedded in iframes from any origin. Combined with no authentication, this enables clickjacking attacks.
- Files: `backend/app/main.py` (lines 77-82)
- Current mitigation: None. Comment says "internal tool, no auth."
- Recommendations: Restrict to known origins or remove the header entirely (rely on CSP instead). At minimum, use `SAMEORIGIN`.

**CORS Allows Multiple Origins with Credentials:**
- Risk: CORS is configured to allow credentials from three origins with wildcard methods and headers. This is fine for dev but must be locked down for production.
- Files: `backend/app/main.py` (lines 68-74)
- Current mitigation: Only allows localhost origins.
- Recommendations: Make CORS origins configurable via environment variable. Remove `allow_credentials=True` unless session cookies are used.

**SQLAlchemy URIs May Contain Passwords in Logs:**
- Risk: The `DatabaseRegistrar.sync()` method creates databases in Superset by passing `sqlalchemy_uri` which contains embedded passwords. These URIs may appear in Superset logs or error messages.
- Files: `backend/app/services/database_registrar.py` (lines 60-68), `backend/app/services/uri_builder.py`
- Current mitigation: Password is URL-encoded via `quote_plus` but still visible in the URI string.
- Recommendations: Use Superset's encrypted credentials feature instead of embedding passwords in URIs.

## Performance Bottlenecks

**Frontend Fetches All Break Rows for Cross-Filter KPI Recomputation:**
- Problem: `use-breaks-data.ts` fetches up to 1000 rows from `/api/datasets/5/data` solely so that `kpi-row.tsx` can recompute KPIs client-side when cross-filters are active.
- Files: `frontend/src/hooks/use-breaks-data.ts`, `frontend/src/components/dashboard/kpi-row.tsx` (lines 11-27, 36-42)
- Cause: Cross-filtering is done entirely client-side. The KPI row needs to re-aggregate filtered data, so it downloads a large dataset.
- Improvement path: Move cross-filter aggregation to the backend. Send the cross-filter context with the KPI query and let the database compute the filtered aggregates.

**ConfigStore Loads All Configs at Startup (Not Reloadable):**
- Problem: `ConfigStore.__init__()` reads all JSON config files once at startup. Adding or modifying a dashboard config requires a full server restart.
- Files: `backend/app/services/config_store.py` (lines 13-30)
- Cause: No file-watching or reload mechanism.
- Improvement path: Add a reload endpoint or file-watcher. Alternatively, implement config versioning with a `last_modified` check.

**N+1 Query Pattern in Config-Driven Charts:**
- Problem: `ConfigChartGrid` renders each chart as a separate `QueryChartItem`, each with its own `useDataSourceQuery` hook. For a dashboard with 6 charts, this means 6 independent API calls + 6 independent SQL queries via Superset.
- Files: `frontend/src/components/dashboard/config-chart-grid.tsx` (lines 47-89), `frontend/src/hooks/use-data-source-query.ts`
- Cause: Each chart independently fetches its own data source.
- Improvement path: Batch data source queries into a single API call per unique data source. Charts sharing the same data source should share the same query response.

## Fragile Areas

**Mock SQL Executor:**
- Files: `backend/app/api/sql.py` (lines 94-148)
- Why fragile: A hand-rolled regex-based SQL parser that handles only `SELECT ... FROM ... WHERE col = 'val' AND ... ORDER BY ... LIMIT`. Does not handle JOINs, subqueries, GROUP BY, HAVING, OR conditions, IN clauses, LIKE, BETWEEN, parentheses, or column aliases.
- Safe modification: Do not extend this mock parser. If real SQL execution is needed, route through Superset (which is the intended path). The mock executor is only useful for demo mode.
- Test coverage: No dedicated tests for the mock SQL executor.

**isMetricColumn Heuristic in Drill-Down:**
- Files: `frontend/src/hooks/use-drill-down.ts` (lines 161-172)
- Why fragile: Determines whether a column is a metric by checking if its lowercase name contains "count", "sum", "avg", "total", "amount", or "rate". This will misclassify columns like "country" (contains "count"), "created_date" (contains "rate" if we add date-rate), or any business-specific column name.
- Safe modification: Replace with explicit metadata from the data source config. Columns should be tagged as dimension/metric in the config.
- Test coverage: No tests.

**Superset Token Refresh Logic:**
- Files: `backend/app/services/superset_client.py` (lines 52-55)
- Why fragile: Uses a simple time-based check (re-auth if token is older than 25 minutes). If the clock skews, or if Superset's token lifetime is configured differently, auth will fail. The retry-on-401 logic (lines 82-86) provides a safety net, but relies on a single retry.
- Safe modification: Add a configurable token lifetime. Consider using refresh tokens if Superset supports them.
- Test coverage: No tests for the SupersetClient.

**Filter Store Shape Mismatch:**
- Files: `frontend/src/stores/filter-store.ts`
- Why fragile: The store was refactored from a legacy `globalFilters: GlobalFilters` shape to a generic `values: Record<string, FilterValue>` shape. But 5 files still reference the old shape. Any code change that accidentally re-enables legacy components will cause runtime crashes.
- Safe modification: Delete legacy components that reference the old shape. Add a TypeScript path alias or module boundary to prevent accidental imports.
- Test coverage: No tests for either store shape.

## Scaling Limits

**In-Memory Mock State:**
- Current capacity: Works for single-user dev. Module-level mutable dicts (`_views`, `_jobs`, `_query_history`, `_mock_databases`) are not shared across workers.
- Limit: Running uvicorn with `--workers > 1` will create independent copies of each in-memory store. Data will be inconsistent across workers.
- Scaling path: Move to Redis or PostgreSQL for all shared state.

**SQLite Seed Database:**
- Current capacity: `backend/app/config/seed/seed.db` is used as a dev data source. SQLite handles single-writer, limited concurrency.
- Limit: Multiple concurrent dashboard queries will contend on the SQLite write lock.
- Scaling path: Use PostgreSQL for dev data (already in docker-compose) or keep SQLite as read-only.

## Dependencies at Risk

**AG Grid / AG Charts Enterprise Licensing:**
- Risk: AG Grid Enterprise (`ag-grid-enterprise@35.0.1`) and AG Charts Enterprise (`ag-charts-enterprise@13.0.1`) are commercial products requiring paid licenses for production use. No license key is configured in the codebase.
- Impact: Watermark/console warnings in production. Potential license violation.
- Migration plan: Obtain commercial licenses, or replace with AG Grid Community + open-source chart library.

**next-themes in Non-Next.js App:**
- Risk: `next-themes@0.4.6` is installed for theme management but this is a Vite + React app, not Next.js. The package may have unnecessary Next.js-specific behavior.
- Impact: Minor -- likely works fine since the core theme logic is framework-agnostic. But it's a confusing dependency.
- Migration plan: Replace with a simple custom theme provider (already partially implemented in `frontend/src/components/layout/theme-provider.tsx`).

**Unpinned apache-superset:**
- Risk: `requirements.txt` specifies `apache-superset` without a version pin. Superset has frequent breaking changes in its REST API.
- Impact: A `pip install` on a different day could pull a different Superset version with incompatible API endpoints.
- Migration plan: Pin to a specific version (e.g., `apache-superset==4.0.0`).

## Missing Critical Features

**No Cross-Filtering in Config-Driven Dashboards:**
- Problem: The config-driven dashboard system (`DashboardRenderer`, `ConfigChartGrid`) has no cross-filter support. The JSON config even has `"cross_filter": false` in the features section. Cross-filter logic exists only in the legacy components (`cross-filter-bar.tsx`, `chart-grid.tsx`, `kpi-row.tsx`, `use-cross-filter.ts`, `lib/cross-filter.ts`).
- Blocks: Interactive drill-down and click-to-filter on config-driven dashboards.

**No Drill-Down in Config-Driven Dashboards:**
- Problem: Same situation as cross-filtering. The `DashboardRenderer` does not use `useDrillStore` or any drill-down mechanism. Drill-down logic lives only in legacy components (`use-drill-down.ts`, `drill-breadcrumb.tsx`, `chart-grid.tsx`).
- Blocks: Multi-level data exploration on config-driven dashboards.

**No Chart Export or Fullscreen:**
- Problem: Individual charts have no export (PNG/SVG) or fullscreen capability in the config-driven system.
- Blocks: Users cannot save or share individual chart images.

**No Real Export Pipeline:**
- Problem: PDF and Excel export are completely stubbed (`backend/app/api/export.py`). The export endpoint creates a job ID in memory but never processes it. Celery is listed in requirements intent but not in `requirements.txt` or any code.
- Blocks: The reports page and any data export functionality.

## Test Coverage Gaps

**Zero Frontend Tests:**
- What's not tested: The entire React frontend has no test files, no test runner configured (no vitest.config, no jest.config), and no test scripts in `package.json`.
- Files: All of `frontend/src/`
- Risk: Any refactoring (especially the filter store shape change) can introduce silent breakage. Component interactions, hooks, and state management are untested.
- Priority: High -- the filter store shape mismatch bug described above would have been caught by even basic tests.

**Backend Tests Cover Only Core Services:**
- What's not tested: API route handlers (all files in `backend/app/api/`), the SupersetClient, the mock SQL executor, the URI builder, all Pydantic models, and the application startup/lifespan.
- Files: `backend/tests/` has 4 test files (393 total lines) covering only `ConfigStore`, `DatabaseRegistrar`, `MergeEngine`, and `QueryEngine._build_sql`.
- Risk: All the mock fallback logic, error handling (or lack thereof), and API response shapes are untested. The SQL injection risk in the SQL executor is untested.
- Priority: High -- route handler tests would catch the silent error swallowing pattern.

**No Integration or E2E Tests:**
- What's not tested: End-to-end flows (frontend -> backend -> Superset -> database). No Playwright, Cypress, or similar framework configured.
- Files: N/A
- Risk: The complex interaction between filter state, API calls, data transformations, and chart rendering is entirely untested.
- Priority: Medium -- unit tests should come first, but E2E tests are needed before production.

---

*Concerns audit: 2026-04-04*
