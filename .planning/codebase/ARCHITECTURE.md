# Architecture

**Analysis Date:** 2026-04-04

## Pattern Overview

**Overall:** Three-tier architecture with a React SPA frontend, a FastAPI sidecar backend, and Apache Superset as a headless BI query engine. The backend acts as both a proxy to Superset and a sidecar providing custom endpoints (config, merge, export, search). Dashboards are defined by JSON configuration files, not hardcoded.

**Key Characteristics:**
- Config-driven dashboards: JSON files define filters, KPIs, charts, and grids
- Headless Superset: Superset runs as a query engine only; no Superset UI is exposed to users
- Frontend never talks to Superset directly; all queries proxy through FastAPI
- Two data flow paths: config-driven (active) and legacy hardcoded (dead code)
- Client-side state split: server data in TanStack Query, UI state in Zustand stores
- Mock fallbacks: every backend endpoint falls back to mock data when Superset is unavailable

## Layers

**Presentation Layer (React SPA):**
- Purpose: Renders dashboards, data explorer, reports, and settings UI
- Location: `frontend/src/`
- Contains: Route pages, UI components, chart wrappers, AG Grid wrappers
- Depends on: FastAPI backend via `frontend/src/lib/api-client.ts`
- Used by: End users via browser

**State Management Layer:**
- Purpose: Manages filter values, cross-filter selections, and drill-down state
- Location: `frontend/src/stores/`
- Contains: Zustand stores (`filter-store.ts`, `drill-store.ts`)
- Depends on: Nothing (pure client state)
- Used by: Dashboard components, hooks

**Data Fetching Layer (Hooks):**
- Purpose: Wraps TanStack Query to fetch and cache server data
- Location: `frontend/src/hooks/`
- Contains: Custom hooks (`use-dashboard-config.ts`, `use-data-source-query.ts`, `use-dashboard-kpis.ts`, `use-filter-options.ts`, `use-data-source-merge.ts`, `use-chart-data.ts`, etc.)
- Depends on: API client (`frontend/src/lib/api-client.ts`), Zustand stores
- Used by: Presentation components

**API Layer (FastAPI Route Handlers):**
- Purpose: HTTP endpoints for the frontend; thin handlers that validate and delegate
- Location: `backend/app/api/`
- Contains: Route modules (`dashboards.py`, `data_sources.py`, `charts.py`, `sql.py`, `databases.py`, `export.py`, `search.py`, `custom.py`, `views.py`)
- Depends on: Services layer via FastAPI dependency injection
- Used by: Frontend API client

**Service Layer (FastAPI):**
- Purpose: Business logic, Superset communication, config loading, query building
- Location: `backend/app/services/`
- Contains: `superset_client.py`, `query_engine.py`, `config_store.py`, `database_registrar.py`, `merge_engine.py`, `uri_builder.py`
- Depends on: Superset REST API, JSON config files
- Used by: API route handlers

**Model Layer (Pydantic):**
- Purpose: Request/response validation and configuration schemas
- Location: `backend/app/models/`
- Contains: `dashboard_config.py`, `data_source_config.py`, `database_config.py`, `filters.py`, `chart_data.py`, `database.py`, `dataset.py`, `export.py`, `views.py`, `base.py`
- Depends on: Pydantic v2
- Used by: API handlers, services, config loading

**Configuration Layer:**
- Purpose: JSON files defining dashboards, data sources, and database connections
- Location: `backend/app/config/`
- Contains: `dashboards/*.json`, `data_sources/*.json`, `databases.json`, `seed/seed.db`
- Depends on: Nothing (static files)
- Used by: `ConfigStore` and `DatabaseRegistrar` services

**Query Engine (Superset):**
- Purpose: Executes SQL against connected databases, provides caching and result formatting
- Location: `superset/` (config only; Superset itself is a pip install / Docker container)
- Contains: `superset_config.py`, `superset_config_local.py`, Dockerfile
- Depends on: PostgreSQL (metadata), Redis (cache), connected data sources (Oracle/SQLite/etc.)
- Used by: `SupersetClient` service

## Data Flow

**Config-Driven Dashboard Load:**

1. User navigates to `/dashboards/$dashboardId`
2. Route component (`frontend/src/routes/_app/dashboards/$dashboardId.tsx`) calls `useDashboardConfig(dashboardId)`
3. Hook fetches `GET /api/dashboards/{id}` -> `ConfigStore.get_dashboard()` returns JSON config
4. `DashboardRenderer` (`frontend/src/components/dashboard/dashboard-renderer.tsx`) receives config
5. Initializes filter store with config defaults, renders `ConfigFilterBar`, `ConfigKpiRow`, `ConfigChartGrid`, `ConfigDataGrid`
6. Each section independently fetches its data using applied filters from Zustand

**KPI Data Flow:**

1. `ConfigKpiRow` reads `applied` filters from `useFilterStore`
2. Calls `useDashboardKpis(dashboardId, appliedFilters)` -> `POST /api/dashboards/{id}/kpis`
3. Backend iterates KPI config sources, calls `QueryEngine.execute()` for each data source
4. `QueryEngine` resolves database (static or dynamic routing), builds SQL from template + filters
5. Executes SQL via `SupersetClient.execute_sql()` -> Superset REST API -> actual database
6. Results aggregated, trends computed, returned as `KpiResponse`

