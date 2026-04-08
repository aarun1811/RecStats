# Codebase Structure

**Analysis Date:** 2026-04-06

## Directory Layout

```
RecViz/
├── frontend/                    # React SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── components/          # UI components by domain
│   │   │   ├── charts/          # Chart wrappers, builder, library
│   │   │   │   └── builder/     # Multi-step chart builder wizard
│   │   │   ├── dashboard/       # Dashboard renderer, filter bar, KPIs, grids
│   │   │   ├── datasets/        # Dataset CRUD UI, editor, list
│   │   │   ├── embed/           # Embed-mode topbar
│   │   │   ├── explorer/        # SQL editor, schema browser, query results
│   │   │   ├── grid/            # AG Grid wrapper
│   │   │   │   └── cell-renderers/  # Custom AG Grid cell renderers
│   │   │   ├── layout/          # Sidebar, header, nav, theme
│   │   │   ├── settings/        # Data source management UI
│   │   │   ├── shared/          # Cross-cutting: error boundary, page transition, count animation
│   │   │   └── ui/              # Shadcn/ui base components (owned code)
│   │   ├── hooks/               # Custom React hooks (data fetching, state)
│   │   ├── lib/                 # Utilities, API client, chart themes, formatters
│   │   ├── pages/               # Empty (unused, routes/ is the routing layer)
│   │   ├── routes/              # TanStack Router file-based routes
│   │   │   ├── _app/            # Authenticated layout routes
│   │   │   │   ├── charts/      # Chart library, builder, edit
│   │   │   │   ├── dashboards/  # Dashboard list, individual dashboard
│   │   │   │   ├── datasets/    # Dataset list, editor, create
│   │   │   │   ├── explorer/    # SQL explorer
│   │   │   │   ├── reports/     # Reports (placeholder)
│   │   │   │   └── settings/    # Settings page
│   │   │   └── embed/           # Embed routes (no sidebar/header)
│   │   │       └── dashboards/  # Embeddable dashboard view
│   │   ├── stores/              # Zustand state stores
│   │   └── types/               # TypeScript type definitions
│   ├── e2e/                     # Playwright E2E tests
│   ├── dist/                    # Build output (gitignored)
│   ├── package.json             # Dependencies and scripts
│   ├── vite.config.ts           # Vite build config
│   ├── vitest.config.ts         # Vitest test config
│   ├── playwright.config.ts     # Playwright config
│   ├── tsconfig.json            # Root TS config (references app + node)
│   ├── tsconfig.app.json        # App TypeScript config
│   ├── tsconfig.node.json       # Node (Vite config) TypeScript config
│   ├── tsconfig.e2e.json        # Playwright TypeScript config
│   ├── eslint.config.js         # ESLint config
│   ├── components.json          # Shadcn/ui CLI config
│   └── index.html               # SPA entry HTML
├── backend/                     # FastAPI backend
│   ├── app/
│   │   ├── api/                 # Route handlers
│   │   │   ├── router.py        # Aggregate router (mounts all sub-routers)
│   │   │   ├── dashboards.py    # Dashboard config + KPI endpoints
│   │   │   ├── data_sources.py  # Data source query + merge + distinct endpoints
│   │   │   ├── charts.py        # Legacy Superset-proxied chart endpoints
│   │   │   ├── managed_charts.py    # RecViz-managed chart CRUD
│   │   │   ├── datasets.py      # Legacy Superset-proxied dataset endpoints
│   │   │   ├── managed_datasets.py  # RecViz-managed dataset CRUD
│   │   │   ├── databases.py     # Database connection CRUD + test
│   │   │   ├── sql.py           # SQL execution + history
│   │   │   ├── search.py        # Search endpoint (stub)
│   │   │   ├── export.py        # PDF/Excel export (stub)
│   │   │   ├── views.py         # Saved views (in-memory)
│   │   │   └── custom.py        # Custom/sidecar endpoints
│   │   ├── services/            # Business logic layer
│   │   │   ├── superset_client.py   # Async Superset REST API client
│   │   │   ├── query_engine.py      # SQL template builder + executor
│   │   │   ├── database_registrar.py # DB name -> Superset ID resolver
│   │   │   ├── config_store.py      # DB-backed dashboard/data-source config reader
│   │   │   ├── config_migrator.py   # Schema version migration pipeline
│   │   │   ├── merge_engine.py      # Multi-source data merge (outer/inner join)
│   │   │   ├── dataset_sync.py      # RecViz dataset -> Superset virtual dataset sync
│   │   │   ├── connection_status.py # In-memory DB connection health tracker
│   │   │   └── uri_builder.py       # SQLAlchemy URI construction from form fields
│   │   ├── models/              # Pydantic models (request/response + config schemas)
│   │   │   ├── dashboard_config.py  # Full dashboard config schema
│   │   │   ├── data_source_config.py # Data source config schema
│   │   │   ├── database_config.py   # databases.json schema
│   │   │   ├── managed_dataset.py   # Dataset CRUD DTOs
│   │   │   ├── managed_chart.py     # Chart CRUD DTOs
│   │   │   ├── chart_data.py        # Chart data response models
│   │   │   ├── dashboard.py         # Dashboard list response
│   │   │   ├── database.py          # Database CRUD DTOs
│   │   │   ├── dataset.py           # Legacy dataset models
│   │   │   ├── filters.py           # Legacy filter models
│   │   │   ├── export.py            # Export request/status models
│   │   │   ├── views.py             # Saved view models
│   │   │   ├── error.py             # Error response model
│   │   │   └── base.py              # CamelModel base class
│   │   ├── core/                # Framework utilities
│   │   │   ├── dependencies.py  # FastAPI Depends() definitions
│   │   │   └── errors.py        # Error sanitization
│   │   ├── db/                  # Database layer
│   │   │   ├── engine.py        # SQLAlchemy async engine + session factory
│   │   │   ├── base.py          # DeclarativeBase
│   │   │   └── models/          # SQLAlchemy ORM models
│   │   │       ├── dashboard.py     # RecvizDashboard (recviz_dashboards table)
│   │   │       ├── data_source.py   # RecvizDataSource (recviz_data_sources table)
│   │   │       ├── dataset.py       # RecvizDataset (recviz_datasets table)
│   │   │       └── chart.py         # RecvizChart (recviz_charts table)
│   │   ├── config/              # Static configuration files
│   │   │   ├── databases.json       # Database connection definitions
│   │   │   ├── databases.prod.json  # Production database connections
│   │   │   ├── dashboards/          # Dashboard JSON configs (seeded into DB)
│   │   │   ├── data_sources/        # Data source JSON configs (seeded into DB)
│   │   │   └── seed/                # Seed data for initial setup
│   │   ├── migrations/          # Alembic migrations
│   │   │   └── versions/
│   │   │       ├── 001_initial_schema.py   # dashboards + data_sources tables
│   │   │       ├── 002_add_datasets.py     # managed datasets table
│   │   │       └── 003_add_charts.py       # managed charts table
│   │   ├── config.py            # Pydantic Settings (env vars)
│   │   └── main.py              # FastAPI app factory + lifespan
│   ├── tests/                   # Backend tests (pytest)
│   ├── requirements.txt         # Python dependencies
│   └── .env                     # Local environment config (gitignored)
├── superset/                    # Superset configuration
│   ├── Dockerfile               # Superset Docker image
│   ├── superset_config.py       # Production Superset config
│   ├── superset_config_local.py # Local dev Superset config
│   └── superset-entrypoint.sh   # Docker entrypoint script
├── docker/                      # Docker supporting files
│   └── init-db.sql              # PostgreSQL init (creates recon_data DB)
├── seed/                        # Database seeding scripts
│   ├── create_recon_db.py       # Create recon data tables with sample data
│   ├── register_superset.py     # Register databases + datasets in Superset
│   ├── register_test_datasets.py # Register test datasets
│   └── seed-postgres.py         # Main seed script (dashboards + data sources into PostgreSQL)
├── scripts/                     # Utility scripts
│   ├── generate-seed-db.py      # Generate seed database
│   ├── seed-postgres.py         # Seed PostgreSQL with configs
│   └── setup-superset-local.sh  # Local Superset setup
├── docs/                        # Project documentation
│   ├── plans/                   # Phase plans
│   ├── research/                # Research documents
│   ├── testing/                 # Testing documentation
│   └── superpowers/             # Feature superpowers docs
├── _references/                 # Reference UI kit (Shadcn dashboard)
├── docker-compose.yml           # PostgreSQL + Redis + Superset
├── CLAUDE.md                    # AI agent project instructions
└── README.md                    # Project readme
```

