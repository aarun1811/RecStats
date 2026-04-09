# Codebase Structure

**Analysis Date:** 2026-04-09

## Directory Layout

```
RecViz/
├── frontend/                    # React SPA (pnpm, Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── builder/         # Dashboard builder UI (drag-and-drop canvas, pickers, config dialogs)
│   │   │   ├── charts/          # Chart rendering (AG Charts, ECharts, factory, builder wizard)
│   │   │   │   └── builder/     # Chart creation wizard steps
│   │   │   ├── dashboard/       # Dashboard viewing (renderer, filter bar, KPI row, chart grid, data grid, toolbar)
│   │   │   ├── datasets/        # Dataset CRUD (editor, list, card, metadata grid)
│   │   │   ├── embed/           # Embed-specific components (topbar)
│   │   │   ├── explorer/        # SQL Explorer (editor, schema browser, results, history)
│   │   │   ├── grid/            # AG Grid wrapper and cell renderers
│   │   │   │   └── cell-renderers/  # Custom cell renderers (amount, SLA, status)
│   │   │   ├── kpis/            # KPI library and builder
│   │   │   │   └── builder/     # KPI creation wizard steps
│   │   │   ├── layout/          # App shell (sidebar, header, nav, theme)
│   │   │   ├── settings/        # Settings page components (data sources)
│   │   │   ├── shared/          # Reusable components (error boundary, page transition, count animation)
│   │   │   └── ui/              # Shadcn/ui primitives (owned code, not a dependency)
│   │   ├── hooks/               # Custom hooks (data fetching, cross-filter, drill, auto-refresh)
│   │   ├── lib/                 # Utilities (api client, formatters, chart themes, cross-filter logic)
│   │   ├── pages/               # Empty (routes replace this)
│   │   ├── routes/              # TanStack Router file-based routes
│   │   │   ├── _app/            # Authenticated layout routes (sidebar + header)
│   │   │   │   ├── charts/      # Chart library + builder pages
│   │   │   │   ├── dashboards/  # Dashboard list + view + builder pages
│   │   │   │   ├── datasets/    # Dataset library + editor pages
│   │   │   │   ├── explorer/    # SQL Explorer page
│   │   │   │   ├── kpis/        # KPI library + builder pages
│   │   │   │   ├── reports/     # Reports page (mock data)
│   │   │   │   └── settings/    # Settings page
│   │   │   └── embed/           # Embed layout routes (no sidebar)
│   │   │       └── dashboards/  # Embeddable dashboard viewer
│   │   ├── stores/              # Zustand stores (filter, drill, builder, layout history)
│   │   └── types/               # TypeScript type definitions
│   ├── e2e/                     # Playwright end-to-end tests
│   ├── dist/                    # Vite build output (gitignored)
│   └── [config files]           # vite.config.ts, tsconfig.json, eslint.config.js, etc.
├── backend/                     # FastAPI application
│   ├── app/
│   │   ├── api/                 # Route handlers (one file per domain)
│   │   ├── config/              # JSON config files (databases.json, seed data)
│   │   │   └── seed/            # Seed data source configs
│   │   ├── core/                # Dependencies, error utilities
│   │   ├── db/                  # SQLAlchemy engine, base, ORM models
│   │   │   └── models/          # ORM models (dashboard, data_source, dataset, chart, kpi)
│   │   ├── migrations/          # Alembic migrations
│   │   │   └── versions/        # Migration scripts (001-004)
│   │   ├── models/              # Pydantic request/response models
│   │   ├── services/            # Business logic services
│   │   ├── config.py            # pydantic-settings Settings class
│   │   └── main.py              # FastAPI app creation, lifespan, middleware
│   ├── tests/                   # pytest unit/integration tests
│   └── requirements.txt         # Python dependencies
├── superset/                    # Superset configuration
│   ├── Dockerfile               # Superset Docker build
│   ├── superset_config.py       # Main Superset config
│   ├── superset_config_local.py # Local dev overrides
│   └── superset-entrypoint.sh   # Container entrypoint
├── docker/                      # Docker supporting files
│   └── init-db.sql              # PostgreSQL init script
├── scripts/                     # Development/setup scripts
├── seed/                        # Database seed scripts
├── docs/                        # Documentation files
├── deployment/                  # Deployment artifacts
├── docker-compose.yml           # Docker Compose (PostgreSQL + Redis + Superset)
├── CLAUDE.md                    # AI assistant instructions
└── README.md                    # Project readme
```

