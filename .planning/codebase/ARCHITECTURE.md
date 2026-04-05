# Architecture

**Analysis Date:** 2026-04-05

## Pattern Overview

**Overall:** Three-tier headless BI architecture -- React SPA + FastAPI sidecar proxy + Apache Superset (query engine only, no UI exposed)

**Key Characteristics:**
- Config-driven dashboards: JSON configs (stored in PostgreSQL JSONB) define filters, KPIs, charts, grids, and data sources. No code changes needed to add a dashboard.
- Superset is headless: FastAPI proxies all Superset REST API calls. The frontend never talks to Superset directly.
- Two query paths: (1) config-driven via `QueryEngine` (template SQL + filter injection), and (2) legacy direct Superset API passthrough (hardcoded chart definitions).
- Client-side cross-filtering and drill-down: applied via Zustand state + `useMemo` on cached TanStack Query data -- zero additional network calls.

## Layers

**Frontend (React SPA):**
- Purpose: Render dashboards, charts, grids, explorer, and settings UI
- Location: `frontend/src/`
- Contains: Route pages, domain components, Shadcn/ui primitives, hooks, stores, types, utility libs
- Depends on: FastAPI backend (via `fetch` in `lib/api-client.ts`)
- Used by: End users via browser

**Backend (FastAPI Sidecar):**
- Purpose: Proxy Superset API, resolve config-driven queries, merge data sources, manage database registrations
- Location: `backend/app/`
- Contains: API route handlers, Pydantic models, service layer, DB models, config store, Alembic migrations
- Depends on: Superset REST API (via `httpx`), PostgreSQL (via SQLAlchemy async)
- Used by: Frontend SPA

**Query Engine (Apache Superset):**
- Purpose: Execute SQL against Oracle/Hive/PostgreSQL data sources, cache results in Redis
- Location: `superset/` (config only -- installed via pip)
- Contains: `superset_config.py`, Dockerfile, entrypoint script
- Depends on: PostgreSQL (metadata), Redis (cache), Oracle/Hive/PostgreSQL (data)
- Used by: FastAPI backend only

**Infrastructure:**
- Purpose: Docker Compose services for local development
- Location: `docker-compose.yml`, `docker/`
- Contains: PostgreSQL 16, Redis 7, Superset container definitions

## Data Flow

**Dashboard Render Flow (Config-Driven -- primary path):**

1. Route `/_app/dashboards/$dashboardId` mounts `DashboardPage` (`frontend/src/routes/_app/dashboards/$dashboardId.tsx`)
2. `useDashboardConfig(dashboardId)` calls `GET /api/dashboards/{id}` -> `ConfigStore.get_dashboard()` -> reads `recviz_dashboards` JSONB column -> returns `DashboardConfig`
3. `DashboardRenderer` (`frontend/src/components/dashboard/dashboard-renderer.tsx`) initializes filter store with config defaults, renders `ConfigFilterBar` + `ConfigKpiRow` + `ConfigChartGrid` + `ConfigDataGrid`
4. User clicks "Apply" -> filter store `applied` snapshot updates -> TanStack Query re-fetches
5. Each chart's `useDataSourceQuery(dataSourceId, appliedFilters)` calls `POST /api/data-sources/{id}/query`
6. Backend `data_sources.py` resolves data source config via `ResolvedDataSourceDep`, passes to `QueryEngine.execute()`
7. `QueryEngine` resolves database (static or dynamic routing), builds SQL from template + filter mappings, calls `SupersetClient.execute_sql()`
8. Superset executes SQL against the target database, returns rows
9. Frontend transforms response into `ChartDataResponse`, passes through `ChartFactory` -> `AgChartWrapper` or `EChartWrapper`

**KPI Computation Flow:**

1. `useDashboardKpis(dashboardId, appliedFilters)` calls `POST /api/dashboards/{id}/kpis`
2. Backend iterates each KPI config's `sources`, executes queries via `QueryEngine`, sums metric columns
3. Computes trend percentages (percentage_of reference KPI)
4. Returns `KpiResult[]` to frontend `ConfigKpiRow`

**Cross-Filter Flow (client-side only):**

1. User clicks a chart bar/slice -> `ChartFactory` fires `onChartClick` with `{chartId, column, value}`
2. `addCrossFilter()` writes to Zustand `filterStore.crossFilters`
3. Every chart calls `useCrossFilter(chartId, chartData)` which runs `applyCrossFilters()` via `useMemo`
4. `applyCrossFilters()` (`frontend/src/lib/cross-filter.ts`) filters cached rows by matching column values, excluding self-chart
5. KPIs recomputed client-side via `useCrossFilterData` hook -> `recomputeKpis()` (`frontend/src/lib/kpi-aggregator.ts`)
6. Grids apply external filter via `rowPassesCrossFilters()`