## Directory Purposes

**`frontend/src/components/`:**
- Purpose: All React components organized by domain
- Contains: TSX component files, one primary component per file
- Key files: `dashboard/dashboard-renderer.tsx` (main dashboard orchestrator), `charts/chart-factory.tsx` (chart routing), `layout/app-sidebar.tsx` (navigation)

**`frontend/src/hooks/`:**
- Purpose: Custom React hooks, primarily TanStack Query wrappers for data fetching
- Contains: `use-*.ts` files, each wrapping `useQuery`/`useMutation`/`useQueries`
- Key files: `use-dashboard-config.ts`, `use-data-source-query.ts`, `use-chart-data.ts`, `use-cross-filter-data.ts`, `use-managed-datasets.ts`, `use-managed-charts.ts`

**`frontend/src/stores/`:**
- Purpose: Zustand stores for client-side state
- Contains: `filter-store.ts` (global filters + cross-filters + lock state), `drill-store.ts` (per-chart drill depth)

**`frontend/src/lib/`:**
- Purpose: Shared utilities, API client, chart infrastructure
- Contains: `api-client.ts` (fetch wrapper + key transform), `query-client.ts` (TanStack Query config), `chart-themes.ts` (AG Charts theme), `cross-filter.ts` (client-side filter logic), `kpi-aggregator.ts` (client-side KPI recomputation), `formatters.ts` (number/date formatting), `chart-export.ts` (PNG/CSV/clipboard export), `column-detection.ts` (auto-detect column types), `chart-compatibility.ts` (chart type validation)