## Directory Purposes

**`frontend/src/components/builder/`:**
- Purpose: Dashboard builder UI - the drag-and-drop canvas for creating/editing dashboards
- Contains: Canvas, toolbar, content menu, picker dialogs (chart, KPI, dataset), filter config, panel config, save/delete dialogs, unsaved changes guard
- Key files: `builder-page.tsx` (main page), `builder-canvas.tsx` (grid layout), `builder-toolbar.tsx`, `save-dashboard-dialog.tsx`, `chart-picker-dialog.tsx`, `kpi-picker-dialog.tsx`, `filter-config-dialog.tsx`

**`frontend/src/components/charts/`:**
- Purpose: All chart rendering and chart creation wizard
- Contains: AG Charts wrapper, ECharts wrapper, chart factory (type router), chart builder wizard steps, chart library list/card/row views
- Key files: `chart-factory.tsx` (routes vizType to wrapper), `ag-chart-wrapper.tsx` (primary renderer), `echart-wrapper.tsx` (exotic types), `chart-builder.tsx` (creation wizard)

**`frontend/src/components/dashboard/`:**
- Purpose: Dashboard viewing components - everything rendered on a dashboard page
- Contains: Renderer, filter bar, KPI row, chart grid, data grid, toolbar, cross-filter bar, drill breadcrumb, drill detail grid, chart toolbar (export/fullscreen)
- Key files: `dashboard-renderer.tsx` (orchestrates all sections), `config-filter-bar.tsx`, `config-kpi-row.tsx`, `config-chart-grid.tsx`, `config-data-grid.tsx`, `dashboard-list.tsx`

**`frontend/src/components/ui/`:**
- Purpose: Shadcn/ui base components - owned code, not a dependency
- Contains: All Shadcn primitives (button, card, dialog, input, select, sidebar, tabs, etc.) plus custom additions (empty, spinner, kbd, timeline, resizable)
- Key files: `sidebar.tsx` (complex sidebar system), `command.tsx` (command palette), `sonner.tsx` (toast notifications)

**`frontend/src/hooks/`:**
- Purpose: Custom React hooks wrapping TanStack Query for data fetching, plus cross-filter and drill-down logic
- Contains: CRUD hooks for managed entities, data source query hook, cross-filter hooks, drill hooks, auto-refresh, search, filter options
- Key files: `use-managed-dashboards.ts`, `use-managed-charts.ts`, `use-managed-kpis.ts`, `use-managed-datasets.ts`, `use-data-source-query.ts`, `use-cross-filter.ts`, `use-drill-down.ts`, `use-auto-refresh.ts`

**`frontend/src/lib/`:**
- Purpose: Pure utility functions, API client, formatters, chart themes, cross-filter logic
- Contains: API client (fetch wrapper), query client config, formatters, chart themes, cross-filter engine, KPI aggregation, column detection/merge, chart export, dashboard URL state
- Key files: `api-client.ts` (API wrapper with snake-to-camel transform), `query-client.ts` (TanStack Query config), `chart-themes.ts`, `cross-filter.ts`, `formatters.ts`, `dashboard-url-state.ts`, `kpi-aggregator.ts`

**`frontend/src/stores/`:**
- Purpose: Zustand state stores for client-side state
- Contains: Filter store (values, applied, cross-filters), drill store (per-chart drill levels), builder store (dashboard editing state), layout history store (undo/redo)
- Key files: `filter-store.ts`, `drill-store.ts`, `builder-store.ts`, `layout-history-store.ts`

**`frontend/src/types/`:**
- Purpose: TypeScript type definitions shared across the frontend
- Contains: Types for API responses, charts, dashboards, datasets, filters, builders, KPIs, views, formatting
- Key files: `dashboard-config.ts` (DashboardConfig - the central config type), `chart.ts` (ChartWrapperProps, ChartRef), `filter.ts`, `managed-dashboard.ts`, `managed-chart.ts`, `managed-kpi.ts`, `managed-dataset.ts`, `builder.ts`

