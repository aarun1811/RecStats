# Codebase Structure

**Analysis Date:** 2026-04-09

## Directory Layout

```
RecViz/
├── frontend/                    # React SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── components/          # All React components
│   │   │   ├── builder/         # Dashboard builder UI (canvas, toolbar, pickers, dialogs)
│   │   │   ├── charts/          # Chart wrappers, factory, builder, library CRUD
│   │   │   │   └── builder/     # Chart builder wizard steps
│   │   │   ├── dashboard/       # Dashboard renderer, filter bar, KPI row, chart grid, data grid, toolbar
│   │   │   ├── datasets/        # Dataset editor, library, CRUD dialogs
│   │   │   ├── embed/           # Embed-mode topbar
│   │   │   ├── explorer/        # SQL editor, schema browser, query results, history
│   │   │   ├── grid/            # AG Grid helpers
│   │   │   │   └── cell-renderers/  # Custom AG Grid cell renderers (amount, SLA, status)
│   │   │   ├── kpis/            # KPI builder, library, CRUD
│   │   │   │   └── builder/     # KPI builder wizard steps
│   │   │   ├── layout/          # App shell: sidebar, header, nav, theme, search
│   │   │   ├── settings/        # Settings page: data sources tab, connection management
│   │   │   ├── shared/          # Reusable: error boundary, error panel, count animation, page transition
│   │   │   └── ui/              # Shadcn/ui primitives (owned code, not a dependency)
│   │   ├── hooks/               # Custom TanStack Query hooks and other hooks
│   │   ├── lib/                 # Utilities: API client, formatters, cross-filter, chart themes, etc.
│   │   ├── routes/              # TanStack Router file-based pages
│   │   │   ├── _app/            # App layout routes (with sidebar + header)
│   │   │   │   ├── charts/      # /charts, /charts/new, /charts/$chartId/edit
│   │   │   │   ├── dashboards/  # /dashboards, /dashboards/new, /dashboards/$id, /dashboards/$id/edit
│   │   │   │   ├── datasets/    # /datasets, /datasets/new, /datasets/$id/edit
│   │   │   │   ├── explorer/    # /explorer
│   │   │   │   ├── kpis/        # /kpis, /kpis/new, /kpis/$kpiId/edit
│   │   │   │   ├── reports/     # /reports
│   │   │   │   └── settings/    # /settings
│   │   │   └── embed/           # Embed routes (no sidebar/header)
│   │   │       └── dashboards/  # /embed/dashboards/$dashboardId
│   │   ├── stores/              # Zustand state stores
│   │   ├── types/               # Shared TypeScript type definitions
│   │   ├── main.tsx             # React entry point (AG Grid/Charts registration)
│   │   ├── App.tsx              # Router provider
│   │   ├── index.css            # Tailwind + Shadcn CSS variables
│   │   └── routeTree.gen.ts     # Auto-generated route tree (TanStack Router)
│   ├── e2e/                     # Playwright E2E tests
│   ├── public/                  # Static assets
│   ├── package.json             # Frontend dependencies
│   ├── pnpm-lock.yaml           # pnpm lockfile
│   ├── vite.config.ts           # Vite build config
│   ├── vitest.config.ts         # Vitest test config
│   ├── playwright.config.ts     # Playwright E2E config
│   ├── tsconfig.json            # TypeScript project references
│   ├── tsconfig.app.json        # App TypeScript config (strict mode)
│   ├── eslint.config.js         # ESLint flat config
│   └── components.json          # Shadcn/ui CLI config
├── backend/                     # FastAPI backend
│   ├── app/
│   │   ├── api/                 # Route handlers (one file per domain)
│   │   │   ├── router.py        # Aggregates all routers
│   │   │   ├── managed_dashboards.py  # CRUD for dashboards
│   │   │   ├── managed_charts.py      # CRUD for charts
│   │   │   ├── managed_kpis.py        # CRUD for KPIs
│   │   │   ├── managed_datasets.py    # CRUD for datasets
│   │   │   ├── data_sources.py        # Query data sources + merge + distinct values
│   │   │   ├── databases.py           # Database connection CRUD + test
│   │   │   ├── sql.py                 # SQL Explorer execute + history + db list
│   │   │   ├── search.py             # Cross-entity search
│   │   │   ├── export.py             # PDF/Excel export stubs
│   │   │   └── views.py              # Saved views (in-memory)
│   │   ├── core/                # Cross-cutting: dependencies, errors
│   │   │   ├── dependencies.py  # FastAPI DI types (DbSessionDep, QueryEngineDep, etc.)
│   │   │   └── errors.py        # sanitize_detail() error utility
│   │   ├── db/                  # Database layer
│   │   │   ├── engine.py        # Async engine + session factory for metadata DB
│   │   │   ├── base.py          # SQLAlchemy DeclarativeBase
│   │   │   ├── types.py         # PortableJSON cross-dialect type
│   │   │   └── models/          # ORM models
│   │   │       ├── dashboard.py     # recviz_dashboards
│   │   │       ├── data_source.py   # recviz_data_sources
│   │   │       ├── dataset.py       # recviz_datasets
│   │   │       ├── chart.py         # recviz_charts
│   │   │       ├── kpi.py           # recviz_kpis
│   │   │       └── connection.py    # recviz_connections
│   │   ├── migrations/          # Alembic migrations
│   │   │   ├── alembic.ini      # Uses recviz_alembic_version table
│   │   │   ├── env.py           # Alembic environment
│   │   │   └── versions/        # Migration scripts (001-007)
│   │   ├── models/              # Pydantic request/response models
│   │   │   ├── base.py              # CamelModel (auto camelCase aliases)
│   │   │   ├── managed_dashboard.py # Dashboard create/update/response
│   │   │   ├── managed_chart.py     # Chart create/update/response
│   │   │   ├── managed_kpi.py       # KPI create/update/response
│   │   │   ├── managed_dataset.py   # Dataset create/update/response
│   │   │   ├── data_source_config.py  # DataSourceConfig, DatabaseRouting, FilterMapping
│   │   │   ├── database.py          # DatabaseCreate/Update, TestConnectionRequest
│   │   │   ├── chart_data.py        # Chart data response shapes
│   │   │   ├── dataset.py           # Dataset list response
│   │   │   ├── filters.py           # Filter models
│   │   │   ├── error.py             # Error response model
│   │   │   ├── export.py            # Export request/status
│   │   │   └── views.py             # SavedView models
│   │   ├── services/            # Business logic services
│   │   │   ├── query_engine.py      # QueryExecutor (builds SQL, executes)
│   │   │   ├── engine_manager.py    # Async engine pool per connection
│   │   │   ├── connection_resolver.py  # Logical DB name -> connection UUID
│   │   │   ├── connection_status.py    # In-memory health tracker
│   │   │   ├── config_store.py      # Data source config reader
│   │   │   ├── merge_engine.py      # Multi-source data merging
│   │   │   ├── encryption.py        # Fernet password encryption
│   │   │   ├── uri_builder.py       # SQLAlchemy URI construction
│   │   │   ├── query_utils.py       # Column normalization, type detection, pagination, read-only validation
│   │   │   └── config_migrator.py   # Data source config schema migration
│   │   ├── config.py            # Pydantic Settings (env vars)
│   │   └── main.py              # FastAPI app, lifespan, middleware
│   ├── tests/                   # Backend tests
│   └── requirements.txt         # Python dependencies
├── docker/                      # Docker support files
│   └── init-db.sql              # Creates recon_data database
├── docker-compose.yml           # PostgreSQL 16 (local dev)
├── deployment/                  # Production deployment configs (empty/pending)
├── docs/                        # Documentation
│   ├── plans/                   # Implementation plans
│   ├── research/                # Research documents
│   ├── superpowers/             # Feature specs
│   └── testing/                 # Test documentation
├── .planning/                   # GSD planning artifacts
│   ├── codebase/                # Codebase analysis documents (this directory)
│   ├── milestones/              # Milestone plans
│   ├── phases/                  # Phase execution artifacts
│   └── research/                # Research documents
├── CLAUDE.md                    # Project conventions and instructions
└── CODEBASE_GUIDE.md            # Detailed file-level codebase reference
```