**Chart Data Flow:**

1. `ConfigChartGrid` renders each chart; `QueryChartItem` reads applied filters from store
2. Calls `useDataSourceQuery(dataSourceId, appliedFilters)` -> `POST /api/data-sources/{id}/query`
3. Backend calls `QueryEngine.execute()` (same path as KPIs)
4. Response mapped to `ChartDataResponse`, passed to `ChartFactory`
5. `ChartFactory` (`frontend/src/components/charts/chart-factory.tsx`) routes to `AgChartWrapper` or `EChartWrapper` based on viz type

**Filter Options (Cascading):**

1. `ConfigFilterBar` renders `FilterControl` for each filter in config
2. Filters with `optionsSource` call `useFilterOptions()` -> `GET /api/data-sources/{id}/distinct/{column}?filter.*=...`
3. Backend calls `QueryEngine.execute_distinct()` with parent filter values
4. Returns distinct values for the column, filtered by parent selections
5. `dependsOn` in config drives cascading: child filter re-fetches when parent value changes

**Grid Data Flow (Single Source):**

1. `SingleSourceGrid` in `ConfigDataGrid` calls `useDataSourceQuery(grid.dataSourceId, appliedFilters)`
2. Same backend path as charts -> `QueryEngine.execute()` -> Superset SQL Lab
3. Row data passed directly to `AgGridReact`

**Grid Data Flow (Merged Sources):**

1. `MergedSourceGrid` calls `useDataSourceMerge()` -> `POST /api/data-sources/merge`
2. Backend fetches each source via `QueryEngine.execute()`, then `MergeEngine.merge()` joins results
3. Merge supports `outer_join` and `inner_join` on specified key columns
4. Combined row data passed to `AgGridReact`

**Embed Dashboard Flow:**

1. External system iframes `/embed/dashboards/$dashboardId?filter.x=val&filter.lock=x&theme=dark`
2. Route (`frontend/src/routes/embed/dashboards/$dashboardId.tsx`) parses URL params
3. Passes `initialFilters` and `lockedFilters` to `DashboardRenderer`
4. Locked filters cannot be changed by the user (read-only in filter bar)
5. Minimal chrome: `EmbedTopbar` replaces full sidebar/header layout

**SQL Explorer Flow:**

1. User writes SQL in Monaco editor (`frontend/src/components/explorer/sql-editor.tsx`)
2. Executes via `useSqlExecute()` -> `POST /api/sql/execute`
3. Backend proxies to `SupersetClient.execute_sql()` or falls back to mock SQL parser
4. Results displayed in `QueryResults` AG Grid or visualized via `ChartBuilderDialog`

**State Management:**
- **Server state**: TanStack Query caches all API responses; `staleTime: 5min`, `gcTime: 30min`
- **Filter state**: Zustand `filter-store` holds `values` (current), `applied` (last committed), and `locked` (URL-pinned); components read `applied` for data queries
- **Drill state**: Zustand `drill-store` holds breadcrumb stack of drill levels (currently unused in config-driven dashboards)
- **Cross-filter state**: Zustand `filter-store.crossFilters[]` + `frontend/src/lib/cross-filter.ts` client-side filtering (currently unused in config-driven dashboards)

## Key Abstractions

**DashboardConfig:**
- Purpose: Complete specification for a dashboard -- filters, KPIs, charts, grids, layout, features
- Examples: `backend/app/config/dashboards/tlm-stats.json`
- Pattern: JSON config validated by Pydantic model `backend/app/models/dashboard_config.py`, mirrored in TypeScript `frontend/src/types/dashboard-config.ts`

**DataSourceConfig:**
- Purpose: Defines a queryable data source with SQL template, filter mappings, database routing, and column definitions
- Examples: `backend/app/config/data_sources/tlm_automatch.json`, `backend/app/config/data_sources/tlm_breaks.json`
- Pattern: SQL template with `{{filters}}` and `{{values}}` placeholders replaced at query time by `QueryEngine._build_sql()`

**DatabaseEntry / DatabaseRegistrar:**
- Purpose: Logical-to-physical database mapping; registers databases in Superset and resolves names to Superset IDs
- Examples: `backend/app/config/databases.json`
- Pattern: On startup, syncs `databases.json` entries into Superset. At query time, resolves logical name -> Superset numeric ID via cache with refresh

**QueryEngine:**
- Purpose: Central query orchestration -- resolves database, builds SQL from templates, executes via Superset
- Examples: `backend/app/services/query_engine.py`
- Pattern: Template SQL + filter mappings + dynamic/static database routing + dialect-aware date functions

**ChartFactory:**
- Purpose: Routes chart rendering to the correct wrapper (AG Charts vs ECharts) based on viz type
- Examples: `frontend/src/components/charts/chart-factory.tsx`
- Pattern: Set-based dispatch; `ECHART_TYPES` set contains exotic types, everything else goes to AG Charts

