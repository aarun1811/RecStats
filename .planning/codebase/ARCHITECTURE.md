# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Three-tier headless BI architecture -- React SPA talks to a FastAPI sidecar, which proxies/orchestrates calls to Apache Superset as a headless query engine. Two parallel subsystems exist: a config-driven dashboard system (active) and a legacy hardcoded chart system (dead code).

**Key Characteristics:**
- Superset is the query execution engine; its UI is never exposed to users
- FastAPI acts as both a proxy layer and a sidecar with its own DB-backed config store
- Dashboard definitions live in PostgreSQL as JSONB configs, not in Superset
- The frontend never talks to Superset directly -- all queries are routed through FastAPI
- Config-driven data sources use SQL templates with filter placeholders, executed via Superset's SQLLab API
- RecViz-managed datasets and charts have their own CRUD pipeline with Superset sync

## Layers

**Presentation Layer (React SPA):**
- Purpose: Render dashboards, charts, grids, SQL explorer, and settings UI
- Location: `frontend/src/`
- Contains: Route pages, components, hooks, Zustand stores, type definitions
- Depends on: FastAPI backend (via `frontend/src/lib/api-client.ts`)
- Used by: Browser (desktop-first)

**API Layer (FastAPI):**
- Purpose: Expose REST endpoints, validate requests, proxy to Superset, serve config-driven data
- Location: `backend/app/api/`
- Contains: Route handlers organized by domain (dashboards, data-sources, charts, datasets, sql, databases, export, views, managed-charts, managed-datasets)
- Depends on: Service layer, Pydantic models, FastAPI dependency injection
- Used by: React SPA

**Service Layer (Python):**
- Purpose: Business logic, external API orchestration, config resolution, data merging
- Location: `backend/app/services/`
- Contains: SupersetClient, QueryEngine, DatabaseRegistrar, ConfigStore, MergeEngine, DatasetSyncService, ConnectionStatusTracker, ConfigMigrator
- Depends on: Superset REST API (via httpx), PostgreSQL (via SQLAlchemy), in-memory caches
- Used by: API layer

**Data Layer (SQLAlchemy + PostgreSQL):**
- Purpose: Persist dashboard configs, data source configs, managed datasets, managed charts
- Location: `backend/app/db/`
- Contains: SQLAlchemy models, async engine, session factory, Alembic migrations
- Depends on: PostgreSQL
- Used by: Service layer (ConfigStore, managed dataset/chart CRUD)

**Query Engine (Apache Superset):**
- Purpose: Execute SQL queries against data sources, manage database connections, provide caching
- Location: `superset/` (config + Dockerfile)
- Contains: Superset config, Docker image, entrypoint script
- Depends on: PostgreSQL (metadata), Redis (cache), target databases (Oracle, Hive, PostgreSQL)
- Used by: Service layer (via SupersetClient)

## Data Flow

**Config-Driven Dashboard Rendering (primary flow):**

1. User navigates to `/dashboards/$dashboardId`
2. Route component (`frontend/src/routes/_app/dashboards/$dashboardId.tsx`) calls `useDashboardConfig` hook
3. Hook fetches `GET /api/dashboards/{id}` -> FastAPI reads from `recviz_dashboards` table via `ConfigStore`
4. `DashboardRenderer` (`frontend/src/components/dashboard/dashboard-renderer.tsx`) receives config, initializes `FilterStore`
5. Filter bar (`ConfigFilterBar`) populates options via `GET /api/data-sources/{id}/distinct/{column}`
6. User applies filters -> `FilterStore.applied` updates -> all data-fetching hooks re-fire
7. KPI data: `POST /api/dashboards/{id}/kpis` with filters -> `QueryEngine` executes SQL per KPI source
8. Chart data: Each chart uses `useDataSourceQuery` -> `POST /api/data-sources/{id}/query` -> `QueryEngine` builds SQL from template + filters, resolves database, executes via Superset SQLLab
9. Grid data: Same flow as charts, plus optional multi-source merge via `POST /api/data-sources/merge`