## Directory Purposes

**`frontend/src/components/`:**
- Purpose: All React components, organized by feature domain
- Contains: `.tsx` files, one primary component per file
- Key files: `dashboard/dashboard-renderer.tsx` (main dashboard view), `charts/chart-factory.tsx` (chart type routing), `builder/builder-page.tsx` (dashboard builder), `layout/app-sidebar.tsx` (navigation)

**`frontend/src/components/ui/`:**
- Purpose: Shadcn/ui primitives -- owned code, copy-pasted in via CLI
- Contains: `button.tsx`, `card.tsx`, `dialog.tsx`, `select.tsx`, `sidebar.tsx`, etc.
- Key files: `sonner.tsx` (toast), `sidebar.tsx` (sidebar layout system), `command.tsx` (command palette)

**`frontend/src/hooks/`:**
- Purpose: Custom hooks wrapping TanStack Query for data fetching and other reusable hook logic
- Contains: `use-*.ts` files, each wrapping `useQuery` or `useMutation`
- Key files: `use-data-source-query.ts` (core data fetching), `use-managed-dashboards.ts` (CRUD), `use-dashboard-kpis.ts` (KPI aggregation), `use-cross-filter-data.ts` (cross-filter re-aggregation)

**`frontend/src/stores/`:**
- Purpose: Zustand stores for client-side UI state
- Contains: `*-store.ts` files with interface + create() pattern
- Key files: `filter-store.ts` (filter values + cross-filters), `drill-store.ts` (per-chart drill state), `builder-store.ts` (dashboard builder state), `layout-history-store.ts` (undo/redo)

