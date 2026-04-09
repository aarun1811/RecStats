# Architecture

**Analysis Date:** 2026-04-09

## Pattern Overview

**Overall:** Config-driven dashboard platform with a direct SQL execution engine

**Key Characteristics:**
- Config-driven dashboards: Dashboard layout, charts, KPIs, filters, and grids are defined as JSON configs stored in PostgreSQL JSONB columns. The frontend builder writes configs; the renderer reads them.
- Direct SQL execution: FastAPI backend executes SQL directly against data source databases (Oracle, PostgreSQL) via SQLAlchemy async engines. No intermediate query engine (Superset removed).
- Builder/renderer split: Builder UIs (dashboards, charts, KPIs, datasets) create managed entities via CRUD APIs. Dashboard renderer consumes configs and queries data sources at runtime.
- Three-tier filtering: Global filters (server-side WHERE clauses), cross-filters (client-side row filtering), drill-down (client-side aggregation level navigation + server-side detail fetch).

## Layers

**Frontend Presentation Layer:**
- Purpose: Renders dashboards, builder UIs, SQL explorer, entity libraries, and settings pages
- Location: `frontend/src/`
- Contains: Route pages (`routes/`), components (`components/`), hooks (`hooks/`), stores (`stores/`), types (`types/`), utilities (`lib/`)
- Depends on: FastAPI backend via `frontend/src/lib/api-client.ts`
- Used by: End users via browser

**Frontend State Layer:**
- Purpose: Manages client-side UI state and server data cache
- Location: `frontend/src/stores/` (Zustand), `frontend/src/hooks/` (TanStack Query), `frontend/src/lib/query-client.ts`
- Contains: Filter store (`filter-store.ts`), drill store (`drill-store.ts`), builder store (`builder-store.ts`), layout history store (`layout-history-store.ts`); query/mutation hooks in `hooks/`
- Depends on: API client for server state; pure utility functions for computed state
- Used by: Components via Zustand selectors and TanStack Query hooks

**Backend API Layer:**
- Purpose: HTTP endpoint handlers -- validates input, delegates to services or DB, returns responses
- Location: `backend/app/api/`
- Contains: Route handlers organized by domain: `managed_dashboards.py`, `managed_charts.py`, `managed_kpis.py`, `managed_datasets.py`, `data_sources.py`, `databases.py`, `sql.py`, `search.py`, `export.py`, `views.py`
- Depends on: Service layer, DB session dependency, Pydantic models
- Used by: Frontend API client via HTTP

**Backend Service Layer:**
- Purpose: Encapsulates business logic -- query building/execution, connection management, encryption, data merging, config migration
- Location: `backend/app/services/`
- Contains: `query_engine.py` (QueryExecutor), `engine_manager.py` (EngineManager), `connection_resolver.py` (ConnectionResolver), `connection_status.py` (ConnectionStatusTracker), `config_store.py` (ConfigStore), `merge_engine.py` (MergeEngine), `encryption.py` (EncryptionService), `uri_builder.py`, `query_utils.py`, `config_migrator.py`
- Depends on: SQLAlchemy async engines, RecViz metadata DB
- Used by: API route handlers via FastAPI dependency injection

**Backend Data Layer:**
- Purpose: ORM models and database engine for RecViz metadata (dashboards, charts, KPIs, datasets, data sources, connections)
- Location: `backend/app/db/` (engine, base, models, types), `backend/app/migrations/`
- Contains: SQLAlchemy ORM models in `db/models/`, async engine config in `db/engine.py`, portable JSON type in `db/types.py`, Alembic migrations in `migrations/versions/`
- Depends on: PostgreSQL via asyncpg driver
- Used by: Service and API layers via `DbSessionDep`

**Data Source Databases (External):**
- Purpose: Hold the actual reconciliation data queried at runtime
- Location: External Oracle and PostgreSQL databases (PostgreSQL stands in for Oracle in local dev)
- Contains: Recon data tables queried by data source SQL templates
- Depends on: Nothing within RecViz
- Used by: QueryExecutor via EngineManager (async SQLAlchemy engines)

## Data Flow

**Dashboard View Flow:**

