# Architecture

**Analysis Date:** 2026-04-11

## Pattern Overview

**Overall:** Config-driven 3-tier web application. A React SPA consumes a FastAPI backend which executes SQL directly against external Oracle/PostgreSQL databases via SQLAlchemy. Dashboards, charts, KPIs, datasets, and data sources are persisted as JSONB configs in a PostgreSQL metadata database (`recviz_*` tables), not as hand-coded modules.

**Key Characteristics:**
- **Config-driven rendering** — Dashboards are JSON blobs; the frontend reads the config and instantiates filter bars, KPI rows, chart grids, and data grids at runtime (`frontend/src/components/dashboard/dashboard-renderer.tsx`).
- **Direct SQL execution (post-Superset)** — FastAPI uses `QueryExecutor` + `EngineManager` to hit Oracle/PostgreSQL directly. Superset has been removed from the runtime path (see `backend/app/services/query_engine.py` docstring and memory note "Superset ditched").
- **Sync-threadpool backend** — FastAPI route handlers are plain `def` (not `async def`). Startup runs in a `lifespan` context and blocks briefly; per-request work runs in the FastAPI threadpool. The change was made because `python-oracledb` async is thin-mode only and many Oracle environments require thick mode (`backend/app/db/engine.py` docstring).
- **camelCase at the boundary** — Backend Pydantic models subclass `CamelModel` (`backend/app/models/base.py`), which aliases all fields to camelCase on the wire. The frontend API client performs an additional `snake_case` → `camelCase` key transform on response bodies (`frontend/src/lib/api-client.ts`), skipping `rows`, `columns`, `data`, and `config` so DB column names are preserved.
- **Two parallel dashboard systems** — Config-driven (`config-*.tsx` components, active) coexists with a legacy hardcoded system (`filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx`, dead code). The legacy system references a defunct store shape and would crash at runtime but contains cross-filter / drill-down logic patterns that were partially migrated.
- **Known architectural gap** — The post-Superset chart renderer still routes chart data through `POST /api/data-sources/{id}/query` and reads `recviz_data_sources` rows, but the new "managed dataset" pipeline writes to `recviz_datasets` instead. See CONCERNS.md for the broken dashboard pipeline.

## Layers

**React SPA (Frontend):**
- Purpose: All user-facing UI — dashboard viewing, dashboard/chart/KPI/dataset builders, SQL explorer, settings, embedded dashboards
- Location: `frontend/src/`
- Contains: File-based routes, page components, Shadcn UI primitives, Zustand stores, TanStack Query hooks, chart wrappers, builder flows
- Depends on: FastAPI backend via `frontend/src/lib/api-client.ts`
- Used by: End users via browser (Vite dev server in dev; static files served by FastAPI in prod — `backend/app/main.py` mounts `frontend/dist/`)

**Client State Layer (Zustand):**
- Purpose: Holds UI-only state (filters, drill stack, builder canvas, layout history)
- Location: `frontend/src/stores/`
- Contains: `filter-store.ts`, `drill-store.ts`, `builder-store.ts`, `layout-history-store.ts`
- Depends on: Nothing (pure Zustand); receives data from components
- Used by: Components via hook-based selectors
- Rule: Server data NEVER lives in Zustand — that is TanStack Query's job.

**Server State Layer (TanStack Query):**
- Purpose: Fetches, caches, invalidates, and re-fetches all server data
- Location: `frontend/src/hooks/` (query/mutation hooks), `frontend/src/lib/query-client.ts` (global config)
- Contains: `use-data-source-query.ts`, `use-managed-dashboards.ts`, `use-managed-charts.ts`, `use-managed-kpis.ts`, `use-managed-datasets.ts`, `use-databases.ts`, `use-dashboard-kpis.ts`, `use-drill-detail.ts`, `use-filter-options.ts`, `use-search.ts`, `use-saved-views.ts`, `use-sql-execute.ts`, `use-sql-history.ts`, `use-table-columns.ts`, `use-tables.ts`, `use-data-source-merge.ts`, `use-cross-filter-data.ts`, `use-cross-filter.ts`, `use-drill-down.ts`
- Depends on: `api-client.ts` and TanStack Query
- Used by: Dashboard renderer, builder pages, explorer pages, library pages
- Defaults: `staleTime: 5min`, `gcTime: 30min`, `retry: 1`, `refetchOnWindowFocus: false`; a global `QueryCache.onError` posts `ApiError.userMessage` toasts via Sonner.