**`frontend/src/types/`:**
- Purpose: Shared TypeScript interfaces and type definitions
- Contains: `dashboard-config.ts` (full dashboard config type), `chart.ts` (chart types + wrapper props), `filter.ts` (filter/cross-filter/drill types), `dataset.ts`, `managed-chart.ts`, `managed-dataset.ts`, `api.ts` (SQL result types)

**`frontend/src/routes/`:**
- Purpose: TanStack Router file-based routing
- Contains: Route files that auto-generate `routeTree.gen.ts`
- Key patterns: `_app.tsx` provides sidebar layout, `_app/` children are main app pages, `embed/` provides headerless layout

**`backend/app/api/`:**
- Purpose: FastAPI route handlers (thin -- validate, delegate to service, return)
- Contains: One file per domain with its own `APIRouter`
- Key files: `router.py` (aggregator), `dashboards.py` (config + KPIs), `data_sources.py` (query + merge + distinct), `managed_datasets.py` (CRUD), `managed_charts.py` (CRUD)

**`backend/app/services/`:**
- Purpose: Business logic, external API clients, data processing
- Contains: Service classes instantiated at app startup or per-request
- Key files: `superset_client.py` (Superset REST API), `query_engine.py` (SQL builder + executor), `database_registrar.py` (DB resolution), `config_store.py` (config reader)

**`backend/app/models/`:**
- Purpose: Pydantic v2 models for request/response validation and config schemas
- Contains: One file per domain
- Key files: `dashboard_config.py` (complete dashboard schema), `data_source_config.py` (data source schema)

**`backend/app/db/`:**
- Purpose: SQLAlchemy async ORM layer
- Contains: Engine/session setup, DeclarativeBase, ORM models
- Key files: `engine.py` (async engine), `models/dashboard.py` (JSONB config storage), `models/dataset.py` (managed datasets), `models/chart.py` (managed charts)

**`backend/app/config/`:**
- Purpose: Static JSON config files for dashboards and data sources (seeded into DB)
- Contains: `databases.json` (connection definitions), `dashboards/*.json`, `data_sources/*.json`
- Pattern: JSON files define configs that `seed-postgres.py` loads into `recviz_dashboards`/`recviz_data_sources` tables

## Key File Locations

**Entry Points:**
- `frontend/src/main.tsx`: React app bootstrap, AG Charts/Grid module registration
- `frontend/src/App.tsx`: Router provider setup
- `frontend/src/routes/__root.tsx`: Root layout (ThemeProvider, QueryClientProvider, Toaster)
- `frontend/src/routes/_app.tsx`: App layout (Sidebar, Header, animated outlet)
- `backend/app/main.py`: FastAPI app, lifespan (auth + DB sync + engine init), middleware

**Configuration:**
- `backend/app/config.py`: Pydantic Settings (env vars: superset_url, db URLs, etc.)
- `backend/app/config/databases.json`: Logical database definitions (name, URI, dialect, schema)
- `frontend/vite.config.ts`: Vite build config (path alias `@` -> `./src`)
- `frontend/vitest.config.ts`: Vitest test runner config
- `frontend/components.json`: Shadcn/ui CLI config
- `docker-compose.yml`: PostgreSQL 16 + Redis 7 + Superset