**`frontend/src/routes/`:**
- Purpose: TanStack Router file-based routing - each file defines a page
- Contains: Root layout, app layout, all page routes organized by feature area
- Key files: `__root.tsx` (providers), `_app.tsx` (sidebar layout), `_app/dashboards/$dashboardId.tsx` (view), `_app/dashboards/$dashboardId.edit.tsx` (builder), `embed/dashboards/$dashboardId.tsx` (embed)

**`backend/app/api/`:**
- Purpose: FastAPI route handlers - thin controllers that validate input, call services, return responses
- Contains: One router file per domain area
- Key files: `router.py` (aggregates all routers), `managed_dashboards.py`, `managed_charts.py`, `managed_kpis.py`, `managed_datasets.py`, `data_sources.py` (query execution), `databases.py` (database CRUD), `sql.py` (SQL Lab), `search.py`, `export.py` (stubs), `views.py` (in-memory)

**`backend/app/services/`:**
- Purpose: Business logic encapsulated in service classes
- Contains: Superset client, query engine, database registrar, dataset sync, config store, merge engine, connection status tracker, config migrator, URI builder
- Key files: `superset_client.py` (Superset REST API wrapper), `query_engine.py` (SQL builder + executor), `database_registrar.py` (database sync to Superset), `dataset_sync.py` (dataset sync to Superset), `config_store.py` (data source config retrieval)

**`backend/app/db/`:**
- Purpose: Database layer - SQLAlchemy async engine, base class, ORM models
- Contains: Engine configuration, declarative base, ORM models for each entity
- Key files: `engine.py` (async engine + session factory), `base.py` (DeclarativeBase), `models/dashboard.py`, `models/data_source.py`, `models/dataset.py`, `models/chart.py`, `models/kpi.py`

**`backend/app/models/`:**
- Purpose: Pydantic v2 models for API request/response validation
- Contains: Models for every API domain (dashboards, charts, KPIs, datasets, data sources, databases, filters, exports, views, errors)
- Key files: `base.py` (CamelModel with alias generation), `data_source_config.py` (DataSourceConfig), `managed_dashboard.py`, `managed_chart.py`, `managed_kpi.py`, `managed_dataset.py`, `database_config.py`, `database.py`

## Key File Locations

**Entry Points:**
- `frontend/src/main.tsx`: Frontend SPA entry - AG Grid/Charts module registration, React root mount
- `frontend/src/App.tsx`: Router setup with TanStack Router
- `backend/app/main.py`: FastAPI app creation, lifespan (Superset auth, DB registrar, query engine), middleware, router mounting

**Configuration:**
- `backend/app/config.py`: pydantic-settings `Settings` class (Superset URL, DB URLs, config paths)
- `backend/app/config/databases.json`: Database connection definitions (names, URIs, dialects)
- `backend/app/config/databases.prod.json`: Production database config
- `frontend/vite.config.ts`: Vite build config with path aliases, Tailwind, TanStack Router plugin
- `frontend/src/lib/query-client.ts`: TanStack Query defaults (5-min stale, 30-min GC, 1 retry)
- `docker-compose.yml`: PostgreSQL + Redis + Superset container definitions
- `superset/superset_config.py`: Superset configuration (metadata DB, cache, feature flags)

**Core Logic:**
- `frontend/src/components/dashboard/dashboard-renderer.tsx`: Dashboard view orchestrator
- `frontend/src/components/charts/chart-factory.tsx`: Chart type routing (AG Charts vs ECharts)
- `frontend/src/components/charts/ag-chart-wrapper.tsx`: Primary chart renderer with series builder
- `frontend/src/lib/api-client.ts`: API client with snake-to-camel key transform
- `frontend/src/lib/cross-filter.ts`: Cross-filter application logic
- `frontend/src/lib/kpi-aggregator.ts`: KPI re-aggregation for cross-filter
- `frontend/src/stores/filter-store.ts`: Global filter + cross-filter state
- `frontend/src/stores/builder-store.ts`: Dashboard builder state
- `backend/app/services/query_engine.py`: SQL template builder + execution orchestrator
- `backend/app/services/superset_client.py`: Superset REST API client with auto-auth
- `backend/app/services/database_registrar.py`: Database registration + name-to-ID resolution
- `backend/app/services/dataset_sync.py`: Dataset sync between RecViz DB and Superset
- `backend/app/core/dependencies.py`: FastAPI dependency injection definitions