1. User navigates to `/dashboards/:dashboardId` -- route component fetches `ManagedDashboard` from `GET /api/dashboards/managed/:id` via `useManagedDashboard` hook
2. `DashboardRenderer` receives `DashboardConfig` from the managed dashboard's JSONB `config` field
3. `ConfigFilterBar` renders filter controls from `config.filters`, populates options via `GET /api/data-sources/:id/distinct/:column`, user selects values stored in `filter-store.ts`
4. On "Apply", `filter-store.applied` updates trigger TanStack Query refetches for all `['data-source', dataSourceId, filters]` query keys
5. `ConfigKpiRow` fetches KPI data via `useDashboardKpis` hook, which calls `POST /api/data-sources/:id/query` for each KPI's data source
6. `ConfigChartGrid` renders chart panels; each chart fetches data via `useDataSourceQuery` hook calling `POST /api/data-sources/:id/query`
7. Backend `QueryExecutor.execute()` resolves the target database via `ConnectionResolver`, builds SQL from the data source template (injecting filter clauses), executes via `EngineManager` async engine pool
8. Response flows back: `{columns, rows, row_count, truncated}` -> TanStack Query cache -> component renders via AG Charts / ECharts / AG Grid

**Cross-Filter Flow (Client-Side Only):**

1. User clicks a chart segment -- `onChartClick` fires `ChartClickEvent` with `{chartId, column, value}`
2. `filter-store.addCrossFilter()` stores `{sourceChartId, column, value}` in Zustand
3. `CrossFilterBar` renders active cross-filter chips
4. Other charts and grids consume `crossFilters` from the store
5. `applyCrossFilters()` from `frontend/src/lib/cross-filter.ts` filters cached row data client-side (zero network calls)
6. KPIs re-aggregate from filtered rows via `useCrossFilterData` hook
7. No server round-trip -- all filtering operates on TanStack Query cached data

**Drill-Down Flow:**

1. User double-clicks a chart segment -- `onChartDoubleClick` fires
2. `drill-store.drillDown()` pushes a `DrillLevel` onto the chart's drill stack
3. `DrillBreadcrumb` renders navigation breadcrumbs from the drill level stack
4. Chart re-renders with filtered data at the new aggregation level (client-side re-aggregation from cached data)
5. At the deepest drill level, if `drillDetailDataSourceId` is configured, a server-side query fetches detail rows via a separate data source
6. `DrillDetailGrid` renders the detail rows in an AG Grid

**Builder Flow:**

1. User navigates to `/dashboards/new` or `/dashboards/:id/edit`
2. `BuilderPage` initializes `builder-store.ts` -- either empty (`initNew`) or from existing config (`initFromConfig`)
3. User adds charts/KPIs/grids via picker dialogs, configures filters, arranges layout via drag-and-drop (`react-grid-layout`)
4. `builder-store` tracks `items`, `filters`, `isDirty` state; `layout-history-store` provides undo/redo
5. On save, the builder serializes the store state back to a `DashboardConfig` JSON and calls `POST /api/dashboards/managed` (create) or `PUT /api/dashboards/managed/:id` (update)

**SQL Explorer Flow:**

1. User navigates to `/explorer` -- Monaco editor for SQL input, schema browser for table navigation
2. User selects a database connection and writes SQL
3. On execute, `POST /api/sql/execute` with `{sql, database_id, limit}`
4. Backend enforces read-only (allowlist: SELECT/WITH/EXPLAIN only), wraps with pagination, executes via `EngineManager` with 60s timeout
5. Results returned and rendered in AG Grid

**State Management:**
- **Server state**: TanStack Query manages all API data with 5-min stale time, 30-min GC time, 1 retry. Global error handler toasts `ApiError.userMessage` via Sonner. Mutations invalidate related query keys.
- **Filter state**: Zustand `filter-store` holds `values` (current UI state), `applied` (snapshot at last Apply), `locked` (URL-locked filters), and `crossFilters` (chart click selections).
- **Drill state**: Zustand `drill-store` holds per-chart drill level stacks as a `Map<string, PerChartDrill>`.
- **Builder state**: Zustand `builder-store` holds dashboard being edited: `items` (chart/KPI/grid refs with layouts), `filters`, `isDirty`.
- **Layout history**: Zustand `layout-history-store` provides undo/redo for builder canvas layouts (max 50 snapshots).
- **URL state**: Dashboard filters are bidirectionally synced to URL search params via `frontend/src/lib/dashboard-url-state.ts` (`?filter.X=Y`, `?filter.lock=X,Y`, `?hide=filter-bar,toolbar`).