**API Layer (FastAPI routers):**
- Purpose: HTTP surface for the frontend — CRUD for managed entities, SQL explorer, search, data source queries, database registration
- Location: `backend/app/api/`
- Contains: One router per domain — `managed_dashboards.py`, `managed_charts.py`, `managed_kpis.py`, `managed_datasets.py`, `data_sources.py`, `databases.py`, `sql.py`, `search.py`, `views.py`
- Aggregator: `backend/app/api/router.py` `include_router`s all domain routers into a single `api_router`; `backend/app/main.py` mounts that router onto the FastAPI app.
- Depends on: Service layer and DB session (via `Depends()`)
- Used by: Frontend `api-client.ts`
- Convention: Route handlers are thin — validate input, call service or run simple CRUD queries, map exceptions to HTTPException, return Pydantic response.

**Service Layer:**
- Purpose: Encapsulates business logic — query building and execution, connection/engine management, dataset config resolution, config migration, result merging, encryption
- Location: `backend/app/services/`
- Contains:
  - `query_engine.py` — `QueryExecutor` (aliased as `QueryEngine` for backcompat). Builds SQL from data-source config templates, resolves dynamic DB routing, and executes via `EngineManager`.
  - `engine_manager.py` — `EngineManager`. Manages one sync SQLAlchemy `Engine` per registered connection (keyed by connection UUID) with a pool of 5 + 10 overflow. Decrypts passwords on engine creation and enforces per-query timeouts via `oracledb.call_timeout` (Oracle) or `statement_timeout` (PostgreSQL).
  - `connection_resolver.py` — `ConnectionResolver`. Caches logical-name → connection-UUID + dialect + schema in memory. Synced at startup and after connection CRUD.
  - `connection_status.py` — `ConnectionStatusTracker`. In-memory status map (connected / unreachable) refreshed by query execution outcomes and a startup health-check sweep.
  - `config_store.py` — `ConfigStore`. Session-scoped accessor for `recviz_data_sources` rows, running `config_migrator.migrate_config` on read.
  - `config_migrator.py` — Migrates legacy data source config shapes.
  - `merge_engine.py` — `MergeEngine.merge()`. Client-side outer/inner join of multiple query results by join keys.
  - `encryption.py` — `EncryptionService`. Symmetric encryption for stored DB passwords; key from `settings.recviz_encryption_key`.
  - `uri_builder.py` — `build_sync_uri()`. Builds SQLAlchemy URIs per backend (Oracle, PostgreSQL) from connection fields.
  - `query_utils.py` — `build_result_response()`, `wrap_with_pagination()`, `validate_read_only()`. Shared helpers used by both `QueryExecutor` and `sql.py`.
- Depends on: Database layer (ORM models), external databases (via drivers)
- Used by: API route handlers via dependency injection

**Database Layer (Metadata):**
- Purpose: Stores RecViz-managed entities (dashboards, charts, KPIs, datasets, data sources, database connections) in a PostgreSQL metadata database
- Location: `backend/app/db/` and `backend/app/migrations/`
- Contains:
  - `backend/app/db/engine.py` — Sync SQLAlchemy engine (`create_engine`) and `session_factory` (`sessionmaker`). Pool 10 + 5 overflow, `pool_pre_ping=True`.
  - `backend/app/db/base.py` — `DeclarativeBase`.
  - `backend/app/db/types.py` — `PortableJSON` custom type (JSONB on PostgreSQL, JSON on Oracle).
  - `backend/app/db/models/` — ORM models: `RecvizDashboard`, `RecvizChart`, `RecvizKpi`, `RecvizDataset`, `RecvizDataSource`, `RecvizConnection`. All tables prefixed `recviz_`, all use SQLAlchemy 2.0 `Mapped[T] + mapped_column()` style.
  - `backend/app/migrations/` — Alembic environment and versioned migrations. Uses the `recviz_alembic_version` table to avoid conflicts with Superset's own Alembic history.
- Depends on: PostgreSQL (via psycopg2 in sync mode; asyncpg is no longer used)
- Used by: Service layer and API layer via `DbSessionDep`

**External Database Layer (Data):**
- Purpose: The actual Oracle/Hive/PostgreSQL databases holding reconciliation data. RecViz reads; it never writes.
- Location: External — connection rows stored in `recviz_connections`. Dev uses PostgreSQL as an Oracle stand-in.
- Contains: Customer data; queried via data source SQL templates or dataset SQL.
- Depends on: Nothing RecViz-controlled.
- Used by: `QueryExecutor.execute()` routes dataset/data-source queries to the correct connection via `ConnectionResolver`; `EngineManager` holds the pooled engine; `sql.py` routes raw SQL explorer queries through the same `EngineManager`.

