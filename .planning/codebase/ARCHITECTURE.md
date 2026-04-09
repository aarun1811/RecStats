# Architecture

**Analysis Date:** 2026-04-09

## Pattern Overview

**Overall:** Three-tier SPA with Headless BI Engine

The application follows a React SPA -> FastAPI proxy/sidecar -> Apache Superset (headless query engine) -> Database(s) architecture. Superset is never exposed directly to users; all Superset interactions are proxied through FastAPI. The frontend talks exclusively to the FastAPI backend.

**Key Characteristics:**
- Config-driven dashboards: Dashboard layout, charts, KPIs, filters, and grids are defined as JSON configs stored in PostgreSQL (JSONB columns)
- Superset as headless query engine: Superset handles SQL execution, database connectivity, caching, and dataset management. No Superset UI is exposed.
- FastAPI as both proxy and sidecar: Proxies Superset API calls AND provides its own CRUD endpoints for managed entities (dashboards, charts, KPIs, datasets)
- Builder pattern: Users create/edit dashboards, charts, KPIs, and datasets through wizard-style builder UIs that persist configs to the backend
- Dual data paths: "Data sources" (legacy config-driven queries) and "managed datasets" (Superset virtual datasets) coexist

## Layers

**Presentation Layer (React SPA):**
- Purpose: Renders dashboards, builder UIs, SQL explorer, settings, and library/CRUD pages
- Location: `frontend/src/`
- Contains: Route pages, components, hooks, stores, types, utilities
- Depends on: FastAPI backend (via `api-client.ts`)
- Used by: End users via browser

**State Management Layer (Zustand + TanStack Query):**
- Purpose: Manages client-side state (filters, drills, builder) and server cache
- Location: `frontend/src/stores/` (Zustand), `frontend/src/hooks/` (TanStack Query)
- Contains: Filter store, drill store, builder store, layout history store; query/mutation hooks
- Depends on: API client for server state; pure functions for computed state
- Used by: Components via selectors and hooks

**API Gateway Layer (FastAPI):**
- Purpose: Authenticates to Superset, proxies queries, provides CRUD for managed entities, handles search, export stubs
- Location: `backend/app/api/`
- Contains: Route handlers organized by domain (dashboards, charts, KPIs, datasets, data sources, databases, SQL, search, export, views)
- Depends on: Service layer, DB session, Superset client
- Used by: Frontend API client

**Service Layer (Python):**
- Purpose: Encapsulates business logic - query building/execution, database registration, dataset sync, config migration, data merging
- Location: `backend/app/services/`
- Contains: `superset_client.py`, `query_engine.py`, `database_registrar.py`, `dataset_sync.py`, `config_store.py`, `merge_engine.py`, `connection_status.py`, `config_migrator.py`, `uri_builder.py`
- Depends on: Superset REST API (via httpx), SQLAlchemy async sessions
- Used by: API route handlers via dependency injection

**Persistence Layer:**
- Purpose: Stores RecViz-managed entities (dashboards, charts, KPIs, datasets, data sources) and Superset metadata
- Location: `backend/app/db/` (engine, base, models), `backend/app/migrations/`
- Contains: SQLAlchemy ORM models, async engine config, Alembic migrations
- Depends on: PostgreSQL (asyncpg driver)
- Used by: Service and API layers via `DbSessionDep`

**Query Engine Layer (Superset):**
- Purpose: Executes SQL against configured databases, manages dataset metadata, handles query caching
- Location: `superset/` (config files and Dockerfile)
- Contains: `superset_config.py`, Dockerfile, entrypoint script
- Depends on: PostgreSQL (metadata), Redis (cache), configured data source databases
- Used by: FastAPI backend via `SupersetClient`

## Data Flow

**Dashboard View Flow:**

1. User navigates to `/dashboards/:id` -> `routes/_app/dashboards/$dashboardId.tsx`
2. `useManagedDashboard(id)` hook fetches dashboard config from `GET /api/dashboards/managed/:id`
3. `DashboardRenderer` receives `DashboardConfig` JSON, initializes filter store from config defaults + URL params
4. `ConfigFilterBar` renders filter controls, user selects values, clicks Apply -> filter store `applied` updated
5. `ConfigKpiRow` renders KPI cards: `useDashboardKpis` hook calls `POST /api/data-sources/:id/query` for each KPI source
6. `ConfigChartGrid` renders charts: each chart calls `useDataSourceQuery` -> `POST /api/data-sources/:id/query`
7. Backend `QueryEngine.execute()` resolves database (static/dynamic routing), builds SQL from template + filters, executes via `SupersetClient.execute_sql()`
8. Results flow back: Superset -> FastAPI -> React -> AG Charts/ECharts render