**Testing:**
- `backend/tests/`: Python pytest tests for services and API endpoints
- `frontend/e2e/`: Playwright end-to-end tests
- `frontend/src/**/*.test.ts(x)`: Co-located Vitest unit tests

## Naming Conventions

**Files:**
- Components: `kebab-case.tsx` (e.g., `kpi-card.tsx`, `filter-bar.tsx`, `ag-chart-wrapper.tsx`)
- Hooks: `use-{name}.ts` (e.g., `use-managed-dashboards.ts`, `use-cross-filter.ts`)
- Stores: `{name}-store.ts` (e.g., `filter-store.ts`, `builder-store.ts`)
- Types: `{name}.ts` (e.g., `chart.ts`, `dashboard-config.ts`, `managed-dashboard.ts`)
- Utils/lib: `kebab-case.ts` (e.g., `api-client.ts`, `chart-themes.ts`, `kpi-aggregator.ts`)
- Tests (frontend): `{name}.test.ts(x)` co-located with source
- Tests (backend): `test_{name}.py` in `backend/tests/`
- Python: `snake_case.py` (e.g., `superset_client.py`, `query_engine.py`)
- Route pages: `index.tsx` for list pages, `$paramName.tsx` for detail pages, `$paramName.edit.tsx` for edit pages, `new.tsx` for create pages

**Directories:**
- Frontend components: `kebab-case/` grouped by feature domain
- Backend modules: `snake_case/` grouped by architectural layer
- Route directories: match URL segments (e.g., `dashboards/`, `charts/`, `explorer/`)

## Where to Add New Code

**New Dashboard Feature/Section:**
- Component: `frontend/src/components/dashboard/{feature-name}.tsx`
- Wire into: `frontend/src/components/dashboard/dashboard-renderer.tsx`
- Types: extend `frontend/src/types/dashboard-config.ts` (`DashboardConfig` interface)

**New Chart Type:**
- Add type string to `SUPPORTED_AG_TYPES` or `ECHART_TYPES` in `frontend/src/components/charts/chart-factory.tsx`
- Add series builder case in `frontend/src/components/charts/ag-chart-wrapper.tsx` `buildSeries()` function
- Add type to `ChartType` union in `frontend/src/types/chart.ts`

**New Managed Entity (CRUD):**
- Backend model: `backend/app/db/models/{entity}.py` (SQLAlchemy ORM)
- Pydantic models: `backend/app/models/managed_{entity}.py`
- API router: `backend/app/api/managed_{entity}s.py` (register in `backend/app/api/router.py`)
- Migration: `backend/app/migrations/versions/{NNN}_{description}.py`
- Frontend type: `frontend/src/types/managed-{entity}.ts`
- Frontend hook: `frontend/src/hooks/use-managed-{entity}s.ts`
- Frontend components: `frontend/src/components/{entity}s/`
- Frontend routes: `frontend/src/routes/_app/{entity}s/`

**New API Endpoint (on existing domain):**
- Add route function in the relevant `backend/app/api/{domain}.py` file
- Add Pydantic models in `backend/app/models/{domain}.py` if needed
- Add service method in `backend/app/services/{service}.py` if business logic needed
- Add backend test in `backend/tests/test_{domain}.py`

**New Data Fetching Hook:**
- File: `frontend/src/hooks/use-{name}.ts`
- Pattern: Wrap `useQuery` or `useMutation` from TanStack Query
- Query key convention: `['{entity}', identifier, filters]`
- Use `api.get<Type>()` or `api.post<Type>()` from `frontend/src/lib/api-client.ts`