**SQL Explorer Flow:**

1. User types SQL in Monaco Editor (`frontend/src/routes/_app/explorer/index.tsx`)
2. `useSqlExecute` hook fires `POST /api/sql/execute` with raw SQL + database_id
3. FastAPI proxies directly to `SupersetClient.execute_sql()` (Superset SQLLab API)
4. Results displayed in AG Grid via `QueryResults` component
5. User can "Save as Dataset" -> creates managed dataset -> syncs to Superset as virtual dataset

**Managed Dataset/Chart CRUD Flow:**

1. User creates dataset via Dataset Editor (`frontend/src/components/datasets/dataset-editor.tsx`)
2. `POST /api/datasets/managed` -> creates `RecvizDataset` row in PostgreSQL
3. `DatasetSyncService.sync_dataset()` creates matching virtual dataset in Superset (non-blocking on failure)
4. Charts reference datasets -> `POST /api/charts/managed` -> creates `RecvizChart` row
5. On startup, `DatasetSyncService.reconcile()` retries unsynced datasets

**Cross-Filter Flow (client-side, zero network calls):**

1. User clicks chart segment -> `onChartClick` fires -> `FilterStore.addCrossFilter()`
2. `useCrossFilterData` hook fetches KPI data sources (shared TanStack Query cache -- no extra requests if already fetched)
3. `recomputeKpis()` (`frontend/src/lib/kpi-aggregator.ts`) filters cached rows client-side, recomputes KPI values
4. `applyCrossFilters()` (`frontend/src/lib/cross-filter.ts`) filters chart data rows client-side
5. AG Grid uses `doesExternalFilterPass` with `rowPassesCrossFilters()` for grid filtering

**State Management:**
- **Server state**: TanStack Query (query cache with 5min stale, 30min GC). Query keys: `['dashboard-config', id]`, `['data-source', id, filters]`, `['dashboard-kpis', id, filters]`, `['chart-data', id, filters]`
- **Client state**: Zustand stores -- `FilterStore` (filter values + applied snapshot + cross-filters + locked filters), `DrillStore` (per-chart drill depth via Map)
- **Theme state**: React context via `ThemeProvider` wrapping `next-themes`

## Key Abstractions

**DashboardConfig:**
- Purpose: Complete dashboard definition -- filters, KPIs, charts, grids, features, layout
- Backend: `backend/app/models/dashboard_config.py` (Pydantic model)
- Frontend: `frontend/src/types/dashboard-config.ts` (TypeScript interface)
- Storage: `recviz_dashboards.config` (JSONB column in PostgreSQL)
- Pattern: JSON config validated by Pydantic, serialized to frontend, rendered by `DashboardRenderer`

**DataSourceConfig:**
- Purpose: SQL template + database routing + filter mappings for a single data query
- Backend: `backend/app/models/data_source_config.py` (Pydantic model)
- Storage: `recviz_data_sources.config` (JSONB column in PostgreSQL), JSON files in `backend/app/config/data_sources/`
- Pattern: SQL template with `{{filters}}`, `{{column}}`, `{{values}}` placeholders, resolved at query time by `QueryEngine`

**QueryEngine:**
- Purpose: Build SQL from config templates, resolve dynamic database routing, execute via Superset
- Location: `backend/app/services/query_engine.py`
- Pattern: Template interpolation with dialect-aware date clauses, filter mapping, schema prefix stripping

**SupersetClient:**
- Purpose: Authenticated async HTTP client for Superset REST API with auto-retry on 401
- Location: `backend/app/services/superset_client.py`
- Pattern: Token-based auth with 25min refresh, CSRF token handling, all methods async

**DatabaseRegistrar:**
- Purpose: Sync logical database names from `databases.json` to Superset, resolve name -> Superset numeric ID
- Location: `backend/app/services/database_registrar.py`
- Pattern: Cache with negative cache + lock-guarded refresh, supports static + dynamic routing