**Drill-Down Flow (per-chart, client-side):**

1. User double-clicks a chart element -> `handleChartDoubleClick` fires
2. `useDrillDown(chartId, hierarchy)` pushes `DrillLevel` to `drillStore`
3. `applyDrillFilters()` (`frontend/src/hooks/use-drill-down.ts`) filters cached data by drill levels, re-aggregates by next hierarchy column
4. When at detail level (depth >= hierarchy length), `DrillDetailGrid` mounts with its own `useDataSourceQuery()` call to a separate data source

**Legacy Chart Flow (direct Superset passthrough):**

1. `useChartData(chartId)` calls `POST /api/charts/{id}/data`
2. Backend `charts.py` maps chart slug to hardcoded Superset datasource ID + query definition (`CHART_DATASOURCE_MAP`, `CHART_QUERIES`)
3. Calls `SupersetClient.get_chart_data()` with Superset-native query format
4. Returns transformed rows

**SQL Explorer Flow:**

1. `useSqlExecute()` sends `POST /api/sql/execute` with raw SQL + database_id
2. Backend proxies to `SupersetClient.execute_sql()`
3. Results displayed in AG Grid via `QueryResults` component
4. Optional: "Chart It" opens `ChartBuilderDialog` to visualize results

**Embed Flow:**

1. Route `/embed/dashboards/$dashboardId` renders `EmbedDashboardPage` (`frontend/src/routes/embed/dashboards/$dashboardId.tsx`)
2. Parses `filter.*` and `filter.lock` URL params, passes as `initialFilters` + `lockedFilters` to `DashboardRenderer`
3. Same rendering pipeline as main dashboard, with locked filter controls and minimal chrome (`EmbedTopbar`)

**State Management:**

- **Server state**: TanStack Query manages all API data. Query keys: `['dashboard-config', id]`, `['data-source', id, filters]`, `['dashboard-kpis', id, filters]`
- **Client state**: Zustand stores for filter values (`filter-store.ts`), drill state (`drill-store.ts`), theme (ThemeProvider context)
- **Cross-filter state**: Lives in filter store's `crossFilters` array. Client-side filtering via `useMemo` on cached query data.

## Key Abstractions

**DashboardConfig:**
- Purpose: Complete JSON blueprint for a dashboard: filters, KPIs, charts, grids, features, layout
- Backend model: `backend/app/models/dashboard_config.py` -> `DashboardConfig` (Pydantic, snake_case)
- Frontend type: `frontend/src/types/dashboard-config.ts` -> `DashboardConfig` (camelCase, auto-converted by api-client)
- Storage: `recviz_dashboards.config` JSONB column
- Pattern: Declarative config -> runtime rendering. No hardcoded dashboard logic.

**DataSourceConfig:**
- Purpose: Defines a query template with database routing, filter mappings, and column definitions
- Backend model: `backend/app/models/data_source_config.py` -> `DataSourceConfig`
- Storage: `recviz_data_sources.config` JSONB column
- Pattern: Template SQL with `{{filters}}`, `{{values}}`, `{{date_range_clause}}` placeholders resolved at query time

**QueryEngine:**
- Purpose: Builds final SQL from data source config + runtime filters, resolves database routing, executes via Superset
- Location: `backend/app/services/query_engine.py`
- Pattern: Template resolution -> database resolution -> Superset SQL execution

**DatabaseRegistrar:**
- Purpose: Syncs `databases.json` config into Superset, caches logical name -> Superset numeric ID mapping
- Location: `backend/app/services/database_registrar.py`
- Pattern: Config-declared databases auto-registered in Superset on startup. Lazy refresh on cache miss.

**ConfigStore:**
- Purpose: DB-backed CRUD for dashboard and data source configs
- Location: `backend/app/services/config_store.py`
- Pattern: Session-scoped (per-request), reads JSONB configs, validates through `config_migrator`

**SupersetClient:**
- Purpose: Authenticated async HTTP client for Superset REST API with auto-retry on 401
- Location: `backend/app/services/superset_client.py`
- Pattern: Token management, CSRF token, 25-minute refresh cycle. Singleton on `app.state`.