**Cross-Filter Flow (client-side only):**

1. User clicks a chart segment -> `onChartClick` fires `ChartClickEvent`
2. `ConfigChartGrid` calls `filterStore.addCrossFilter({ sourceChartId, column, value })`
3. `useCrossFilter(chartId, data)` hook runs `applyCrossFilters()` on each chart's cached data
4. `useCrossFilterData` re-aggregates KPI values from filtered chart data
5. Zero network calls - all cross-filtering uses already-fetched TanStack Query cache

**Drill-Down Flow:**

1. User double-clicks a chart segment -> `onChartDoubleClick` fires
2. `ConfigChartGrid` calls `drillStore.drillDown(chartId, { column, value, label })`
3. Chart re-queries with additional filter constraints from drill levels
4. `DrillBreadcrumb` renders navigation; clicking a crumb calls `drillStore.drillToLevel()`
5. At detail level, `DrillDetailGrid` fetches from `drillDetailDataSourceId` with accumulated drill filters

**Builder Save Flow:**

1. User arranges panels in `BuilderCanvas` (drag-and-drop grid layout)
2. `BuilderStore` tracks all items (charts, KPIs, grids), filters, name, description
3. On save, `BuilderPage` serializes store into `DashboardConfig` JSON
4. `useCreateDashboard` or `useUpdateDashboard` mutation sends `POST/PUT /api/dashboards/managed`
5. Backend persists entire config as JSONB in `recviz_dashboards` table

**Managed Dataset Flow (with Superset sync):**

1. User creates dataset in Dataset Editor (`/datasets/new`)
2. `POST /api/datasets/managed` creates `RecvizDataset` row in PostgreSQL
3. `DatasetSyncService.sync_dataset()` creates a virtual dataset in Superset via `SupersetClient.create_dataset()`
4. If sync succeeds, `superset_id` is stored; if it fails, `sync_status` = "error"
5. On backend startup, `DatasetSyncService.reconcile()` retries all unsynced datasets

**State Management:**
- **Server state**: TanStack Query manages all API data with 5-min stale time, 30-min GC time. Mutations invalidate related query keys.
- **Filter state**: Zustand `filter-store` holds values, applied snapshot, locked set, and cross-filters. Filters are applied on explicit "Apply" action.
- **Drill state**: Zustand `drill-store` holds per-chart drill level stacks.
- **Builder state**: Zustand `builder-store` holds dashboard layout being edited, with dirty tracking.
- **Layout history**: Zustand `layout-history-store` provides undo/redo for builder canvas layouts.
- **URL state**: Dashboard filters are bidirectionally synced to URL search params via `dashboard-url-state.ts`.

## Key Abstractions

**DashboardConfig (JSON schema):**
- Purpose: Complete dashboard definition - filters, KPIs, charts, grids, features, layout
- Examples: `frontend/src/types/dashboard-config.ts`, stored in `recviz_dashboards.config` JSONB column
- Pattern: The frontend builder writes this config; the renderer reads it. The backend stores and retrieves it as opaque JSON.

**DataSourceConfig (Pydantic model):**
- Purpose: Defines a parameterized SQL query with database routing and filter mappings
- Examples: `backend/app/models/data_source_config.py`, stored in `recviz_data_sources.config` JSONB column
- Pattern: Query templates use `{{filters}}`, `{{values}}`, `{{date_range_clause}}` placeholders. `QueryEngine._build_sql()` resolves them.

**ChartFactory / ChartWrapperProps:**
- Purpose: Unified interface for rendering any chart type, routing to AG Charts or ECharts
- Examples: `frontend/src/components/charts/chart-factory.tsx`, `frontend/src/types/chart.ts`
- Pattern: Factory pattern - `ChartFactory` inspects `config.vizType`, delegates to `AgChartWrapper` or `EChartWrapper`. Both expose `ChartRef` for export.

**SupersetClient:**
- Purpose: Async HTTP client wrapping all Superset REST API calls with auto-authentication and 401 retry
- Examples: `backend/app/services/superset_client.py`
- Pattern: Singleton created in FastAPI lifespan, stored in `app.state.superset`, injected via `SupersetDep`

**QueryEngine:**
- Purpose: Resolves database routing, builds SQL from templates, executes via Superset, tracks connection status
- Examples: `backend/app/services/query_engine.py`
- Pattern: Stateful service (holds registrar + tracker references), per-request `execute()` calls resolve data source -> database -> SQL -> result