**ChartFactory:**
- Purpose: Route chart rendering to AG Charts or ECharts based on viz type
- Location: `frontend/src/components/charts/chart-factory.tsx`
- Pattern: Set-based routing (ECHART_TYPES, SUPPORTED_AG_TYPES), unified `ChartRef` imperative handle for export

**ConfigStore:**
- Purpose: DB-backed store for dashboard and data source configs (session-scoped)
- Location: `backend/app/services/config_store.py`
- Pattern: Wraps SQLAlchemy queries, applies config migration pipeline before returning Pydantic models

## Entry Points

**Frontend:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser navigation
- Responsibilities: Register AG Charts/Grid enterprise modules, mount React app

**Frontend Root Route:**
- Location: `frontend/src/routes/__root.tsx`
- Triggers: All page loads
- Responsibilities: Provide ThemeProvider, QueryClientProvider, Toaster, ErrorBoundary

**Frontend App Layout:**
- Location: `frontend/src/routes/_app.tsx`
- Triggers: All `/_app/*` routes
- Responsibilities: Render sidebar, header, animated outlet

**Backend:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app`
- Responsibilities: Initialize httpx client, authenticate to Superset, sync databases, create QueryEngine, reconcile datasets, mount all API routers

**API Router:**
- Location: `backend/app/api/router.py`
- Triggers: All `/api/*` requests
- Responsibilities: Aggregate and mount all domain-specific API routers

## Error Handling

**Strategy:** Structured error responses with consistent shape, cascading from Superset errors through FastAPI to frontend toast notifications.

**Backend Patterns:**
- All Superset communication wrapped in `try/except` for `httpx.ConnectError`, `httpx.TimeoutException`, `httpx.HTTPStatusError`
- Each maps to specific HTTP status: 503 (connect), 504 (timeout), 502 (Superset error), 500 (unexpected)
- Error response shape: `{"error": code, "message": human_msg, "detail": sanitized_detail, "retry_after": seconds}`
- `sanitize_detail()` (`backend/app/core/errors.py`) truncates long messages and redacts connection strings
- Connection-level failures detected via pattern matching (`backend/app/services/query_engine.py` `_CONNECTION_FAILURE_PATTERNS`) and tracked by `ConnectionStatusTracker`

**Frontend Patterns:**
- `ApiError` class (`frontend/src/lib/api-client.ts`) parses structured error responses
- TanStack Query `QueryCache.onError` shows toast via Sonner with `error.userMessage`
- `ErrorBoundary` component (`frontend/src/components/shared/error-boundary.tsx`) wraps app layout
- `ErrorPanel` component (`frontend/src/components/shared/error-panel.tsx`) for inline error display in charts/grids

## Cross-Cutting Concerns

**Logging:**
- Backend: Python `logging` module, `logging.basicConfig(level=INFO)` in `backend/app/main.py`
- Frontend: No structured logging; errors surface via TanStack Query error handling + Sonner toasts

**Validation:**
- Backend: Pydantic v2 models for all request bodies and config schemas
- Frontend: TypeScript strict mode; form validation is component-local
- Config migration: `backend/app/services/config_migrator.py` applies versioned migrations to JSONB configs before Pydantic validation

**Authentication:**
- Superset auth: Username/password login via `SupersetClient.authenticate()`, token stored in memory, auto-refresh at 25min
- User auth: **None** -- no authentication on any endpoint. Noted as critical gap.

**Key Transform:**
- `frontend/src/lib/api-client.ts` auto-converts all response keys from `snake_case` to `camelCase`
- `DATA_KEYS` set (`rows`, `columns`, `data`, `config`) are skipped to preserve DB column names in data payloads

**CORS:**
- Configured in `backend/app/main.py` for `localhost:5173`, `localhost:3000`, `localhost:4200`
- `X-Frame-Options: ALLOWALL` for embed support

---

*Architecture analysis: 2026-04-06*