**ConfigStore:**
- Purpose: In-memory registry of all dashboard and data source configs loaded from JSON files
- Examples: `backend/app/services/config_store.py`
- Pattern: Loads all JSON from `backend/app/config/dashboards/` and `backend/app/config/data_sources/` at startup, keyed by ID

## Entry Points

**Frontend Entry:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads `index.html`
- Responsibilities: Registers AG Grid/Charts modules, renders React root with `<App />`, which creates TanStack Router

**Root Route:**
- Location: `frontend/src/routes/__root.tsx`
- Triggers: Every page load
- Responsibilities: Provides `ThemeProvider`, `QueryClientProvider`, `Toaster`, `ReactQueryDevtools`

**App Layout Route:**
- Location: `frontend/src/routes/_app.tsx`
- Triggers: All pages under `/_app/*` (dashboards, explorer, reports, settings)
- Responsibilities: Renders sidebar (`AppSidebar`), header (`Header`), and animated `Outlet`

**Root Redirect:**
- Location: `frontend/src/routes/index.tsx`
- Triggers: Navigating to `/`
- Responsibilities: Redirects to `/dashboards`

**Backend Entry:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --reload`
- Responsibilities: Creates FastAPI app, configures CORS, registers all API routers, manages lifespan (creates httpx client, authenticates to Superset, loads configs, syncs databases, creates QueryEngine)

**API Router Aggregator:**
- Location: `backend/app/api/router.py`
- Triggers: Included by `main.py`
- Responsibilities: Aggregates all 10 route modules into single `api_router`

**Health Check:**
- Location: `backend/app/main.py` (line 90)
- Triggers: `GET /health`
- Responsibilities: Returns `{"status": "ok", "superset": True}`

## Error Handling

**Strategy:** Fail gracefully with mock data fallbacks on the backend; React error boundaries on the frontend.

**Patterns:**
- Backend API handlers wrap Superset calls in try/except and return mock data on failure (see `backend/app/api/charts.py`, `backend/app/api/sql.py`, `backend/app/api/databases.py`)
- `QueryEngine` raises `ValueError` for config/routing errors; API handlers convert to `HTTPException(400)`
- `SupersetClient` auto-retries on 401 (re-authenticates and retries the request)
- Frontend `ErrorBoundary` (`frontend/src/components/shared/error-boundary.tsx`) catches React rendering errors
- TanStack Query handles fetch errors with `retry: 1` default
- `api-client.ts` throws `ApiError` on non-2xx responses; TanStack Query surfaces these to components

## Cross-Cutting Concerns

**Logging:**
- Backend: Python `logging` module; `logging.basicConfig(level=logging.INFO)` in `backend/app/main.py`
- Frontend: No structured logging; console only

**Validation:**
- Backend: Pydantic v2 models for all request bodies and config files
- Frontend: TypeScript interfaces mirror backend models; `api-client.ts` auto-transforms snake_case keys to camelCase

**Authentication:**
- Backend-to-Superset: username/password auth via Superset REST API with JWT token (auto-refresh on expiry/401) in `backend/app/services/superset_client.py`
- User-to-RecViz: No authentication implemented. All endpoints are open.

**Caching:**
- Superset: Redis-backed query cache (`superset/superset_config.py`), data cache, and filter state cache
- Frontend: TanStack Query in-memory cache with 5min stale, 30min GC (`frontend/src/lib/query-client.ts`)
- Backend: `DatabaseRegistrar` caches name->ID mappings in memory with 30-second TTL refresh

**CORS:**
- Backend: `CORSMiddleware` allows `localhost:5173`, `localhost:3000`, `localhost:4200` (`backend/app/main.py`)
- Superset: CORS configured to allow `localhost:5173` and `localhost:8000` (`superset/superset_config.py`)

**Embed Security:**
- `X-Frame-Options: ALLOWALL` header set by `XFrameOptionsMiddleware` in `backend/app/main.py` to allow iframe embedding

## Two Dashboard Systems (Legacy vs Config-Driven)

**Config-Driven (ACTIVE):**
- Components: `dashboard-renderer.tsx`, `config-filter-bar.tsx`, `config-kpi-row.tsx`, `config-chart-grid.tsx`, `config-data-grid.tsx`
- API routes: `/api/dashboards/*`, `/api/data-sources/*`
- Services: `ConfigStore`, `QueryEngine`, `MergeEngine`, `DatabaseRegistrar`
- Data: JSON config files in `backend/app/config/`

**Legacy (DEAD CODE):**
- Components: `filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx`, `chart-panel.tsx`, `cross-filter-bar.tsx`, `drill-breadcrumb.tsx`
- API routes: `/api/charts/*`, `/api/custom/*`
- Hooks: `use-chart-data.ts`, `use-kpi-data.ts`, `use-breaks-data.ts`, `use-cross-filter.ts`, `use-drill-down.ts`
- Note: Contains cross-filter and drill-down logic missing from config-driven system; references `globalFilters` shape not used by config-driven filter store

---

*Architecture analysis: 2026-04-04*