**New Zustand Store:**
- File: `frontend/src/stores/{name}-store.ts`
- Pattern: `create<StoreInterface>((set, get) => ({ ... }))`
- Consume via selectors: `const value = useStore((s) => s.field)`

**New Utility Function:**
- Frontend: `frontend/src/lib/{feature-name}.ts`
- Backend: `backend/app/services/{service_name}.py` (if service-level) or inline in route handler (if simple)

**New Shadcn Component:**
- Install: `npx shadcn@latest add {component}` from `frontend/` directory
- Location: auto-placed in `frontend/src/components/ui/{component}.tsx`
- Convention: Never modify base ui files unless necessary; compose via wrapper components

**New E2E Test:**
- File: `frontend/e2e/{feature}.spec.ts`
- Fixtures: `frontend/e2e/_fixtures.ts`
- Config: `frontend/playwright.config.ts`

**New Backend Test:**
- File: `backend/tests/test_{module}.py`
- Run: `cd backend && python -m pytest tests/test_{module}.py -v`

## Special Directories

**`frontend/src/components/ui/`:**
- Purpose: Shadcn/ui base components - copy-pasted in, not a dependency
- Generated: Yes (via `npx shadcn@latest add`)
- Committed: Yes
- Rule: Do NOT modify these files unless absolutely necessary. Compose via wrapper components.

**`frontend/src/routeTree.gen.ts`:**
- Purpose: Auto-generated route tree from file-based routes
- Generated: Yes (by TanStack Router Vite plugin)
- Committed: Yes
- Rule: Never edit manually. Changes to `routes/` directory auto-regenerate this file.

**`frontend/dist/`:**
- Purpose: Vite production build output
- Generated: Yes (by `pnpm build`)
- Committed: No (gitignored)

**`backend/app/migrations/versions/`:**
- Purpose: Alembic database migration scripts
- Generated: Manually created following Alembic conventions
- Committed: Yes
- Note: Uses separate `recviz_alembic_version` table to avoid conflicts with Superset's own Alembic migrations

**`backend/app/config/seed/`:**
- Purpose: Seed data source JSON configs for development
- Generated: No
- Committed: Yes

**`_references/`:**
- Purpose: Reference UI kit (Shadcn dashboard templates) for visual baseline
- Generated: No
- Committed: Yes
- Rule: Read-only reference. Copy and adapt patterns; do not import directly.

**`frontend/.tanstack/`:**
- Purpose: TanStack Router generated types cache
- Generated: Yes
- Committed: No (effectively)

## API Route Map