**`frontend/src/lib/`:**
- Purpose: Utilities, API client, pure functions, constants
- Contains: `kebab-case.ts` utility modules
- Key files: `api-client.ts` (HTTP client with snake->camel transform), `query-client.ts` (TanStack Query config), `cross-filter.ts` (client-side filtering), `dashboard-url-state.ts` (URL <-> filter sync), `formatters.ts` (number/date formatting), `chart-themes.ts` (AG Charts/ECharts theming), `chart-export.ts` (PNG/CSV/clipboard export)

**`frontend/src/types/`:**
- Purpose: Shared TypeScript type definitions
- Contains: One file per domain entity
- Key files: `dashboard-config.ts` (DashboardConfig, FilterConfig, ChartConfig, GridConfig, KpiConfig), `chart.ts` (ChartType, ChartConfig, ChartWrapperProps, ChartRef), `filter.ts` (CrossFilter, DrillLevel, FilterValue), `managed-dashboard.ts`, `managed-chart.ts`, `managed-kpi.ts`, `managed-dataset.ts`

**`frontend/src/routes/`:**
- Purpose: TanStack Router file-based route definitions
- Contains: Page components that define routes
- Key files: `__root.tsx` (root layout with providers), `_app.tsx` (app shell with sidebar), `index.tsx` (redirect to /dashboards), `_app/dashboards/$dashboardId.tsx` (dashboard view), `embed/dashboards/$dashboardId.tsx` (embeddable dashboard)

**`backend/app/api/`:**
- Purpose: FastAPI route handlers, one file per entity/domain
- Contains: `APIRouter` definitions with thin handler functions
- Key files: `data_sources.py` (query execution endpoint), `managed_dashboards.py` (dashboard CRUD), `databases.py` (connection management), `sql.py` (SQL Explorer), `search.py` (cross-entity search), `router.py` (aggregates all routers)

**`backend/app/services/`:**
- Purpose: Business logic and external service interaction
- Contains: Service classes and utility modules
- Key files: `query_engine.py` (SQL template building + execution), `engine_manager.py` (async engine pool), `connection_resolver.py` (DB name resolution), `encryption.py` (credential encryption), `merge_engine.py` (multi-source data merge), `query_utils.py` (column normalization, type detection, pagination, read-only validation)

**`backend/app/db/models/`:**
- Purpose: SQLAlchemy ORM models for RecViz metadata tables
- Contains: One model per table, all prefixed `recviz_`
- Key files: `dashboard.py` (recviz_dashboards), `data_source.py` (recviz_data_sources), `connection.py` (recviz_connections), `dataset.py` (recviz_datasets), `chart.py` (recviz_charts), `kpi.py` (recviz_kpis)

**`backend/app/models/`:**
- Purpose: Pydantic request/response models for API validation
- Contains: `CamelModel` base class + domain-specific models
- Key files: `base.py` (CamelModel with auto-camelCase aliases), `data_source_config.py` (DataSourceConfig, FilterMapping, DatabaseRouting), `managed_dashboard.py`, `managed_chart.py`, `managed_kpi.py`, `managed_dataset.py`, `database.py`

**`backend/app/core/`:**
- Purpose: Cross-cutting infrastructure: dependency injection, error handling
- Contains: `dependencies.py` (all `Annotated[..., Depends(...)]` types), `errors.py` (sanitize_detail)

**`backend/app/migrations/`:**
- Purpose: Alembic database schema migrations
- Contains: Migration scripts numbered `001` through `007`
- Key files: `alembic.ini` (uses `recviz_alembic_version` table to avoid Superset conflicts), `versions/001_initial_schema.py` through `versions/007_dataset_database_id_to_string.py`

## Key File Locations