**ChartFactory:**
- Purpose: Routes chart rendering to AG Charts or ECharts based on `vizType`
- Location: `frontend/src/components/charts/chart-factory.tsx`
- Pattern: AG Charts for standard types (bar, line, area, pie, donut, scatter, heatmap, treemap, waterfall), ECharts for exotic types (sankey, radar, sunburst, gauge, funnel, graph, parallel)

**ApiClient:**
- Purpose: Typed fetch wrapper with snake_case -> camelCase key transformation and structured error handling
- Location: `frontend/src/lib/api-client.ts`
- Pattern: `api.get<T>()` / `api.post<T>()` with automatic `ApiError` throwing on non-2xx. Skips key transformation for `rows` and `columns` keys (contain DB column names).

## Entry Points

**Frontend Entry:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads `index.html`
- Responsibilities: Registers AG Grid/Charts enterprise modules, mounts React app

**Frontend Router Root:**
- Location: `frontend/src/routes/__root.tsx`
- Triggers: Any route navigation
- Responsibilities: Wraps app in `ThemeProvider`, `QueryClientProvider`, `Toaster`

**Frontend App Layout:**
- Location: `frontend/src/routes/_app.tsx`
- Triggers: Any route under `/_app/*`
- Responsibilities: Renders `AppSidebar` + `Header` + animated `Outlet`

**Backend Entry:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --reload`
- Responsibilities: Creates FastAPI app, CORS middleware, lifespan (Superset auth, database sync, QueryEngine init)

**Backend API Router:**
- Location: `backend/app/api/router.py`
- Triggers: Included by `app.main`
- Responsibilities: Aggregates all sub-routers: dashboards, data-sources, databases, charts, datasets, sql, search, custom, export, views

**Superset Config:**
- Location: `superset/superset_config.py`
- Triggers: Superset startup
- Responsibilities: Database URI, Redis cache, secret key, feature flags

## Error Handling

**Strategy:** Structured error objects throughout. Backend returns `{error, message, detail, retry_after}` JSON. Frontend catches via `ApiError` class with typed fields.

**Backend Patterns:**
- Route handlers catch `httpx.ConnectError` -> 503, `httpx.TimeoutException` -> 504, `httpx.HTTPStatusError` -> 502
- `sanitize_detail()` (`backend/app/core/errors.py`) truncates long errors and redacts connection strings
- `ValueError` from QueryEngine/ConfigStore -> 400 Bad Request
- `ResolvedDataSourceDep` (`backend/app/core/dependencies.py`) centralizes 404 for missing data sources

**Frontend Patterns:**
- `ApiError` class (`frontend/src/lib/api-client.ts`) parses structured error bodies, exposes `status`, `code`, `userMessage`, `detail`, `retryAfter`
- `QueryCache.onError` (`frontend/src/lib/query-client.ts`) shows Sonner toast for all query errors
- `ErrorBoundary` component wraps app layout and individual panels
- `ErrorPanel` component (`frontend/src/components/shared/error-panel.tsx`) shows per-chart/per-grid errors with retry button

## Cross-Cutting Concerns

**Logging:**
- Backend: Python `logging` module. `logger.info/warning/error/exception` throughout services and route handlers.
- Frontend: No structured logging. Console only.

**Validation:**
- Backend: Pydantic v2 models validate all request bodies. `BaseSettings` for environment config.
- Frontend: TypeScript strict mode. No runtime validation on API responses (trusts backend shapes after camelCase transform).

**Authentication:**
- Not implemented on RecViz endpoints. No auth middleware.
- Superset auth: username/password login via `SupersetClient.authenticate()`, token managed internally.

**Configuration:**
- Backend: `backend/app/config.py` -> `Settings(BaseSettings)` reads from `.env` file
- Database registration: `backend/app/config/databases.json`
- Dashboard/data source configs: PostgreSQL `recviz_dashboards` and `recviz_data_sources` tables (JSONB)
- Config migration: `backend/app/services/config_migrator.py` with versioned migration pipeline

**Caching:**
- Server: Redis via Superset (query result cache). TanStack Query client-side with 5 min staleTime, 30 min gcTime.
- Cross-filter/drill data: Reuses TanStack Query cache, filtered client-side via `useMemo`.

**Database Migrations:**
- Alembic with async engine support
- Custom version table `recviz_alembic_version` (avoids conflict with Superset's own Alembic)
- Migration files: `backend/app/migrations/versions/`

---

*Architecture analysis: 2026-04-05*