**Dependency Injection (FastAPI Depends):**
- Purpose: Provide request-scoped services to route handlers without boilerplate
- Examples: `backend/app/core/dependencies.py`
- Pattern: Annotated types (`DbSessionDep`, `SupersetDep`, `QueryEngineDep`, `ConfigStoreDep`, `ResolvedDataSourceDep`, `DatasetSyncDep`) used as function parameter type hints

## Entry Points

**Frontend SPA:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads `index.html`, Vite serves bundled JS
- Responsibilities: Registers AG Grid/Charts enterprise modules, mounts React root with `<App />`

**React Router Root:**
- Location: `frontend/src/routes/__root.tsx`
- Triggers: Router initialization in `App.tsx`
- Responsibilities: Wraps app in ThemeProvider, QueryClientProvider, Toaster, ErrorBoundary

**App Layout (authenticated shell):**
- Location: `frontend/src/routes/_app.tsx`
- Triggers: Any `/_app/*` route match
- Responsibilities: Renders sidebar, header, animated outlet for page content

**Root Redirect:**
- Location: `frontend/src/routes/index.tsx`
- Triggers: Navigation to `/`
- Responsibilities: Redirects to `/dashboards`

**Embed Route (no sidebar):**
- Location: `frontend/src/routes/embed/dashboards/$dashboardId.tsx`
- Triggers: Navigation to `/embed/dashboards/:id`
- Responsibilities: Renders dashboard without sidebar/header, supports `?theme=`, `?hide=`, `?filter.*`, `?filter.lock`

**FastAPI Application:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --reload`
- Responsibilities: Lifespan initializes Superset client, database registrar, query engine, dataset sync service. Mounts all API routers. CORS + X-Frame-Options middleware.

**Health Check:**
- Location: `backend/app/main.py` (`GET /health`)
- Triggers: Infrastructure health probes
- Responsibilities: Returns `{"status": "ok", "superset": true}`

## Error Handling

**Strategy:** Layered error handling with graceful degradation

**Frontend Patterns:**
- `ErrorBoundary` component (`frontend/src/components/shared/error-boundary.tsx`) catches React rendering errors
- TanStack Query's `QueryCache.onError` shows toast notifications for `ApiError` instances (`frontend/src/lib/query-client.ts`)
- `ApiError` class (`frontend/src/lib/api-client.ts`) parses structured error responses with `status`, `code`, `userMessage`, `detail`, `retryAfter`
- Chart components show skeleton loaders during loading, error panels with retry on failure, "No data available" on empty results
- Non-2xx fetch responses throw `ApiError`; TanStack Query retries once then exposes error to components

**Backend Patterns:**
- Route handlers catch specific exceptions (`ValueError`, `httpx.ConnectError`, `httpx.HTTPStatusError`, `httpx.TimeoutException`) and map to appropriate HTTP status codes
- `sanitize_detail()` (`backend/app/core/errors.py`) truncates long messages and redacts connection-string URIs before sending to clients
- Superset connection failures return 503 with `retry_after` hint
- `QueryEngine._handle_connection_error()` inspects exception types and response bodies to mark databases as unreachable in `ConnectionStatusTracker`
- `DatasetSyncService` treats Superset sync failures as non-blocking (dataset saves succeed; sync retried at startup)
- DB session dependency (`get_db_session`) auto-commits on success, auto-rollbacks on exception

## Cross-Cutting Concerns

**Logging:** Python `logging` module throughout backend. No structured logging framework. Frontend has no logging beyond console.

**Validation:**
- Frontend: TypeScript strict mode for compile-time type safety. Runtime validation via TanStack Router `validateSearch` for URL params.
- Backend: Pydantic v2 models validate all request bodies. `CamelModel` base class provides camelCase alias generation. SQLAlchemy models enforce DB constraints.

**Authentication:** Not implemented. All endpoints are unauthenticated. FastAPI authenticates to Superset using hardcoded admin credentials from config/env vars. Auth strategy TBD (likely SSO/SAML/OIDC).

**Key Transform (API boundary):** The `api-client.ts` automatically converts snake_case response keys to camelCase. The `DATA_KEYS` set (`rows`, `columns`, `data`, `config`) skips key transformation for data payloads containing database column names.

**Config Migration:** `backend/app/services/config_migrator.py` provides a versioned migration pipeline for data source configs stored as JSONB. Currently at schema version 1 with no migrations registered.

---

*Architecture analysis: 2026-04-09*