**Core Logic:**
- `backend/app/services/query_engine.py`: SQL template resolution + filter injection + Superset execution
- `backend/app/services/superset_client.py`: Authenticated async Superset API client
- `backend/app/services/database_registrar.py`: Database name-to-ID resolution + sync
- `backend/app/services/config_store.py`: DB-backed config reader with migration
- `frontend/src/lib/api-client.ts`: HTTP client with snake_case->camelCase transform
- `frontend/src/lib/cross-filter.ts`: Client-side cross-filter application
- `frontend/src/lib/kpi-aggregator.ts`: Client-side KPI re-aggregation for cross-filters
- `frontend/src/components/dashboard/dashboard-renderer.tsx`: Main dashboard orchestrator
- `frontend/src/components/charts/chart-factory.tsx`: Chart type routing (AG Charts vs ECharts)

**Testing:**
- `frontend/src/components/**/*.test.ts(x)`: Component unit tests (co-located)
- `frontend/src/lib/*.test.ts`: Utility unit tests (co-located)
- `frontend/src/hooks/*.test.ts`: Hook unit tests (co-located)
- `frontend/src/stores/*.test.ts`: Store unit tests (co-located)
- `frontend/e2e/`: Playwright E2E tests
- `backend/tests/`: Backend pytest tests

## Naming Conventions

**Files:**
- Components: `kebab-case.tsx` -- `dashboard-renderer.tsx`, `chart-factory.tsx`
- Hooks: `use-{name}.ts` -- `use-chart-data.ts`, `use-dashboard-config.ts`
- Stores: `{name}-store.ts` -- `filter-store.ts`, `drill-store.ts`
- Types: `{name}.ts` -- `chart.ts`, `filter.ts`, `dashboard-config.ts`
- Utilities: `kebab-case.ts` -- `api-client.ts`, `cross-filter.ts`
- Tests: `{name}.test.ts(x)` -- `chart-factory.test.tsx`, `filter-store.test.ts`
- Route pages: `index.tsx` or `$paramName.tsx` -- `index.tsx`, `$dashboardId.tsx`
- Python modules: `snake_case.py` -- `superset_client.py`, `query_engine.py`

**Directories:**
- Frontend components: `kebab-case/` -- `charts/`, `dashboard/`, `cell-renderers/`
- Backend modules: `snake_case/` -- `data_sources/`, `db/models/`
- Route segments: TanStack Router convention -- `_app/` (layout), `$param` (dynamic), `index.tsx` (default)

## Where to Add New Code

**New Dashboard Feature:**
- Dashboard component: `frontend/src/components/dashboard/{feature-name}.tsx`
- Data hook: `frontend/src/hooks/use-{feature-name}.ts`
- Backend endpoint: `backend/app/api/dashboards.py` (or new file if large)
- Config extension: `backend/app/models/dashboard_config.py` (add to DashboardConfig)
- Tests: Co-located `.test.ts(x)` file next to implementation

**New Chart Type:**
- Add to `SUPPORTED_AG_TYPES` or `ECHART_TYPES` in `frontend/src/components/charts/chart-factory.tsx`
- Add to `ChartType` union in `frontend/src/types/chart.ts`
- Handle series building in `frontend/src/components/charts/ag-chart-wrapper.tsx` or `echart-wrapper.tsx`
- Add type icon mapping in `frontend/src/components/charts/chart-type-icon.tsx`

**New API Endpoint:**
- Route handler: `backend/app/api/{domain}.py` (new file if new domain)
- Register in: `backend/app/api/router.py`
- Pydantic models: `backend/app/models/{domain}.py`
- Service logic: `backend/app/services/{service_name}.py`
- Dependency: `backend/app/core/dependencies.py` (if new injectable)

**New Managed Entity (like datasets/charts):**
- DB model: `backend/app/db/models/{entity}.py`
- Migration: `backend/app/migrations/versions/{NNN}_{description}.py`
- Pydantic DTOs: `backend/app/models/managed_{entity}.py`
- API routes: `backend/app/api/managed_{entity}s.py`
- Frontend types: `frontend/src/types/managed-{entity}.ts`
- Frontend hook: `frontend/src/hooks/use-managed-{entity}s.ts`
- Frontend component: `frontend/src/components/{entity}s/`

**New Shadcn/ui Component:**
- Add to: `frontend/src/components/ui/{component-name}.tsx`
- Use `cn()` from `frontend/src/lib/utils.ts` for class merging
- Compose in domain components -- do not modify ui/ base files

**New Data Source Config:**
- JSON file: `backend/app/config/data_sources/{name}.json`
- Seed: Add to `scripts/seed-postgres.py` or `seed/seed-postgres.py`
- Follow schema: `backend/app/models/data_source_config.py`