## Data Flow

**Dashboard view (config-driven chart render):**
1. User navigates to `/dashboards/:id` — route is `frontend/src/routes/_app/dashboards/$dashboardId.tsx`.
2. `useManagedDashboard(id)` issues `GET /api/dashboards/managed/{id}` which returns `{id, name, description, config, created_at, updated_at}`. `config` is the JSONB blob from `recviz_dashboards.config`.
3. `<DashboardRenderer config={dashboard.config} />` (`frontend/src/components/dashboard/dashboard-renderer.tsx`) initializes `filter-store` from config defaults + URL params and mounts `<ConfigFilterBar>`, `<ConfigKpiRow>`, `<ConfigChartGrid>`, `<ConfigDataGrid>`.
4. Each chart panel calls `useDataSourceQuery(dataSourceId, appliedFilters)` which `POST /api/data-sources/{id}/query` with a `filters` body.
5. Backend `data_sources.py::query_data_source` resolves the data source config via `ResolvedDataSourceDep`, calls `QueryExecutor.execute(ds, filters, session)`.
6. `QueryExecutor._resolve_database()` picks a target DB name (static or dynamic from a filter), `ConnectionResolver` maps it to a connection UUID, `_build_sql()` fills `{{filters}}` / `{{values}}` / `{{date_range_clause}}` placeholders, `wrap_with_pagination()` adds a row limit.
7. `EngineManager.get_engine_for_connection(conn)` returns a cached engine, `conn.execute(text(sql))` runs the query, result rows and cursor descriptions are assembled via `build_result_response()`.
8. Response shape is `{columns: [{column_name, name, type, is_date}], rows: [...], row_count, truncated}`.
9. `api-client.ts` transforms response keys to camelCase (skipping `rows`/`columns`/`data`/`config`), TanStack Query caches by `['data-source', dsId, filters]`, and the chart wrapper renders.

**Filter flow (three tiers):**
- **Global filters** — `<ConfigFilterBar>` updates `filter-store.values`; user clicks Apply and `filter-store.applied` is snapshotted; TanStack Query keys depend on `applied`, so charts refetch. Cross-filters and drills are cleared on global-filter change.
- **Cross-filters** — A chart click dispatches `ChartClickEvent` → `filter-store.addCrossFilter()`. Cross-filters are client-side only: `useCrossFilterData` and `useCrossFilter` re-aggregate cached data via `useMemo`. Zero extra network calls.
- **Drill-down** — `drill-store` per-chart levels. Intermediate aggregated levels can reuse cached data; detail level issues a new `useDrillDetail` query.

**Dashboard save (builder flow):**
1. User opens `/dashboards/:id/edit` — route `frontend/src/routes/_app/dashboards/$dashboardId.edit.tsx`. The parent view route detects this via `useMatchRoute()` and renders only the `<Outlet />`.
2. `<BuilderPage>` (`frontend/src/components/builder/builder-page.tsx`) hydrates `builder-store` from `DashboardConfig` (converting KPIs + charts into `BuilderItem`s laid out on a grid).
3. User drags / resizes panels on `<BuilderCanvas>`; `layout-history-store` captures undo/redo state; `builder-store.isDirty` tracks unsaved changes.
4. On save, the builder serializes items back to `DashboardConfig` and calls `useUpdateDashboard()` → `PUT /api/dashboards/managed/{id}` with `{name, description, config}`.
5. Backend `managed_dashboards.py::update_managed_dashboard` updates the row; TanStack Query invalidates `['managed-dashboards']` and `['managed-dashboard', id]`.

**SQL Explorer flow:**
1. `/explorer` renders `<SqlEditor>` (`frontend/src/components/explorer/sql-editor.tsx`) with Monaco.
2. User picks a database from `useDatabases()` (lists `recviz_connections` via `GET /api/sql/databases`).
3. `<SchemaBrowser>` (`frontend/src/components/explorer/schema-browser.tsx`) lists tables via `useTables()` and columns via `useTableColumns()`.
4. Execute runs `POST /api/sql/execute` via `useSqlExecute()`. Backend (`backend/app/api/sql.py`) calls `validate_read_only()` to reject non-SELECT, wraps with pagination, obtains the engine from `EngineManager`, executes, and returns a `build_result_response()` payload.
5. History is held in an in-memory `_query_history` list (bounded 200 entries) — documented as single-worker only.

