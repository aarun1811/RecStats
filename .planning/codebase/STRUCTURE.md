# Codebase Structure

**Analysis Date:** 2026-04-05

## Directory Layout

```
RecViz/
├── frontend/                   # React 19 SPA (Vite 6)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/             # Shadcn/ui primitives (owned code, not dependency)
│   │   │   ├── layout/         # App shell: sidebar, header, nav, theme
│   │   │   ├── dashboard/      # Config-driven dashboard components
│   │   │   ├── charts/         # Chart factory, AG Chart wrapper, EChart wrapper
│   │   │   ├── grid/           # AG Grid cell renderers
│   │   │   ├── explorer/       # SQL editor, schema browser, query results
│   │   │   ├── embed/          # Embed-mode topbar
│   │   │   ├── settings/       # Data source management UI
│   │   │   └── shared/         # Error boundary, error panel, page transition, count animation
│   │   ├── hooks/              # Custom hooks (data fetching, cross-filter, drill-down)
│   │   ├── stores/             # Zustand stores (filter, drill)
│   │   ├── lib/                # API client, query client, utils, formatters, chart themes
│   │   ├── types/              # TypeScript type definitions
│   │   ├── routes/             # TanStack Router file-based routes
│   │   │   ├── __root.tsx      # Root layout (providers)
│   │   │   ├── _app.tsx        # App layout (sidebar + header)
│   │   │   ├── _app/
│   │   │   │   ├── dashboards/ # Dashboard list + detail pages
│   │   │   │   ├── explorer/   # SQL explorer page
│   │   │   │   ├── reports/    # Reports placeholder page
│   │   │   │   └── settings/   # Settings page (theme, views, data sources)
│   │   │   ├── embed/
│   │   │   │   └── dashboards/ # Embeddable dashboard (iframe-friendly)
│   │   │   └── index.tsx       # Root redirect to /dashboards
│   │   ├── pages/              # Empty (unused, routes/ is the active system)
│   │   ├── App.tsx             # Router provider
│   │   ├── main.tsx            # Entry point (AG Grid/Charts registration)
│   │   ├── index.css           # Tailwind + Shadcn CSS variables
│   │   └── routeTree.gen.ts    # Auto-generated route tree (do not edit)
│   ├── e2e/                    # Playwright E2E tests
│   ├── public/                 # Static assets
│   ├── vite.config.ts          # Vite config
│   ├── tsconfig.json           # TypeScript config (strict)
│   ├── tailwind.config.ts      # Tailwind CSS config
│   └── package.json            # Frontend dependencies
│
├── backend/                    # FastAPI sidecar
│   ├── app/
│   │   ├── api/                # Route handlers (thin controllers)
│   │   │   ├── router.py       # Aggregates all sub-routers
│   │   │   ├── dashboards.py   # Dashboard list, detail, KPI computation
│   │   │   ├── data_sources.py # Data source query, merge, distinct values
│   │   │   ├── databases.py    # Database CRUD (Superset proxy)
│   │   │   ├── charts.py       # Legacy chart data (hardcoded Superset queries)
│   │   │   ├── datasets.py     # Dataset listing (Superset proxy)
│   │   │   ├── sql.py          # SQL execution + history
│   │   │   ├── search.py       # Search endpoint
│   │   │   ├── custom.py       # Custom aggregation endpoints
│   │   │   ├── export.py       # PDF/Excel export stubs
│   │   │   └── views.py        # Saved views (in-memory store)
│   │   ├── services/           # Business logic layer
│   │   │   ├── superset_client.py     # Async Superset API client
│   │   │   ├── query_engine.py        # Template SQL builder + executor
│   │   │   ├── database_registrar.py  # Database config -> Superset sync
│   │   │   ├── config_store.py        # DB-backed config CRUD
│   │   │   ├── config_migrator.py     # Config schema migration pipeline
│   │   │   ├── merge_engine.py        # Multi-source data merge (outer/inner join)
│   │   │   └── uri_builder.py         # SQLAlchemy URI construction
│   │   ├── models/             # Pydantic request/response models
│   │   │   ├── base.py         # CamelModel (camelCase alias generator)
│   │   │   ├── dashboard_config.py    # Full dashboard config schema
│   │   │   ├── data_source_config.py  # Data source config schema
│   │   │   ├── database_config.py     # databases.json schema
│   │   │   ├── database.py     # Database CRUD request models
│   │   │   ├── chart_data.py   # Chart data response models
│   │   │   ├── dataset.py      # Dataset response models
│   │   │   ├── filters.py      # GlobalFilters, ChartDataRequest
│   │   │   ├── export.py       # Export request/status models
│   │   │   ├── views.py        # Saved view models
│   │   │   └── error.py        # Error response models
│   │   ├── core/               # Framework-level utilities
│   │   │   ├── dependencies.py # FastAPI DI: SupersetDep, ConfigStoreDep, QueryEngineDep, ResolvedDataSourceDep
│   │   │   └── errors.py       # Error sanitization (truncation, credential redaction)
│   │   ├── db/                 # SQLAlchemy models and engine
│   │   │   ├── engine.py       # Async engine + session factory
│   │   │   ├── base.py         # DeclarativeBase
│   │   │   └── models/
│   │   │       ├── dashboard.py    # RecvizDashboard (JSONB config)
│   │   │       └── data_source.py  # RecvizDataSource (JSONB config)
│   │   ├── migrations/         # Alembic (async, custom version table)
│   │   │   ├── env.py
│   │   │   └── versions/
│   │   │       └── 001_initial_schema.py
│   │   ├── config/             # Static config files
│   │   │   ├── databases.json           # Database connection definitions
│   │   │   ├── dashboards/              # JSON dashboard configs (for seeding)
│   │   │   ├── data_sources/            # JSON data source configs (for seeding)
│   │   │   └── seed/                    # SQLite seed database
│   │   ├── config.py           # Settings (pydantic-settings, reads .env)
│   │   └── main.py             # FastAPI app, lifespan, middleware
│   ├── tests/                  # Backend tests
│   └── requirements.txt        # Python dependencies
│
├── superset/                   # Superset configuration (installed via pip)
│   ├── superset_config.py      # Production config (PostgreSQL + Redis)
│   ├── superset_config_local.py # Local dev config
│   ├── Dockerfile              # Superset container build
│   └── superset-entrypoint.sh  # Init script (db upgrade, init, admin user)
│
├── docker/                     # Docker support files
│   └── init-db.sql             # PostgreSQL init (creates recon_data DB)
│
├── scripts/                    # Utility scripts
├── seed/                       # Seed data files
├── docs/                       # Documentation, plans, research
│
├── docker-compose.yml          # PostgreSQL + Redis + Superset
├── CLAUDE.md                   # Project conventions and context
└── .planning/                  # GSD planning artifacts
    └── codebase/               # Codebase analysis documents
```

