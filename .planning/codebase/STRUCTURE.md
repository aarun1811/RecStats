# Codebase Structure

**Analysis Date:** 2026-04-04

## Directory Layout

```
RecViz/
├── frontend/                    # React SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/          # AG Charts + ECharts wrappers, chart factory
│   │   │   ├── dashboard/       # Config-driven + legacy dashboard components
│   │   │   ├── embed/           # Embed mode topbar
│   │   │   ├── explorer/        # SQL editor, schema browser, query results, chart builder
│   │   │   ├── grid/            # AG Grid wrapper, toolbar, cell renderers
│   │   │   ├── layout/          # Sidebar, header, nav, theme provider/switch, command palette
│   │   │   ├── settings/        # Data source management UI
│   │   │   ├── shared/          # Error boundary, page transition, count animation
│   │   │   └── ui/              # Shadcn/ui base components (owned code, not a dependency)
│   │   ├── hooks/               # Custom hooks wrapping TanStack Query
│   │   ├── lib/                 # API client, query client, utils, chart themes, cross-filter
│   │   ├── pages/               # (empty — routes are in routes/)
│   │   ├── routes/              # TanStack Router file-based routes
│   │   │   ├── __root.tsx       # Root layout (providers, toaster)
│   │   │   ├── _app.tsx         # App shell layout (sidebar + header)
│   │   │   ├── _app/
│   │   │   │   ├── dashboards/  # Dashboard list + detail pages
│   │   │   │   ├── explorer/    # SQL data explorer page
│   │   │   │   ├── reports/     # Reports page
│   │   │   │   └── settings/    # Settings page
│   │   │   ├── embed/
│   │   │   │   └── dashboards/  # Embeddable dashboard (no sidebar/header)
│   │   │   └── index.tsx        # Root redirect to /dashboards
│   │   ├── stores/              # Zustand state stores
│   │   └── types/               # TypeScript type definitions
│   ├── public/                  # Static assets
│   ├── index.html               # HTML entry point
│   ├── vite.config.ts           # Vite config (React, Tailwind, TanStack Router, @ alias)
│   ├── tsconfig.json            # TypeScript project references
│   ├── tsconfig.app.json        # App-specific TS config
│   ├── eslint.config.js         # ESLint config
│   ├── components.json          # Shadcn/ui CLI config
│   └── package.json             # Dependencies + scripts
│
├── backend/                     # FastAPI backend
│   ├── app/
│   │   ├── api/                 # Route handlers (thin controllers)
│   │   │   ├── router.py        # Aggregates all route modules
│   │   │   ├── dashboards.py    # Config-driven dashboard endpoints
│   │   │   ├── data_sources.py  # Data source query + merge + distinct endpoints
│   │   │   ├── charts.py        # Legacy chart endpoints (Superset datasource-based)
│   │   │   ├── sql.py           # SQL Lab execution + history
│   │   │   ├── databases.py     # Database CRUD (Superset proxy)
│   │   │   ├── datasets.py      # Dataset listing + data (Superset proxy)
│   │   │   ├── search.py        # Global search endpoint
│   │   │   ├── custom.py        # Legacy KPI + aggregation endpoints
│   │   │   ├── export.py        # PDF/Excel export stubs
│   │   │   └── views.py         # Saved views CRUD
│   │   ├── config/              # JSON configuration files
│   │   │   ├── dashboards/      # Dashboard config JSONs
│   │   │   ├── data_sources/    # Data source config JSONs
│   │   │   ├── databases.json   # Database connection registry
│   │   │   └── seed/            # SQLite seed database for local dev
│   │   ├── core/                # Framework concerns
│   │   │   └── dependencies.py  # FastAPI Depends() injection definitions
│   │   ├── models/              # Pydantic v2 models
│   │   │   ├── base.py          # CamelModel base class
│   │   │   ├── dashboard_config.py  # Dashboard config schema
│   │   │   ├── data_source_config.py # Data source config schema
│   │   │   ├── database_config.py   # Database connection schema
│   │   │   ├── filters.py       # Legacy filter models
│   │   │   ├── chart_data.py    # Chart data request/response
│   │   │   ├── database.py      # Database CRUD models
│   │   │   ├── dataset.py       # Dataset models
│   │   │   ├── export.py        # Export request/status
│   │   │   └── views.py         # Saved view models
│   │   ├── services/            # Business logic
│   │   │   ├── superset_client.py    # Async Superset REST API client
│   │   │   ├── query_engine.py       # SQL builder + executor
│   │   │   ├── config_store.py       # JSON config loader + registry
│   │   │   ├── database_registrar.py # DB sync + name resolution
│   │   │   ├── merge_engine.py       # Multi-source row merge
│   │   │   └── uri_builder.py        # SQLAlchemy URI constructor
│   │   ├── config.py            # pydantic-settings app configuration
│   │   ├── main.py              # FastAPI app factory + lifespan
│   │   └── mock_data.py         # Mock data for fallback mode
│   ├── tests/                   # pytest test files
│   │   ├── test_config_store.py
│   │   ├── test_database_registrar.py
│   │   ├── test_merge_engine.py
│   │   └── test_query_engine.py
│   └── requirements.txt         # Python dependencies
│
├── superset/                    # Superset configuration
│   ├── superset_config.py       # Production Superset config
│   ├── superset_config_local.py # Local dev overrides
│   └── Dockerfile               # Superset Docker image
│
├── docker/                      # Docker support files
│   └── init-db.sql              # PostgreSQL init script
│
├── docker-compose.yml           # PostgreSQL + Redis + Superset
│
├── scripts/                     # Utility scripts
├── seed/                        # Seed data utilities
├── docs/                        # Documentation
│   ├── plans/                   # Implementation plans
│   ├── research/                # Research documents
│   ├── superpowers/             # Gemini review, plans, specs
│   └── testing/                 # Testing documentation
│
├── _references/                 # Reference UI kit (shadcn-ui-kit-dashboard)
├── CLAUDE.md                    # Project context and conventions
└── .gitignore
```