**State Management Summary:**
- **Server state**: TanStack Query — 5 min staleTime, 30 min gcTime, `retry: 1`, no window-focus refetch. Mutations invalidate related query keys.
- **Filter state**: Zustand `filter-store` — holds `values` (draft), `applied` (snapshot at last Apply click), `locked` set (from URL `?filter.lock=...`), and `crossFilters` list. `values` → `applied` is an explicit action; TanStack Query keys depend on `applied`.
- **Drill state**: Zustand `drill-store` — per-chart stack of `DrillLevel`s; reset on global filter change.
- **Builder state**: Zustand `builder-store` — current dashboard being edited (items, filters, name, description, `isDirty`).
- **Layout history**: Zustand `layout-history-store` — undo/redo snapshots for RGL layout mutations.
- **URL state**: Dashboard filters are serialized to `?filter.<id>=value` via `frontend/src/lib/dashboard-url-state.ts`. Bidirectional sync uses `history.replaceState` (no history pollution).

## Key Abstractions

**DashboardConfig:**
- Purpose: Complete runtime description of a dashboard — filters, KPIs, charts, grids, features (cross-filter, drill-down), auto-refresh interval, layout
- Examples: `frontend/src/types/dashboard-config.ts`, stored in `recviz_dashboards.config` JSONB column
- Pattern: Builder writes config; renderer reads config. Backend stores it as opaque JSON — no Pydantic validation (the shape is owned by the frontend builder and is still evolving, per `ConfigStore` docstring).

**DataSourceConfig:**
- Purpose: Named, parameterized SQL template with database routing (static or dynamic-by-filter) and filter mappings
- Examples: `backend/app/models/data_source_config.py`, stored in `recviz_data_sources.config` JSONB column
- Pattern: Template uses `{{filters}}`, `{{values}}`, `{{value}}`, `{{date_range_clause}}`, `{{column}}` placeholders resolved by `QueryExecutor._build_sql()`. Dynamic routing picks the target DB based on a filter value.

**ChartWrapperProps / ChartFactory:**
- Purpose: Unified chart rendering interface that routes to AG Charts (standard types) or ECharts (exotic types)
- Examples: `frontend/src/components/charts/chart-factory.tsx`, `frontend/src/components/charts/ag-chart-wrapper.tsx`, `frontend/src/components/charts/echart-wrapper.tsx`, `frontend/src/types/chart.ts`
- Pattern: `ChartFactory` inspects `config.vizType` against `ECHART_TYPES` and `SUPPORTED_AG_TYPES` sets and delegates. Both wrappers expose `ChartRef` via `forwardRef` for `downloadImage`, `exportCSV`, `copyToClipboard`. Unknown viz types render `<UnsupportedChartError>`.

**CamelModel:**
- Purpose: Base Pydantic model that auto-generates camelCase aliases for every field, allowing the backend to emit/accept camelCase on the wire while using snake_case in Python
- Examples: `backend/app/models/base.py`, subclassed by every request/response model (`DashboardCreate`, `DashboardResponse`, `ChartResponse`, etc.)
- Pattern: `model_config = {"alias_generator": to_camel, "populate_by_name": True}`

**PortableJSON:**
- Purpose: Custom SQLAlchemy type that maps to JSONB on PostgreSQL and JSON on Oracle so the same ORM models work in dev (PG) and prod (Oracle)
- Examples: `backend/app/db/types.py`, used by `RecvizDashboard.config`, `RecvizDataset.columns`, `RecvizChart.config`, `RecvizKpi.config`, `RecvizDataSource.config`, `RecvizConnection.extra_params`

**EngineManager:**
- Purpose: Lazy, thread-safe registry of one sync SQLAlchemy Engine per registered database connection
- Examples: `backend/app/services/engine_manager.py`
- Pattern: Singleton held in `app.state.engine_manager`, keyed by connection UUID, created on first access, disposed on CRUD updates. Enforces per-query timeouts via `oracledb.call_timeout` (event listener) for Oracle and `statement_timeout` for PostgreSQL.

**QueryExecutor (QueryEngine):**
- Purpose: Resolves data source configs into executable SQL, picks the target database, runs the query, tracks connection status
- Examples: `backend/app/services/query_engine.py`
- Pattern: Stateful service (holds `_engine_manager`, `_resolver`, `_status_tracker`). Per-request `execute()` accepts a `DataSourceConfig`, a filter dict, and the request-scoped metadata session (so it can look up `RecvizConnection` rows without opening a second session).