**New Dashboard Config:**
- JSON file: `backend/app/config/dashboards/{name}.json`
- Seed: Add to `scripts/seed-postgres.py` or `seed/seed-postgres.py`
- Follow schema: `backend/app/models/dashboard_config.py`

**Utilities:**
- Frontend shared helpers: `frontend/src/lib/{utility-name}.ts`
- Backend shared helpers: `backend/app/core/{utility-name}.py` or `backend/app/services/{service-name}.py`

## Special Directories

**`frontend/src/components/ui/`:**
- Purpose: Shadcn/ui base components (owned code, not a dependency)
- Generated: Initially by `shadcn` CLI, then manually maintained
- Committed: Yes
- Rule: Do not modify unless absolutely necessary; extend via composition

**`frontend/src/routeTree.gen.ts`:**
- Purpose: Auto-generated route tree from file-based routes
- Generated: Yes, by TanStack Router Vite plugin on file change
- Committed: Yes
- Rule: Never edit manually -- regenerated on route file changes

**`frontend/dist/`:**
- Purpose: Vite production build output
- Generated: Yes, by `pnpm build`
- Committed: No (gitignored)

**`backend/app/migrations/`:**
- Purpose: Alembic database migrations (uses separate `recviz_alembic_version` table to avoid Superset conflicts)
- Generated: Manually created
- Committed: Yes
- Rule: Never modify existing migrations; create new ones for schema changes

**`_references/`:**
- Purpose: Reference Shadcn UI kit dashboard for visual patterns
- Generated: No (external reference)
- Committed: Yes
- Rule: Read-only reference; adapt patterns into `frontend/src/components/`

**`.planning/`:**
- Purpose: GSD workflow planning artifacts and codebase analysis
- Generated: By GSD workflow commands
- Committed: Yes

## Route Structure

**Main App Routes (under `/_app` layout):**
| Route | File | Component |
|-------|------|-----------|
| `/` | `routes/index.tsx` | Redirects to `/dashboards` |
| `/dashboards` | `routes/_app/dashboards/index.tsx` | Dashboard list |
| `/dashboards/$dashboardId` | `routes/_app/dashboards/$dashboardId.tsx` | Dashboard view |
| `/charts` | `routes/_app/charts/index.tsx` | Chart library |
| `/charts/new` | `routes/_app/charts/new.tsx` | Chart builder |
| `/charts/$chartId/edit` | `routes/_app/charts/$chartId.edit.tsx` | Chart editor |
| `/datasets` | `routes/_app/datasets/index.tsx` | Dataset list |
| `/datasets/new` | `routes/_app/datasets/new.tsx` | Dataset creator |
| `/datasets/$datasetId/edit` | `routes/_app/datasets/$datasetId.edit.tsx` | Dataset editor |
| `/explorer` | `routes/_app/explorer/index.tsx` | SQL explorer |
| `/reports` | `routes/_app/reports/index.tsx` | Reports (placeholder) |
| `/settings` | `routes/_app/settings/index.tsx` | Settings (theme, views, data sources) |

**Embed Routes (no sidebar/header):**
| Route | File | Component |
|-------|------|-----------|
| `/embed/dashboards/$dashboardId` | `routes/embed/dashboards/$dashboardId.tsx` | Embeddable dashboard |

## API Route Prefixes

| Prefix | File | Purpose |
|--------|------|---------|
| `/api/dashboards` | `backend/app/api/dashboards.py` | Dashboard config + KPI computation |
| `/api/data-sources` | `backend/app/api/data_sources.py` | Config-driven data queries + merge |
| `/api/databases` | `backend/app/api/databases.py` | Database connection CRUD + test |
| `/api/charts` | `backend/app/api/charts.py` | Legacy Superset chart proxy |
| `/api/charts/managed` | `backend/app/api/managed_charts.py` | RecViz chart CRUD |
| `/api/datasets` | `backend/app/api/datasets.py` | Legacy Superset dataset proxy |
| `/api/datasets/managed` | `backend/app/api/managed_datasets.py` | RecViz dataset CRUD |
| `/api/sql` | `backend/app/api/sql.py` | SQL execution + history |
| `/api/export` | `backend/app/api/export.py` | PDF/Excel export (stub) |
| `/api/views` | `backend/app/api/views.py` | Saved views (in-memory) |
| `/health` | `backend/app/main.py` | Health check |

---

*Structure analysis: 2026-04-06*