**Entry Points:**
- `frontend/src/main.tsx`: React app mount + AG Grid/Charts module registration
- `frontend/src/App.tsx`: Router provider setup
- `frontend/src/routes/__root.tsx`: Root layout (ThemeProvider, QueryClient, Toaster)
- `backend/app/main.py`: FastAPI app definition, lifespan, middleware, router mounting

**Configuration:**
- `backend/app/config.py`: Pydantic Settings (`recon_db_url`, `recviz_db_url`, `recviz_encryption_key`)
- `frontend/vite.config.ts`: Vite build config (React, Tailwind, TanStack Router plugins)
- `frontend/tsconfig.app.json`: TypeScript strict config (`@/*` path alias)
- `frontend/eslint.config.js`: ESLint flat config (TypeScript + React plugins)
- `frontend/vitest.config.ts`: Vitest with node environment
- `frontend/playwright.config.ts`: Chromium-only E2E config
- `frontend/components.json`: Shadcn/ui CLI config (new-york style, neutral base)
- `docker-compose.yml`: PostgreSQL 16 for local dev

**Core Logic:**
- `backend/app/services/query_engine.py`: SQL template building and execution (QueryExecutor)
- `backend/app/services/engine_manager.py`: Async SQLAlchemy engine pool management
- `backend/app/services/connection_resolver.py`: Logical DB name -> connection UUID resolution
- `backend/app/services/query_utils.py`: Column normalization, type detection, pagination, read-only validation
- `frontend/src/lib/api-client.ts`: HTTP client with snake->camel transform and ApiError
- `frontend/src/lib/cross-filter.ts`: Client-side cross-filter row filtering
- `frontend/src/lib/dashboard-url-state.ts`: Bidirectional URL <-> filter state sync
- `frontend/src/lib/kpi-aggregator.ts`: Client-side KPI re-aggregation for cross-filters
- `frontend/src/components/charts/chart-factory.tsx`: Chart type router (AG Charts vs ECharts)
- `frontend/src/components/dashboard/dashboard-renderer.tsx`: Main dashboard orchestrator

**Testing:**
- `frontend/src/lib/*.test.ts`: Unit tests for utility modules (cross-filter, formatters, chart-compatibility, etc.)
- `frontend/src/stores/*.test.ts`: Zustand store tests
- `frontend/src/components/**/*.test.ts(x)`: Component tests
- `frontend/e2e/`: Playwright E2E tests
- `backend/tests/`: Backend tests

## Naming Conventions

**Files:**
- Components: `kebab-case.tsx` (e.g., `config-filter-bar.tsx`, `chart-factory.tsx`)
- Hooks: `use-{name}.ts` (e.g., `use-data-source-query.ts`, `use-managed-dashboards.ts`)
- Stores: `{name}-store.ts` (e.g., `filter-store.ts`, `builder-store.ts`)
- Types: `{name}.ts` in `types/` (e.g., `dashboard-config.ts`, `chart.ts`)
- Utils: `kebab-case.ts` in `lib/` (e.g., `api-client.ts`, `cross-filter.ts`)
- Tests: `{name}.test.ts(x)` co-located with source (e.g., `cross-filter.test.ts`)
- Python: `snake_case.py` (e.g., `query_engine.py`, `managed_dashboards.py`)

**Directories:**
- Feature domains: `kebab-case` (e.g., `dashboard/`, `charts/`, `explorer/`)
- Entity-grouped: plural form (e.g., `datasets/`, `kpis/`, `models/`)
- Sub-features: nested directories (e.g., `charts/builder/`, `kpis/builder/`)

**Routes (TanStack Router file-based):**
- List pages: `index.tsx` (e.g., `routes/_app/dashboards/index.tsx` -> `/dashboards`)
- Detail pages: `$paramName.tsx` (e.g., `$dashboardId.tsx` -> `/dashboards/:dashboardId`)
- Edit pages: `$paramName.edit.tsx` (e.g., `$dashboardId.edit.tsx` -> `/dashboards/:dashboardId/edit`)
- Create pages: `new.tsx` (e.g., `new.tsx` -> `/dashboards/new`)
- Layout routes: `_app.tsx` (prefix underscore = layout-only, no URL segment)