**ConfigStore:**
- Purpose: Session-scoped accessor that reads `recviz_data_sources` rows and migrates their config JSON before Pydantic validation
- Examples: `backend/app/services/config_store.py`
- Pattern: One instance per request (`ConfigStoreDep`). Runs `migrate_config()` to upgrade legacy shapes before returning `DataSourceConfig`.

**FastAPI Dependency Types:**
- Purpose: Reusable `Annotated[Type, Depends(factory)]` shortcuts for request-scoped services
- Examples: `backend/app/core/dependencies.py`
- Named types: `DbSessionDep`, `ConfigStoreDep`, `QueryEngineDep`, `EngineManagerDep`, `ConnectionResolverDep`, `ResolvedDataSourceDep`
- Pattern: `get_db_session()` is a generator that auto-commits on success and auto-rollbacks on exception; `get_query_engine()` and other factories pull from `request.app.state`; `get_resolved_data_source()` handles 404s so route handlers do not duplicate lookup code.

## Entry Points

**Frontend root mount:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads `frontend/index.html` (served by Vite in dev, by FastAPI `StaticFiles` in prod)
- Responsibilities: Registers `AllChartsEnterpriseModule` and `AllEnterpriseModule` (AG Grid Enterprise) modules before any chart renders; mounts `<App />` into `#root`.

**Frontend router root:**
- Location: `frontend/src/App.tsx`
- Triggers: `main.tsx` renders `<App />`
- Responsibilities: Creates a TanStack Router from `routeTree.gen.ts` (auto-generated by the Vite plugin) and renders `<RouterProvider router={router} />`.

**Root route layout:**
- Location: `frontend/src/routes/__root.tsx`
- Triggers: Any route match
- Responsibilities: Wraps the app in `<ThemeProvider>`, `<QueryClientProvider client={queryClient}>`, `<Toaster>`, and `<ReactQueryDevtools>`. Exposes a `RootErrorComponent` for TanStack Router errors.

**Authenticated app layout:**
- Location: `frontend/src/routes/_app.tsx`
- Triggers: Any route under `/_app/*`
- Responsibilities: Renders `<SidebarProvider>` + `<AppSidebar />` + `<SidebarInset>` containing `<Header />` and an `<ErrorBoundary>`-wrapped `<AnimatedOutlet>` for page content (page transitions via `motion/react`).

**Landing redirect:**
- Location: `frontend/src/routes/index.tsx`
- Triggers: Navigation to `/`
- Responsibilities: Redirects to `/dashboards`.

**Embed route:**
- Location: `frontend/src/routes/embed/dashboards/$dashboardId.tsx`
- Triggers: Navigation to `/embed/dashboards/:id`
- Responsibilities: Renders `<DashboardRenderer>` without sidebar / header. Supports `?theme=light|dark`, `?hide=filter-bar,toolbar`, `?filter.<id>=value`, and `?filter.lock=id1,id2` search params.

**Dashboard view route:**
- Location: `frontend/src/routes/_app/dashboards/$dashboardId.tsx`
- Triggers: Navigation to `/dashboards/:id`
- Responsibilities: Fetches the dashboard via `useManagedDashboard`, hydrates initial filters from URL via `parseFilterParams`, writes store → URL on `applied` change, delegates to `<Outlet />` when the edit child route is active (avoids rendering view UI over the builder).