## Directory Purposes

**`frontend/src/components/charts/`:**
- Purpose: Chart rendering abstraction layer
- Contains: `chart-factory.tsx` (router), `ag-chart-wrapper.tsx` (AG Charts), `echart-wrapper.tsx` (ECharts)
- Key files: `chart-factory.tsx` dispatches to correct wrapper based on viz type

**`frontend/src/components/dashboard/`:**
- Purpose: All dashboard-related components for both config-driven and legacy systems
- Contains: Config-driven (`config-filter-bar.tsx`, `config-kpi-row.tsx`, `config-chart-grid.tsx`, `config-data-grid.tsx`, `dashboard-renderer.tsx`) and legacy (`filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx`, `chart-panel.tsx`, `cross-filter-bar.tsx`, `drill-breadcrumb.tsx`, `kpi-card.tsx`)
- Key files: `dashboard-renderer.tsx` is the primary orchestrator for config-driven dashboards

**`frontend/src/components/explorer/`:**
- Purpose: SQL data explorer IDE components
- Contains: `sql-editor.tsx` (Monaco), `schema-browser.tsx`, `query-results.tsx` (AG Grid), `query-history.tsx`, `chart-builder-dialog.tsx`

**`frontend/src/components/grid/`:**
- Purpose: AG Grid wrapper and custom cell renderers for legacy grid
- Contains: `data-grid.tsx`, `grid-toolbar.tsx`, `cell-renderers/amount-cell.tsx`, `cell-renderers/sla-cell.tsx`, `cell-renderers/status-cell.tsx`

**`frontend/src/components/layout/`:**
- Purpose: Application shell -- sidebar, header, navigation, theming
- Contains: `app-sidebar.tsx`, `header.tsx`, `nav-main.tsx`, `nav-user.tsx`, `search.tsx`, `command-palette.tsx`, `theme-provider.tsx`, `theme-switch.tsx`

**`frontend/src/components/settings/`:**
- Purpose: Data source management CRUD UI
- Contains: `data-sources-tab.tsx`, `data-source-card.tsx`, `data-source-row.tsx`, `data-source-sheet.tsx`, `data-sources-toolbar.tsx`

**`frontend/src/components/shared/`:**
- Purpose: Cross-cutting UI utilities
- Contains: `error-boundary.tsx`, `page-transition.tsx`, `count-animation.tsx`

**`frontend/src/components/ui/`:**
- Purpose: Shadcn/ui base component library (copy-pasted, owned code)
- Contains: 30+ components: `button.tsx`, `card.tsx`, `dialog.tsx`, `sidebar.tsx`, `command.tsx`, `select.tsx`, `tabs.tsx`, `tooltip.tsx`, `skeleton.tsx`, `badge.tsx`, `sonner.tsx`, etc.
- Note: Do not modify these directly. Extend via composition in domain components.

**`frontend/src/hooks/`:**
- Purpose: Custom hooks wrapping TanStack Query for data fetching
- Contains: 18 hook files covering dashboard configs, KPIs, data source queries, filter options, SQL execution, databases, datasets, search, saved views, breaks, cross-filter, drill-down, prefetch
- Key files: `use-dashboard-config.ts`, `use-data-source-query.ts`, `use-dashboard-kpis.ts`, `use-filter-options.ts`, `use-data-source-merge.ts`