## Key Abstractions

**DashboardConfig:**
- Purpose: Complete dashboard definition -- filters, KPIs, charts, grids, features, layout
- Examples: `frontend/src/types/dashboard-config.ts`, stored in `recviz_dashboards.config` JSONB column
- Pattern: The frontend builder writes this config; the renderer reads it. The backend stores and retrieves it as opaque JSON.

**DataSourceConfig:**
- Purpose: Defines a parameterized SQL query with database routing and filter mappings
- Examples: `backend/app/models/data_source_config.py`, stored in `recviz_data_sources.config` JSONB column
- Pattern: Query templates use `{{filters}}`, `{{values}}`, `{{date_range_clause}}`, `{{column}}` placeholders. `QueryExecutor._build_sql()` resolves them.

**ChartFactory / ChartWrapperProps:**
- Purpose: Unified interface for rendering any chart type, routing to AG Charts or ECharts
- Examples: `frontend/src/components/charts/chart-factory.tsx`, `frontend/src/types/chart.ts`
- Pattern: Factory pattern -- `ChartFactory` inspects `config.vizType`, delegates to `AgChartWrapper` (standard types) or `EChartWrapper` (exotic types: sankey, radar, sunburst, gauge, funnel, graph, parallel). Both expose `ChartRef` for export.

**QueryExecutor:**
- Purpose: Builds SQL from data source config templates, resolves dynamic DB routing, executes queries directly via async engine pool
- Examples: `backend/app/services/query_engine.py`
- Pattern: Stateful service holding `EngineManager`, `ConnectionResolver`, and `ConnectionStatusTracker` references. Per-request `execute()` calls resolve data source -> database -> build SQL -> execute -> format response.

**EngineManager:**
- Purpose: Manages a pool of async SQLAlchemy engines, one per registered database connection
- Examples: `backend/app/services/engine_manager.py`
- Pattern: Lazy engine creation, keyed by connection UUID. Double-checked locking for thread safety. Engines disposed on connection update/delete. Credentials decrypted from `RecvizConnection.encrypted_password` via `EncryptionService`.

**ConnectionResolver:**
- Purpose: Maps logical database names (from data source configs) to connection UUIDs and metadata (dialect, schema)
- Examples: `backend/app/services/connection_resolver.py`
- Pattern: In-memory cache populated from `recviz_connections` table at startup. No passwords cached. Invalidated on connection CRUD operations.

**FastAPI Dependencies:**
- Purpose: Provide request-scoped services to route handlers without boilerplate
- Examples: `backend/app/core/dependencies.py`
- Pattern: `Annotated[Type, Depends(factory)]` types: `DbSessionDep`, `ConfigStoreDep`, `QueryEngineDep`, `EngineManagerDep`, `ConnectionResolverDep`, `ResolvedDataSourceDep`

**ApiError / api client:**
- Purpose: Typed HTTP client with structured error handling and automatic key transformation
- Examples: `frontend/src/lib/api-client.ts`
- Pattern: Single `api` object with `get`, `post`, `put`, `delete` methods. Auto-transforms `snake_case` response keys to `camelCase`, skipping data keys (`rows`, `columns`, `data`, `config`) to preserve DB column names. Non-2xx throws `ApiError` with `status`, `code`, `userMessage`, `detail`.

## Entry Points

**Frontend Application:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads `index.html`, Vite serves bundled JS
- Responsibilities: Registers AG Grid/Charts enterprise modules, mounts React root with `<App />`

**React Root:**
- Location: `frontend/src/App.tsx`
- Triggers: React mount
- Responsibilities: Creates TanStack Router with generated route tree, renders `<RouterProvider>`