## Directory Purposes

**`frontend/src/components/ui/`:**
- Purpose: Shadcn/ui component library -- owned code, not a dependency
- Contains: Primitives (Button, Card, Dialog, Select, Tabs, etc.) + custom additions (Empty, Spinner, Kbd, Timeline, Resizable)
- Key files: `sidebar.tsx`, `card.tsx`, `command.tsx`, `dialog.tsx`, `sonner.tsx`
- Rule: Do NOT modify these files unless absolutely necessary. Extend via composition in domain components.

**`frontend/src/components/dashboard/`:**
- Purpose: Config-driven dashboard rendering components
- Contains: All `config-*` prefixed components that render from `DashboardConfig`
- Key files:
  - `dashboard-renderer.tsx` -- orchestrates filter bar, KPIs, charts, grids, auto-refresh
  - `config-filter-bar.tsx` -- renders filter controls from config (single-select, multi-select, preset-range)
  - `config-chart-grid.tsx` -- renders charts in 12-column CSS grid with cross-filter + drill-down
  - `config-kpi-row.tsx` -- renders KPI cards with animated counters
  - `config-data-grid.tsx` -- renders AG Grid tables
  - `cross-filter-bar.tsx` -- shows active cross-filter chips
  - `drill-breadcrumb.tsx` -- navigation breadcrumb for drill-down state
  - `drill-detail-grid.tsx` -- detail-level AG Grid that appears at bottom of drill
  - `chart-toolbar.tsx` -- hover-revealed toolbar (export, fullscreen, refresh)
  - `chart-fullscreen-dialog.tsx` -- fullscreen chart dialog with identical state
  - `dashboard-toolbar.tsx` -- refresh button, auto-refresh controls
  - `auto-refresh-control.tsx` -- interval selector and countdown
  - `grid-toolbar.tsx` -- grid toolbar with export actions