**`frontend/src/lib/`:**
- Purpose: Utilities and framework configuration
- Contains: `api-client.ts` (fetch wrapper with snake->camel transform), `query-client.ts` (TanStack Query config), `utils.ts` (cn utility), `chart-themes.ts` (AG Charts theme from CSS vars), `cross-filter.ts` (client-side filtering)

**`frontend/src/stores/`:**
- Purpose: Zustand state stores
- Contains: `filter-store.ts` (filter values, applied state, locked filters, cross-filters), `drill-store.ts` (drill-down breadcrumb stack)

**`frontend/src/types/`:**
- Purpose: Shared TypeScript interfaces
- Contains: `dashboard-config.ts`, `filter.ts`, `chart.ts`, `api.ts`, `dashboard.ts`, `database.ts`, `dataset.ts`, `views.ts`, `index.ts`

**`frontend/src/routes/`:**
- Purpose: TanStack Router file-based route definitions
- Contains: `__root.tsx` (providers), `_app.tsx` (shell layout), `_app/dashboards/` (list + detail), `_app/explorer/`, `_app/reports/`, `_app/settings/`, `embed/dashboards/` (iframe mode), `index.tsx` (redirect)

**`backend/app/api/`:**
- Purpose: FastAPI route handlers (thin controllers)
- Contains: 10 route modules aggregated by `router.py`
- Key files: `dashboards.py` (config-driven), `data_sources.py` (config-driven queries + merge), `charts.py` (legacy), `sql.py` (explorer), `databases.py` (CRUD)

**`backend/app/services/`:**
- Purpose: Core business logic and external API clients
- Contains: 6 service files
- Key files: `query_engine.py` (SQL building + execution), `superset_client.py` (Superset REST client), `config_store.py` (JSON config registry), `database_registrar.py` (DB sync + resolution), `merge_engine.py` (row joining)

**`backend/app/models/`:**
- Purpose: Pydantic v2 validation models
- Contains: 10 model files covering configs, requests, responses

**`backend/app/config/`:**
- Purpose: JSON configuration files that drive the entire config-driven dashboard system
- Contains: `dashboards/` (dashboard definitions), `data_sources/` (SQL templates + routing), `databases.json` (connection registry), `seed/` (SQLite dev DB)

## Key File Locations

**Entry Points:**
- `frontend/src/main.tsx`: React app bootstrap (AG module registration, root render)
- `frontend/src/App.tsx`: Creates TanStack Router
- `frontend/src/routes/__root.tsx`: Root layout (providers)
- `frontend/src/routes/_app.tsx`: App shell (sidebar + header + outlet)
- `backend/app/main.py`: FastAPI app factory + lifespan (startup/shutdown)

**Configuration:**
- `frontend/vite.config.ts`: Vite config (React, Tailwind CSS, TanStack Router, `@` alias)
- `frontend/tsconfig.app.json`: TypeScript strict config with path aliases
- `frontend/eslint.config.js`: ESLint config
- `frontend/components.json`: Shadcn/ui CLI configuration
- `backend/app/config.py`: pydantic-settings configuration (Superset URL, credentials, Redis, DB)
- `backend/app/config/databases.json`: Database connection definitions
- `superset/superset_config.py`: Superset configuration (DB, Redis, CORS, Celery, cache)
- `docker-compose.yml`: PostgreSQL + Redis + Superset containers

**Core Logic:**
- `backend/app/services/query_engine.py`: Central query builder and executor
- `backend/app/services/superset_client.py`: Superset REST API client with auth
- `backend/app/services/config_store.py`: Dashboard and data source config registry
- `backend/app/services/database_registrar.py`: Database sync and name resolution
- `backend/app/services/merge_engine.py`: Multi-source row merge engine
- `frontend/src/components/dashboard/dashboard-renderer.tsx`: Dashboard orchestrator
- `frontend/src/lib/api-client.ts`: Frontend HTTP client with snake->camel transform

**Testing:**
- `backend/tests/test_config_store.py`: ConfigStore unit tests
- `backend/tests/test_database_registrar.py`: DatabaseRegistrar unit tests
- `backend/tests/test_merge_engine.py`: MergeEngine unit tests
- `backend/tests/test_query_engine.py`: QueryEngine unit tests

## Naming Conventions

**Files:**
- Frontend components: `kebab-case.tsx` (e.g., `config-filter-bar.tsx`, `ag-chart-wrapper.tsx`)
- Frontend hooks: `use-{name}.ts` (e.g., `use-dashboard-config.ts`, `use-filter-options.ts`)
- Frontend stores: `{name}-store.ts` (e.g., `filter-store.ts`, `drill-store.ts`)
- Frontend types: `{name}.ts` (e.g., `dashboard-config.ts`, `filter.ts`)
- Frontend utils: `kebab-case.ts` (e.g., `api-client.ts`, `chart-themes.ts`)
- Backend Python: `snake_case.py` (e.g., `superset_client.py`, `query_engine.py`)
- Config JSON: `kebab-case.json` for dashboards (e.g., `tlm-stats.json`), `snake_case.json` for data sources (e.g., `tlm_automatch.json`)