| Method | Route | Handler | Purpose |
|--------|-------|---------|---------|
| GET | `/api/dashboards/managed` | `managed_dashboards.py` | List dashboards |
| POST | `/api/dashboards/managed` | `managed_dashboards.py` | Create dashboard |
| GET | `/api/dashboards/managed/:id` | `managed_dashboards.py` | Get dashboard |
| PUT | `/api/dashboards/managed/:id` | `managed_dashboards.py` | Update dashboard |
| DELETE | `/api/dashboards/managed/:id` | `managed_dashboards.py` | Delete dashboard |
| GET | `/api/charts/managed` | `managed_charts.py` | List charts |
| POST | `/api/charts/managed` | `managed_charts.py` | Create chart |
| GET | `/api/charts/managed/:id` | `managed_charts.py` | Get chart |
| PUT | `/api/charts/managed/:id` | `managed_charts.py` | Update chart |
| DELETE | `/api/charts/managed/:id` | `managed_charts.py` | Delete chart |
| GET | `/api/charts/managed/:id/references` | `managed_charts.py` | Check chart references |
| GET | `/api/kpis/managed` | `managed_kpis.py` | List KPIs |
| POST | `/api/kpis/managed` | `managed_kpis.py` | Create KPI |
| GET | `/api/kpis/managed/:id` | `managed_kpis.py` | Get KPI |
| PUT | `/api/kpis/managed/:id` | `managed_kpis.py` | Update KPI |
| DELETE | `/api/kpis/managed/:id` | `managed_kpis.py` | Delete KPI |
| GET | `/api/kpis/managed/:id/references` | `managed_kpis.py` | Check KPI references |
| GET | `/api/datasets/managed` | `managed_datasets.py` | List datasets |
| POST | `/api/datasets/managed` | `managed_datasets.py` | Create dataset + Superset sync |
| GET | `/api/datasets/managed/:id` | `managed_datasets.py` | Get dataset |
| PUT | `/api/datasets/managed/:id` | `managed_datasets.py` | Update dataset |
| DELETE | `/api/datasets/managed/:id` | `managed_datasets.py` | Delete dataset (checks refs) |
| GET | `/api/datasets/managed/:id/references` | `managed_datasets.py` | Check dataset references |
| POST | `/api/data-sources/:id/query` | `data_sources.py` | Execute data source query |
| POST | `/api/data-sources/merge` | `data_sources.py` | Merge multiple data sources |
| GET | `/api/data-sources/:id/distinct/:col` | `data_sources.py` | Get distinct column values |
| GET | `/api/databases` | `databases.py` | List databases |
| GET | `/api/databases/:id` | `databases.py` | Get database |
| GET | `/api/databases/:id/datasets` | `databases.py` | List database datasets |
| POST | `/api/databases` | `databases.py` | Create database |
| PUT | `/api/databases/:id` | `databases.py` | Update database |
| DELETE | `/api/databases/:id` | `databases.py` | Delete database |
| POST | `/api/databases/test` | `databases.py` | Test connection |
| POST | `/api/databases/:id/sync` | `databases.py` | Sync datasets |
| POST | `/api/sql/execute` | `sql.py` | Execute raw SQL |
| GET | `/api/sql/history` | `sql.py` | Get query history |
| GET | `/api/sql/databases` | `sql.py` | List databases for SQL Lab |
| POST | `/api/search` | `search.py` | Search across entities |
| POST | `/api/export/pdf` | `export.py` | Export PDF (stub) |
| POST | `/api/export/excel` | `export.py` | Export Excel (stub) |
| GET | `/api/export/:id/status` | `export.py` | Check export status (stub) |
| GET | `/api/views` | `views.py` | List saved views (in-memory) |
| POST | `/api/views` | `views.py` | Create saved view (in-memory) |
| DELETE | `/api/views/:id` | `views.py` | Delete saved view (in-memory) |
| GET | `/health` | `main.py` | Health check |

## Frontend Route Map

| Route | File | Purpose |
|-------|------|---------|
| `/` | `routes/index.tsx` | Redirects to `/dashboards` |
| `/_app` | `routes/_app.tsx` | App layout (sidebar + header) |
| `/dashboards` | `routes/_app/dashboards/index.tsx` | Dashboard list |
| `/dashboards/:id` | `routes/_app/dashboards/$dashboardId.tsx` | Dashboard view |
| `/dashboards/:id/edit` | `routes/_app/dashboards/$dashboardId.edit.tsx` | Dashboard builder |
| `/dashboards/new` | `routes/_app/dashboards/new.tsx` | New dashboard builder |
| `/charts` | `routes/_app/charts/index.tsx` | Chart library |
| `/charts/:id/edit` | `routes/_app/charts/$chartId.edit.tsx` | Edit chart |
| `/charts/new` | `routes/_app/charts/new.tsx` | Create chart |
| `/kpis` | `routes/_app/kpis/index.tsx` | KPI library |
| `/kpis/:id/edit` | `routes/_app/kpis/$kpiId.edit.tsx` | Edit KPI |
| `/kpis/new` | `routes/_app/kpis/new.tsx` | Create KPI |
| `/datasets` | `routes/_app/datasets/index.tsx` | Dataset library |
| `/datasets/:id/edit` | `routes/_app/datasets/$datasetId.edit.tsx` | Edit dataset |
| `/datasets/new` | `routes/_app/datasets/new.tsx` | Create dataset |
| `/explorer` | `routes/_app/explorer/index.tsx` | SQL Explorer |
| `/reports` | `routes/_app/reports/index.tsx` | Reports (mock data) |
| `/settings` | `routes/_app/settings/index.tsx` | Settings |
| `/embed/dashboards/:id` | `routes/embed/dashboards/$dashboardId.tsx` | Embeddable dashboard |

---

*Structure analysis: 2026-04-09*