**`frontend/src/components/charts/`:**
- Purpose: Chart rendering abstraction layer
- Contains: Factory pattern routing to AG Charts or ECharts
- Key files:
  - `chart-factory.tsx` -- routes by `vizType` to AG Charts or ECharts wrapper. Exposes unified `ChartRef` for export.
  - `ag-chart-wrapper.tsx` -- AG Charts Enterprise renderer
  - `echart-wrapper.tsx` -- ECharts renderer (exotic chart types only)
  - `unsupported-chart-error.tsx` -- error panel for unknown chart types
  - `column-missing-error.tsx` -- error panel when expected columns are missing

**`frontend/src/components/layout/`:**
- Purpose: App shell and navigation
- Contains: Sidebar, header, nav, theme toggle, command palette
- Key files:
  - `app-sidebar.tsx` -- collapsible sidebar with navigation groups
  - `header.tsx` -- top bar with breadcrumb and search
  - `nav-main.tsx` -- sidebar navigation items
  - `nav-user.tsx` -- user avatar and menu in sidebar footer
  - `search.tsx` -- Cmd+K search trigger
  - `command-palette.tsx` -- command dialog
  - `theme-provider.tsx` -- light/dark/system theme context
  - `theme-switch.tsx` -- theme toggle button

**`frontend/src/hooks/`:**
- Purpose: Custom React hooks wrapping TanStack Query and Zustand interactions
- Contains: Data fetching hooks, filter/drill hooks, utility hooks
- Key files:
  - `use-dashboard-config.ts` -- fetches dashboard JSON config
  - `use-dashboard-kpis.ts` -- fetches KPI values for a dashboard
  - `use-data-source-query.ts` -- executes a data source query with filters
  - `use-data-source-merge.ts` -- merges multiple data sources
  - `use-chart-data.ts` -- legacy chart data fetching (direct Superset)
  - `use-cross-filter.ts` -- applies cross-filters to chart data (client-side)
  - `use-cross-filter-data.ts` -- fetches KPI data sources for cross-filter recomputation
  - `use-drill-down.ts` -- per-chart drill state + client-side re-aggregation
  - `use-drill-detail.ts` -- detail-level data fetching at drill bottom
  - `use-filter-options.ts` -- fetches filter dropdown options from data sources
  - `use-auto-refresh.ts` -- auto-refresh timer with countdown
  - `use-dashboards.ts` -- fetches dashboard list
  - `use-databases.ts` -- fetches database list
  - `use-datasets.ts` -- fetches dataset list
  - `use-sql-execute.ts` -- SQL execution mutation
  - `use-sql-history.ts` -- SQL history query
  - `use-saved-views.ts` -- saved views CRUD
  - `use-search.ts` -- search hook
  - `use-prefetch.ts` -- prefetch utilities

**`frontend/src/stores/`:**
- Purpose: Zustand client state stores
- Contains: Filter and drill-down state
- Key files:
  - `filter-store.ts` -- filter values, locked filters, applied snapshot, cross-filters
  - `drill-store.ts` -- per-chart drill levels (Map<chartId, DrillLevel[]>)

**`frontend/src/lib/`:**
- Purpose: Shared utilities and infrastructure
- Contains: API client, query client config, formatters, chart themes, cross-filter logic
- Key files:
  - `api-client.ts` -- typed fetch wrapper with snake->camel key transform, `ApiError` class
  - `query-client.ts` -- TanStack Query client config (staleTime, gcTime, error toasts)
  - `cross-filter.ts` -- `applyCrossFilters()`, `rowPassesCrossFilters()`, `applyCrossFiltersToRows()`
  - `kpi-aggregator.ts` -- `recomputeKpis()` for client-side KPI recomputation under cross-filters
  - `formatters.ts` -- number/currency/percent formatting utilities
  - `chart-themes.ts` -- AG Charts and ECharts theme from Shadcn CSS variables
  - `chart-export.ts` -- chart PNG/SVG/CSV export utilities
  - `utils.ts` -- `cn()` class merge utility

**`frontend/src/types/`:**
- Purpose: Shared TypeScript type definitions
- Contains: All domain types used across components, hooks, and lib
- Key files:
  - `dashboard-config.ts` -- `DashboardConfig`, `FilterConfig`, `KpiConfig`, `DashboardChartConfig`, `GridConfig`, `KpiResult`, `DataSourceQueryResponse`
  - `filter.ts` -- `GlobalFilters`, `CrossFilter`, `DrillLevel`, `FilterValue`, `FilterState`
  - `chart.ts` -- `ChartDataResponse`, `ChartConfig`, `ChartWrapperProps`, `ChartClickEvent`, `ChartRef`
  - `dashboard.ts` -- dashboard list item type
  - `dataset.ts` -- dataset type
  - `database.ts` -- database type
  - `formatting.ts` -- column formatting config types
  - `api.ts` -- SQL result types
  - `views.ts` -- saved view types
  - `index.ts` -- barrel export (exception to no-barrel rule, only for types)