**Database Tables:**
- All prefixed `recviz_` (e.g., `recviz_dashboards`, `recviz_connections`, `recviz_data_sources`)
- Alembic version table: `recviz_alembic_version` (avoids conflict with Superset's `alembic_version`)

## Where to Add New Code

**New Dashboard Feature (renderer-side):**
- Component: `frontend/src/components/dashboard/{feature-name}.tsx`
- Hook (if data-fetching): `frontend/src/hooks/use-{feature-name}.ts`
- Types: Add to `frontend/src/types/dashboard-config.ts`
- Wire into `frontend/src/components/dashboard/dashboard-renderer.tsx`

**New Managed Entity (CRUD for charts, KPIs, etc.):**
- Backend ORM model: `backend/app/db/models/{entity}.py`
- Backend Pydantic models: `backend/app/models/managed_{entity}.py`
- Backend API router: `backend/app/api/managed_{entities}.py`
- Register in: `backend/app/api/router.py`
- Frontend types: `frontend/src/types/managed-{entity}.ts`
- Frontend hooks: `frontend/src/hooks/use-managed-{entities}.ts`
- Frontend components: `frontend/src/components/{entities}/` (library list, card, row, toolbar, builder, detail panel, delete dialog)
- Frontend routes: `frontend/src/routes/_app/{entities}/index.tsx`, `new.tsx`, `$entityId.edit.tsx`
- Alembic migration: `backend/app/migrations/versions/{next_number}_{description}.py`

**New Chart Type:**
- If standard (bar, line, etc.): Add to `SUPPORTED_AG_TYPES` in `frontend/src/components/charts/chart-factory.tsx`, handle in `frontend/src/components/charts/ag-chart-wrapper.tsx`
- If exotic (sankey, radar, etc.): Add to `ECHART_TYPES` in `chart-factory.tsx`, handle in `frontend/src/components/charts/echart-wrapper.tsx`
- Add type to `ChartType` union in `frontend/src/types/chart.ts`

**New Backend Service:**
- Service class: `backend/app/services/{service_name}.py`
- Initialize in lifespan: `backend/app/main.py` (store on `app.state`)
- DI dependency: `backend/app/core/dependencies.py` (add `get_{service}` + `Annotated` type)

**New Backend API Route:**
- Router file: `backend/app/api/{domain}.py`
- Register in: `backend/app/api/router.py` via `api_router.include_router()`
- Pydantic models: `backend/app/models/{domain}.py`

**New Utility Function:**
- Frontend: `frontend/src/lib/{utility-name}.ts`
- Frontend test: `frontend/src/lib/{utility-name}.test.ts`
- Backend: `backend/app/services/{utility_name}.py` (or add to existing service)

**New Shadcn/ui Component:**
- Run `npx shadcn add {component}` from `frontend/` directory
- Component lands in `frontend/src/components/ui/{component}.tsx`
- Do NOT modify base `ui/` files -- extend via composition in domain components

**New Zustand Store:**
- Store: `frontend/src/stores/{name}-store.ts`
- Pattern: Define `interface {Name}Store` above `create<{Name}Store>()`, export `use{Name}Store`
- Test: `frontend/src/stores/{name}-store.test.ts`

**New Page/Route:**
- Route file: `frontend/src/routes/_app/{section}/index.tsx` (or `$param.tsx` for detail)
- TanStack Router auto-generates the route tree on save
- Must export `Route = createFileRoute(...)` with component

## Special Directories

**`frontend/src/components/ui/`:**
- Purpose: Shadcn/ui base primitives
- Generated: Yes (via `npx shadcn add`)
- Committed: Yes
- Rule: Do NOT modify these files. Extend via composition in domain components.

**`frontend/src/routeTree.gen.ts`:**
- Purpose: Auto-generated TanStack Router route tree
- Generated: Yes (by TanStack Router plugin on file change)
- Committed: Yes (version controlled)
- Rule: Never edit manually. Add/remove route files in `routes/` instead.

**`frontend/node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (via `pnpm install`)
- Committed: No

**`frontend/dist/`:**
- Purpose: Production build output
- Generated: Yes (via `pnpm build`)
- Committed: No

**`backend/app/migrations/versions/`:**
- Purpose: Alembic database schema migrations
- Generated: Partially (via `alembic revision --autogenerate`)
- Committed: Yes
- Rule: Use `recviz_alembic_version` table (configured in `alembic.ini`) to avoid Superset migration conflicts.

**`.planning/`:**
- Purpose: GSD workflow planning artifacts
- Generated: Yes (by GSD commands)
- Committed: Yes

**`_references/`:**
- Purpose: Reference UI kit (shadcn-ui-kit-dashboard) used as visual baseline
- Generated: No
- Committed: Yes
- Rule: Read-only reference. Copy and adapt patterns into `src/components/`.

---

*Structure analysis: 2026-04-09*