**Root Layout:**
- Location: `frontend/src/routes/__root.tsx`
- Triggers: Router initialization
- Responsibilities: Wraps app in `ThemeProvider`, `QueryClientProvider`, `Toaster`, error boundary

**App Layout (Sidebar + Header):**
- Location: `frontend/src/routes/_app.tsx`
- Triggers: Any `/_app/*` route match
- Responsibilities: Renders sidebar, header, animated outlet for page content

**Index Redirect:**
- Location: `frontend/src/routes/index.tsx`
- Triggers: Navigation to `/`
- Responsibilities: Redirects to `/dashboards`

**Embed Route:**
- Location: `frontend/src/routes/embed/dashboards/$dashboardId.tsx`
- Triggers: Navigation to `/embed/dashboards/:id`
- Responsibilities: Renders dashboard without sidebar/header; supports `?theme=`, `?hide=`, `?filter.*`, `?filter.lock`

**FastAPI Application:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --reload`
- Responsibilities: Lifespan initializes `ConnectionStatusTracker`, `EncryptionService`, `EngineManager`, pre-warms engine pool, syncs `ConnectionResolver`, creates `QueryExecutor`. Mounts all API routers. CORS + X-Frame-Options middleware.

**Health Check:**
- Location: `backend/app/main.py` (`GET /health`)
- Triggers: Infrastructure health probes
- Responsibilities: Returns `{"status": "ok"}`

## Error Handling

**Strategy:** Layered error handling with structured errors, sanitization, and user-facing toasts

**Frontend Patterns:**
- `ErrorBoundary` component (`frontend/src/components/shared/error-boundary.tsx`) catches React rendering errors at the route outlet level
- TanStack Query's `QueryCache.onError` shows toast notifications for `ApiError` instances (`frontend/src/lib/query-client.ts`)
- `ApiError` class (`frontend/src/lib/api-client.ts`) parses structured error responses with `status`, `code`, `userMessage`, `detail`, `retryAfter`
- Chart components show skeleton loaders during loading, `ErrorPanel` with retry on failure, "No data available" on empty results
- Non-2xx fetch responses throw `ApiError`; TanStack Query retries once then exposes error to components

**Backend Patterns:**
- Route handlers catch specific exceptions (`ValueError`, `OperationalError`, `DBAPIError`, `TimeoutError`) and map to appropriate HTTP status codes (400, 404, 503, 504)
- `sanitize_detail()` (`backend/app/core/errors.py`) truncates long messages (>500 chars) and redacts connection-string URIs before sending to clients
- `QueryExecutor` marks connections as unreachable in `ConnectionStatusTracker` on execution failures
- DB session dependency (`get_db_session`) auto-commits on success, auto-rollbacks on exception
- SQL Explorer enforces read-only via `validate_read_only()` allowlist (SELECT/WITH/EXPLAIN only)

## Cross-Cutting Concerns

**Validation:**
- Frontend: TypeScript strict mode for compile-time safety. TanStack Router `validateSearch` for URL params.
- Backend: Pydantic v2 models validate all request bodies. `CamelModel` base class auto-generates camelCase aliases. SQLAlchemy models enforce DB constraints.

**Authentication:** Not implemented. No auth on any endpoint. Noted as a critical gap.

**Logging:**
- Frontend: Errors surface via TanStack Query global error handler + Sonner toasts. No structured logging framework.
- Backend: Python `logging` module with `logging.basicConfig(level=logging.INFO)`. Logger created per-module via `logging.getLogger(__name__)`. Used for startup events, connection status, and error context.

**Security:**
- `EncryptionService` (`backend/app/services/encryption.py`) encrypts database passwords at rest using Fernet (AES-128-CBC + HMAC-SHA256)
- `sanitize_detail()` redacts connection URIs from error responses
- SQL Explorer enforces read-only statements
- X-Frame-Options SAMEORIGIN middleware prevents clickjacking
- CORS restricted to development origins

**Data Portability:**
- `PortableJSON` type (`backend/app/db/types.py`) uses JSONB on PostgreSQL and CLOB with JSON serialization on Oracle, enabling migration between databases

---

*Architecture analysis: 2026-04-09*