**`backend/app/api/`:**
- Purpose: Thin route handlers (validate -> call service -> return)
- Contains: FastAPI routers for each domain
- Key pattern: Import dependency types from `core/dependencies.py`, delegate to services

**`backend/app/services/`:**
- Purpose: Business logic isolated from HTTP layer
- Contains: Superset communication, query building, config management, data merging
- Key pattern: Services are injected via FastAPI `Depends()`. Singleton services stored on `app.state`.

**`backend/app/models/`:**
- Purpose: Pydantic v2 models for request/response validation
- Contains: All schema definitions used by API routes
- Key pattern: Backend uses `snake_case`. `CamelModel` base class provides camelCase aliases for legacy endpoints.

**`backend/app/db/`:**
- Purpose: SQLAlchemy ORM layer for RecViz-owned tables
- Contains: Async engine, session factory, ORM models
- Key pattern: JSONB columns store full config documents. Alembic with `recviz_alembic_version` table.

**`backend/app/config/`:**
- Purpose: Static configuration files and seed data
- Contains: `databases.json` (database connections), dashboard JSON configs, data source JSON configs, SQLite seed DB
- Key pattern: JSON configs seeded into PostgreSQL on first run via seed scripts

## Key File Locations

**Entry Points:**
- `frontend/src/main.tsx`: SPA entry -- AG Grid/Charts registration, React mount
- `frontend/src/App.tsx`: Router provider
- `backend/app/main.py`: FastAPI app creation, lifespan, CORS

**Configuration:**
- `backend/app/config.py`: `Settings` class (env vars via pydantic-settings)
- `backend/app/config/databases.json`: Database connection definitions
- `frontend/vite.config.ts`: Vite build configuration
- `frontend/tsconfig.json`: TypeScript configuration
- `docker-compose.yml`: Infrastructure services

**Core Logic:**
- `backend/app/services/query_engine.py`: SQL template resolution and execution
- `backend/app/services/superset_client.py`: Superset API communication
- `backend/app/services/database_registrar.py`: Database registration and routing
- `frontend/src/components/dashboard/dashboard-renderer.tsx`: Dashboard orchestration
- `frontend/src/components/dashboard/config-chart-grid.tsx`: Chart rendering with cross-filter + drill
- `frontend/src/lib/cross-filter.ts`: Cross-filter application logic
- `frontend/src/hooks/use-drill-down.ts`: Drill-down state and re-aggregation

**Testing:**
- `frontend/src/components/charts/ag-chart-wrapper.test.ts`
- `frontend/src/components/charts/chart-factory.test.tsx`
- `frontend/src/components/dashboard/grid-toolbar.test.tsx`
- `frontend/src/hooks/use-auto-refresh.test.ts`
- `frontend/src/lib/chart-export.test.ts`
- `frontend/src/lib/cross-filter.test.ts`
- `frontend/src/lib/formatters.test.ts`
- `frontend/src/lib/kpi-aggregator.test.ts`
- `frontend/src/stores/filter-store.test.ts`
- `frontend/src/stores/drill-store.test.ts`
- `backend/tests/`
- `frontend/e2e/`

## Naming Conventions

**Files:**
- React components: `kebab-case.tsx` (e.g., `config-chart-grid.tsx`, `error-boundary.tsx`)
- Hooks: `use-{name}.ts` (e.g., `use-dashboard-config.ts`, `use-cross-filter.ts`)
- Stores: `{name}-store.ts` (e.g., `filter-store.ts`, `drill-store.ts`)
- Types: `{name}.ts` (e.g., `dashboard-config.ts`, `filter.ts`)
- Utilities: `kebab-case.ts` (e.g., `api-client.ts`, `chart-export.ts`)
- Tests: `{name}.test.ts(x)` co-located with source (e.g., `cross-filter.test.ts`)
- Route pages: `index.tsx` or `$paramName.tsx` (TanStack Router convention)
- Python modules: `snake_case.py` (e.g., `superset_client.py`, `query_engine.py`)

**Directories:**
- `kebab-case` for frontend directories (e.g., `cell-renderers/`)
- `snake_case` for backend directories (e.g., `data_sources/`)