**Directories:**
- Frontend: `kebab-case` (e.g., `cell-renderers/`)
- Backend: `snake_case` (e.g., `data_sources/`)

**Routes:**
- File-based TanStack Router: `$paramName.tsx` for dynamic segments, `index.tsx` for index routes
- Layout routes: `_app.tsx` (underscore prefix = layout, no URL segment)

## Where to Add New Code

**New Dashboard:**
- Create JSON config: `backend/app/config/dashboards/{dashboard-id}.json` (follow `tlm-stats.json` pattern)
- Data sources if needed: `backend/app/config/data_sources/{source-id}.json`
- No frontend code changes needed -- `ConfigStore` auto-loads new JSONs, dashboard appears in list

**New Data Source:**
- Create config: `backend/app/config/data_sources/{source-id}.json`
- Define `query` (SQL template with `{{filters}}` placeholder), `filter_mappings`, `database_routing`, `columns`
- Reference from dashboard config's KPI sources, chart sources, or grid data sources

**New Frontend Component:**
- Component file: `frontend/src/components/{category}/{component-name}.tsx`
- Test file: `frontend/src/components/{category}/{component-name}.test.tsx` (co-located)
- Export: Named export (no barrel files, import directly from file path)

**New API Endpoint:**
- Route handler: `backend/app/api/{module}.py` (new file or add to existing)
- Register in: `backend/app/api/router.py`
- Request/response models: `backend/app/models/{name}.py`
- Service logic: `backend/app/services/{name}.py`
- Inject dependencies via `backend/app/core/dependencies.py` typed aliases

**New Hook:**
- File: `frontend/src/hooks/use-{name}.ts`
- Pattern: Wrap `useQuery` or `useMutation` from TanStack Query
- Query key convention: `['entity-name', identifier, filters]`
- Use `api.get()` or `api.post()` from `frontend/src/lib/api-client.ts`

**New Store:**
- File: `frontend/src/stores/{name}-store.ts`
- Pattern: `create<StoreInterface>((set) => ({ ... }))`
- Selectors: Consumers use `useStore((s) => s.specificField)` for selective re-renders

**New Type:**
- Frontend: `frontend/src/types/{name}.ts`
- Backend: `backend/app/models/{name}.py`
- Keep in sync: Frontend types mirror backend Pydantic models (camelCase vs snake_case)

**New Shadcn/ui Component:**
- Use Shadcn CLI or copy from reference kit
- Location: `frontend/src/components/ui/{component}.tsx`
- Do not modify existing ui/ files; extend via composition

**New Page/Route:**
- File: `frontend/src/routes/_app/{section}/index.tsx` or `frontend/src/routes/_app/{section}/$paramName.tsx`
- Use `createFileRoute()` with the matching path string
- Page components use `default export` (TanStack Router requirement)
- TanStack Router auto-generates `routeTree.gen.ts`

**New Backend Test:**
- File: `backend/tests/test_{module}.py`
- Follow existing pytest patterns in `backend/tests/`

## Special Directories

**`frontend/src/components/ui/`:**
- Purpose: Shadcn/ui base components
- Generated: Yes (via Shadcn CLI, then owned)
- Committed: Yes
- Note: Treat as owned code but prefer extending via composition over modification

**`frontend/src/routeTree.gen.ts`:**
- Purpose: Auto-generated route tree from file-based routes
- Generated: Yes (by TanStack Router Vite plugin)
- Committed: Yes
- Note: Do not edit manually; regenerated on route file changes

**`frontend/.tanstack/`:**
- Purpose: TanStack Router temp files
- Generated: Yes
- Committed: No (or should not be)

**`frontend/dist/`:**
- Purpose: Vite production build output
- Generated: Yes
- Committed: No

**`backend/app/config/seed/`:**
- Purpose: SQLite seed database for local development (simulates Oracle/Hive data)
- Generated: Yes (by `scripts/generate-seed-db.py`)
- Committed: Yes (seed.db binary)

**`_references/`:**
- Purpose: Reference UI kit (shadcn-ui-kit-dashboard) for visual patterns
- Generated: No
- Committed: Yes
- Note: Source of truth for component adaptation; see CLAUDE.md for adaptation rules

**`docs/`:**
- Purpose: Design documents, research, plans, specs
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-04-04*