**Backend app factory + lifespan:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --reload`
- Responsibilities:
  1. Initializes `oracledb` in thick mode (Instant Client at `/opt/oraclient/19.3_64/lib`) — must happen before any module that imports `oracledb`.
  2. `lifespan()` creates `ConnectionStatusTracker`, `EncryptionService`, `EngineManager`, pre-warms engines for all `recviz_connections`, runs a startup health-check sweep (threadpool of 4), syncs `ConnectionResolver`, and constructs `QueryExecutor`. All stored on `app.state`.
  3. Mounts `CORSMiddleware` (allowing `localhost:5173 / 3000 / 4200`), `XFrameOptionsMiddleware` (SAMEORIGIN), and the aggregated `api_router`.
  4. Registers `GET /health` directly on the app.
  5. If `frontend/dist/` exists, mounts it as a `StaticFiles` app at `/` and installs a `404` handler that falls through to `index.html` for SPA routing while keeping `/api/*` 404s as JSON.
- Note: Route handlers are `def` (not `async def`) — FastAPI runs them in a threadpool. See `backend/app/db/engine.py` docstring for rationale.

**API aggregator:**
- Location: `backend/app/api/router.py`
- Triggers: `app.include_router(api_router)` in `main.py`
- Responsibilities: Includes every domain router — `managed_dashboards`, `data_sources`, `databases`, `managed_kpis`, `managed_charts`, `managed_datasets`, `sql`, `search`, `views`.

**Health endpoint:**
- Location: `backend/app/main.py` (`@app.get("/health")`)
- Triggers: Infrastructure probes
- Responsibilities: Returns `{"status": "ok"}`.

## Error Handling

**Strategy:** Fail fast, surface user-facing messages via toasts, sanitize anything that might contain DB credentials or raw SQL before sending it to the client.

**Frontend patterns:**
- `ApiError` class (`frontend/src/lib/api-client.ts`) parses structured error payloads into `{status, code, userMessage, detail, retryAfter}`. Non-2xx fetch responses throw it.
- `QueryCache.onError` in `frontend/src/lib/query-client.ts` posts `error.userMessage` as a Sonner toast with `error.code` as description.
- Per-component: `useQuery` exposes `isError` and `error`; components render `<ErrorPanel>` with a retry callback.
- `<ErrorBoundary>` (`frontend/src/components/shared/error-boundary.tsx`) wraps the `_app` Outlet so React render-time errors produce a fallback instead of a white screen.
- `RootErrorComponent` in `frontend/src/routes/__root.tsx` handles TanStack Router errors that are not caught by the boundary.

**Backend patterns:**
- Route handlers catch `ValueError` for client-input errors → `HTTPException(400)`.
- DB / connection errors bubble from `QueryExecutor` as `OperationalError` / `DBAPIError`; `_handle_connection_error` (and inline handling in `query_engine.py`) marks the connection `unreachable` via `ConnectionStatusTracker` and re-raises.
- `sanitize_detail(exc)` in `backend/app/core/errors.py` truncates to 500 chars and redacts any SQLAlchemy URI (`scheme://user:pass@host/db` → `***://***`) before returning to clients.
- `DbSessionDep` (`backend/app/core/dependencies.py::get_db_session`) auto-commits on success and auto-rollbacks on exception.
- Startup health-check failures are logged but never fatal — they leave the connection marked `unreachable` so the UI can show a warning rather than deadlocking the app.

## Cross-Cutting Concerns

**Logging:**
- Python `logging` module. `logging.basicConfig(level=logging.INFO)` at the very top of `backend/app/main.py`.
- Per-module: `logger = logging.getLogger(__name__)`.
- Used for startup events (engine pre-warm, health-check sweep results), query execution markers, and error context before `sanitize_detail` strips sensitive data.
- Frontend: errors surface via TanStack Query's `onError` hook as Sonner toasts. No client-side telemetry.

**Validation:**
- Frontend: TypeScript strict mode at compile time. Runtime validation at the URL boundary only (TanStack Router `validateSearch`). Form inputs are validated inline by components.
- Backend: Pydantic v2 on every request body. `CamelModel` aliases both directions. SQLAlchemy column constraints enforce DB-level validation. Raw SQL input to `/api/sql/execute` is validated via `validate_read_only()` (rejects non-SELECT).

**Authentication:**
- None. No endpoint is protected. `X-Frame-Options: SAMEORIGIN` is the only cross-origin guard. Auth is on the roadmap but not yet implemented.

**Theming / Dark mode:**
- Shadcn CSS variables in `frontend/src/index.css` + `class="dark"` on `<html>` via `frontend/src/components/layout/theme-provider.tsx` (next-themes).
- Chart wrappers read CSS variables at render time to build AG Charts / ECharts palettes from the active theme.

**Security / encryption:**
- DB passwords in `recviz_connections.encrypted_password` are encrypted by `EncryptionService` (`backend/app/services/encryption.py`) using a symmetric key from `settings.recviz_encryption_key` (`RECVIZ_ENCRYPTION_KEY` env var, no default — app fails to start without it).
- Passwords are decrypted on the hot path only in `EngineManager.get_engine_for_connection`, and the cached engine keeps the connection URI in memory; passwords are never logged.

**Migrations:**
- Alembic. `backend/app/migrations/env.py` + versioned migrations in `backend/app/migrations/versions/`. Uses the `recviz_alembic_version` table (not the default `alembic_version`) to avoid conflicts with Superset's own migration history on the same PostgreSQL metadata DB.

---

*Architecture analysis: 2026-04-11*