**Route Files (TanStack Router):**
- `__root.tsx` -- root layout (providers)
- `_app.tsx` -- layout route (underscore prefix = pathless layout)
- `_app/dashboards/index.tsx` -- `/dashboards` list page
- `_app/dashboards/$dashboardId.tsx` -- `/dashboards/:id` detail page
- `embed/dashboards/$dashboardId.tsx` -- `/embed/dashboards/:id` embed page

## Where to Add New Code

**New Dashboard Feature/Component:**
- Primary code: `frontend/src/components/dashboard/`
- Name it: `{feature-name}.tsx` (kebab-case)
- If it needs data: add a hook in `frontend/src/hooks/use-{feature}.ts`
- If it needs client state: add to existing store or create `frontend/src/stores/{name}-store.ts`
- Tests: co-located as `{feature-name}.test.tsx`

**New Chart Type:**
- If AG Charts supports it: add to `SUPPORTED_AG_TYPES` set in `frontend/src/components/charts/chart-factory.tsx` and handle in `ag-chart-wrapper.tsx`
- If exotic (ECharts only): add to `ECHART_TYPES` set in `chart-factory.tsx` and handle in `echart-wrapper.tsx`

**New API Endpoint:**
- Route handler: `backend/app/api/{domain}.py`
- Pydantic models: `backend/app/models/{domain}.py`
- Business logic: `backend/app/services/{service_name}.py`
- Register router: add `include_router()` in `backend/app/api/router.py`
- Add dependency if needed: `backend/app/core/dependencies.py`

**New Data Source Config:**
- JSON file: `backend/app/config/data_sources/{name}.json`
- Seed into DB via seed script or migration

**New Dashboard Config:**
- JSON file: `backend/app/config/dashboards/{name}.json`
- Seed into DB via seed script or migration

**New Frontend Page:**
- Create route file: `frontend/src/routes/_app/{section}/index.tsx` (for new section)
- Add to sidebar navigation: `frontend/src/components/layout/app-sidebar.tsx`
- Page component exports `Route = createFileRoute('/_app/{section}/')({ component: PageComponent })`

**New Shared Type:**
- Add to `frontend/src/types/{domain}.ts`
- Import directly from the file (no barrel imports from `types/index.ts` except for legacy types)

**New Shadcn Component:**
- Use `npx shadcn@latest add {component}` to copy into `frontend/src/components/ui/`
- Extend via composition in domain components, not by modifying the base file

**New Utility/Helper:**
- Frontend: `frontend/src/lib/{name}.ts`
- Backend: `backend/app/services/{name}.py` (if it has side effects) or `backend/app/core/{name}.py` (if pure utility)

**New Database Table:**
- SQLAlchemy model: `backend/app/db/models/{name}.py`
- Register import in `backend/app/db/models/__init__.py`
- Alembic migration: `backend/app/migrations/versions/{number}_{description}.py`

## Special Directories

**`frontend/src/components/ui/`:**
- Purpose: Shadcn/ui component library (copy-pasted, owned code)
- Generated: Yes (via `npx shadcn@latest add`)
- Committed: Yes
- Rule: Do not modify unless necessary. Extend via composition.

**`frontend/src/routeTree.gen.ts`:**
- Purpose: Auto-generated route tree for TanStack Router
- Generated: Yes (by TanStack Router file-based routing)
- Committed: Yes
- Rule: Do not edit manually. Regenerated when route files change.

**`frontend/.tanstack/`:**
- Purpose: TanStack Router temporary files
- Generated: Yes
- Committed: No

**`frontend/dist/`:**
- Purpose: Vite production build output
- Generated: Yes
- Committed: No

**`backend/app/config/seed/`:**
- Purpose: SQLite seed database for initial data loading
- Generated: Yes (via seed scripts)
- Committed: Yes

**`backend/app/migrations/`:**
- Purpose: Alembic database migrations
- Generated: Partially (auto-generated then edited)
- Committed: Yes
- Rule: Uses custom `recviz_alembic_version` table to avoid Superset migration conflicts

**`.planning/`:**
- Purpose: GSD workflow planning artifacts
- Generated: Yes (by GSD commands)
- Committed: Yes

**`_references/`:**
- Purpose: Reference UI kit (shadcn-ui-kit-dashboard) -- visual baseline for design
- Generated: No (external reference)
- Committed: Yes
- Rule: Adapt patterns from here into `src/components/`, do not import directly

---

*Structure analysis: 2026-04-05*
