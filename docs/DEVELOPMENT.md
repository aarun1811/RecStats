<!-- generated-by: gsd-doc-writer -->
# Development Guide

This document covers everything a developer needs to fork, build, lint, and contribute to RecViz — the custom BI and visualization platform for reconciliation data.

## Local Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd RecViz
```

### 2. Start infrastructure services

Docker Compose provides PostgreSQL 16 and Redis 7 (plus a Superset container). All three must be healthy before starting the backend.

```bash
docker compose up -d
```

Wait for the health checks to pass. Superset can take 60+ seconds on first boot (it runs `superset db upgrade`, creates the admin user, and calls `superset init`).

```bash
docker compose ps   # All services should show "healthy"
```

> **Alternative: Native Superset.** If you prefer running Superset outside Docker (e.g., for debugging), use the setup script. This uses SQLite for Superset metadata instead of PostgreSQL:
>
> ```bash
> python -m venv .venv && source .venv/bin/activate
> pip install apache-superset oracledb cachelib
> bash scripts/setup-superset-local.sh
> SUPERSET_CONFIG_PATH=$(pwd)/superset/superset_config_local.py .venv/bin/superset run -p 8088
> ```

### 3. Seed the development database

Generate the seed SQLite database with reconciliation test data. This also updates `backend/app/config/databases.json` with the correct absolute path.

```bash
python scripts/generate-seed-db.py
```

The seed script creates tables (`bank`, `message_feed`, `item`, `tlm_bdr_relationship_header`, `recon_bank`, `mr_csum_man_match_stats_hist`) with synthetic data mimicking production Oracle schemas.

### 4. Install and start the backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Run Alembic migrations (RecViz uses its own version table `recviz_alembic_version` to avoid conflicts with Superset's migrations):

```bash
cd app/migrations
alembic upgrade head
cd ../..
```

Start the FastAPI backend:

```bash
uvicorn app.main:app --reload
```

The backend runs on `http://localhost:8000`. On startup it authenticates to Superset, syncs database connections from `app/config/databases.json`, runs dataset reconciliation, and initializes the `QueryEngine`.

### 5. Install and start the frontend

```bash
cd frontend
pnpm install
pnpm dev
```

The frontend dev server runs on `http://localhost:5173`. It proxies all API calls to the backend via the `VITE_API_BASE_URL` environment variable (defaults to `http://localhost:8000`).

### Startup order

Services must start in this order:

1. **Docker Compose** (PostgreSQL + Redis + Superset)
2. **Superset healthy** (wait for `curl http://localhost:8088/health`)
3. **FastAPI backend** (`uvicorn`) — authenticates to Superset on startup
4. **Frontend** (`pnpm dev`)

## Build Commands

### Frontend (`frontend/package.json`)

| Command | Description |
|---|---|
| `pnpm dev` | Start the Vite dev server with HMR on port 5173 |
| `pnpm build` | Type-check with `tsc -b`, then produce a production build via `vite build` |
| `pnpm lint` | Run ESLint across all `.ts` and `.tsx` files |
| `pnpm preview` | Serve the production build locally for verification |

### Backend

| Command | Description |
|---|---|
| `uvicorn app.main:app --reload` | Start FastAPI with auto-reload (run from `backend/`) |
| `alembic upgrade head` | Apply pending database migrations (run from `backend/app/migrations/`) |
| `alembic revision --autogenerate -m "description"` | Generate a new migration from model changes |
| `python -m pytest tests/` | Run backend unit tests (run from `backend/`) |

### Scripts (`scripts/`)

| Command | Description |
|---|---|
| `python scripts/generate-seed-db.py` | Generate the SQLite seed database with synthetic recon data |
| `python scripts/seed-postgres.py` | Seed data into the PostgreSQL recon_data database |
| `bash scripts/setup-superset-local.sh` | One-time Superset setup for native (non-Docker) local dev |

## Code Style

### TypeScript / Frontend

**ESLint** is the primary linter, configured in `frontend/eslint.config.js` (flat config format).

- Extends: `@eslint/js` recommended, `typescript-eslint` recommended, `react-hooks` flat recommended, `react-refresh` Vite config
- Targets: `**/*.{ts,tsx}` files
- Ignores: `dist/` directory
- Run: `pnpm lint` from the `frontend/` directory

No Prettier or Biome configuration is present. Code formatting relies on ESLint rules and editor defaults.

**TypeScript** is configured in strict mode (`frontend/tsconfig.app.json`):

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- Target: ES2022, module: ESNext, JSX: react-jsx
- Path alias: `@/*` maps to `./src/*`

### Python / Backend

No linter configuration file (ruff, flake8, mypy) is present in the backend. Follow these conventions from the project standards:

- All endpoints must be `async def`
- All models use Pydantic v2
- Service layer pattern: route handlers call services, not external APIs directly
- Config via `pydantic-settings` (`BaseSettings` class)

### File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| React components | `kebab-case.tsx` | `kpi-card.tsx`, `filter-bar.tsx` |
| Hooks | `use-{name}.ts` | `use-chart-data.ts` |
| Zustand stores | `{name}-store.ts` | `filter-store.ts` |
| TypeScript types | `{name}.ts` | `chart.ts`, `filter.ts` |
| Utilities | `kebab-case.ts` | `api-client.ts`, `chart-themes.ts` |
| Route pages | `index.tsx` or `$paramName.tsx` | `index.tsx` |
| Tests | `{name}.test.ts(x)` | `chart-factory.test.tsx` |
| Python modules | `snake_case.py` | `superset_client.py` |

### Key Code Conventions

- **Named exports** for all components, hooks, stores, and utilities. Exception: page components use `default export` (required by TanStack Router).
- **No barrel exports** (`index.ts` re-exports). Import directly from the source file.
- **No `any`** type. Use `unknown` + type narrowing.
- **Functional components only.** No class components.
- **Props interface** named `{ComponentName}Props`, defined above the component.
- **Imports order**: React, external libs, internal `@/` paths, relative paths, types. Blank line between groups.
- **Shadcn/ui components** in `src/components/ui/` are owned code (copy-pasted, not a dependency). Extend via composition; do not modify base `ui/` files.
- **Tailwind**: Only Shadcn CSS variable colors (`text-foreground`, `bg-background`, etc.). Never hardcode hex/rgb/hsl values.

## Branch Conventions

No branch naming convention is formally documented. The project does not have a `.github/PULL_REQUEST_TEMPLATE.md` or `CONTRIBUTING.md` with branch rules.

Current active branch: `project/recviz-refresh`. The main branch is `main`.

Recommended pattern based on existing branch names:

- `project/{name}` for major feature branches
- `fix/{description}` for bug fixes
- `docs/{description}` for documentation changes

## PR Process

No pull request template or formal review process is documented in the repository. The project does not have a `.github/PULL_REQUEST_TEMPLATE.md` file or CI workflows for automated checks.

Recommended practices:

- Ensure `pnpm build` passes (type-check + production build) before opening a PR
- Run `pnpm lint` and fix any ESLint errors
- Run backend tests with `python -m pytest tests/` from `backend/`
- Test both light and dark mode for any UI changes
- Verify the full stack works end-to-end (Docker services + backend + frontend)

## Project Structure

```
RecViz/
├── frontend/                    # React SPA (pnpm)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # Shadcn/ui primitives (30+ components)
│   │   │   ├── layout/          # Sidebar, header, theme, command palette
│   │   │   ├── dashboard/       # Config-driven filter bar, KPIs, chart grid, data grid
│   │   │   ├── charts/          # AG Chart/EChart wrappers, chart factory, chart builder
│   │   │   ├── grid/            # AG Grid cell renderers
│   │   │   ├── explorer/        # SQL editor, schema browser, query results
│   │   │   ├── datasets/        # Dataset CRUD UI
│   │   │   ├── settings/        # Data source management
│   │   │   ├── shared/          # Error boundary, page transitions, count animation
│   │   │   └── embed/           # Embedded dashboard topbar
│   │   ├── hooks/               # 25+ custom hooks (data fetching, cross-filter, drill-down)
│   │   ├── stores/              # Zustand stores (filter-store, drill-store)
│   │   ├── lib/                 # API client, query client, chart themes, utilities
│   │   ├── routes/              # TanStack Router file-based routes
│   │   └── types/               # Shared TypeScript type definitions
│   ├── e2e/                     # Playwright E2E tests
│   ├── eslint.config.js         # ESLint flat config
│   ├── vite.config.ts           # Vite build config (React + Tailwind + TanStack Router)
│   ├── vitest.config.ts         # Vitest unit test config
│   └── playwright.config.ts     # Playwright E2E config
├── backend/                     # FastAPI (Python 3.12+)
│   ├── app/
│   │   ├── api/                 # Route handlers (12 routers)
│   │   ├── services/            # Business logic (Superset client, query engine, DB registrar)
│   │   ├── models/              # Pydantic models
│   │   ├── config/              # Database configs, dashboard configs, data source configs
│   │   ├── db/                  # SQLAlchemy async engine, ORM models
│   │   ├── migrations/          # Alembic migrations (recviz_alembic_version table)
│   │   ├── config.py            # pydantic-settings (env vars)
│   │   └── main.py              # FastAPI app, lifespan, middleware
│   ├── tests/                   # pytest unit tests
│   └── requirements.txt         # Python dependencies
├── superset/                    # Superset container config
│   ├── Dockerfile               # Python 3.12 + apache-superset + drivers
│   ├── superset_config.py       # Docker Superset config (PostgreSQL + Redis)
│   ├── superset_config_local.py # Native Superset config (SQLite + SimpleCache)
│   └── superset-entrypoint.sh   # Container init (migrate, create admin, start)
├── docker/
│   └── init-db.sql              # Creates recon_data database on first boot
├── scripts/                     # Dev utility scripts
├── seed/                        # Seed data registration scripts
└── docker-compose.yml           # PostgreSQL 16 + Redis 7 + Superset
```

## Backend API Routers

The FastAPI backend mounts 12 routers via `app/api/router.py`:

| Router | File | Purpose |
|---|---|---|
| Dashboards | `dashboards.py` | Config-driven dashboard CRUD |
| Data Sources | `data_sources.py` | Data source configuration |
| Databases | `databases.py` | Database connection management |
| Managed Charts | `managed_charts.py` | Persisted chart definitions |
| Charts | `charts.py` | Chart data queries |
| Managed Datasets | `managed_datasets.py` | Persisted dataset definitions |
| Datasets | `datasets.py` | Dataset proxy to Superset |
| SQL | `sql.py` | SQL Lab query execution |
| Search | `search.py` | Search functionality |
| Custom | `custom.py` | Custom aggregation endpoints |
| Export | `export.py` | PDF/Excel export (stubbed) |
| Views | `views.py` | Saved view management |

## Database Migrations

RecViz uses Alembic for its own schema migrations, separate from Superset's internal migrations. The key distinction:

- **RecViz migrations** use the `recviz_alembic_version` table (configured in `backend/app/migrations/env.py`)
- **Superset migrations** use the standard `alembic_version` table (managed by `superset db upgrade`)

Both coexist in the same PostgreSQL database (`superset_meta`) without conflict.

To create a new migration after modifying ORM models in `backend/app/db/models/`:

```bash
cd backend/app/migrations
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

Current migration chain: `001_initial_schema` → `002_add_datasets` → `003_add_charts`.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `SUPERSET_URL` | `http://localhost:8088` | Superset REST API base URL |
| `SUPERSET_USERNAME` | `admin` | Superset admin username |
| `SUPERSET_PASSWORD` | `admin` | Superset admin password |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection string |
| `RECON_DB_URL` | `postgresql://recviz:recviz_dev@localhost:5432/recon_data` | Recon data database |
| `RECVIZ_DB_URL` | `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta` | RecViz metadata (async) |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | FastAPI backend URL |

See [CONFIGURATION.md](./CONFIGURATION.md) for the complete configuration reference.

## Testing

### Frontend unit tests

Vitest is configured in `frontend/vitest.config.ts` with `globals: true` and `node` environment. E2E tests in `e2e/` are excluded from the Vitest runner.

```bash
cd frontend
pnpm vitest         # Watch mode
pnpm vitest run     # Single run
```

Existing test files in `frontend/src/lib/`: `chart-compatibility.test.ts`, `chart-export.test.ts`, `column-detection.test.ts`, `column-merge.test.ts`, `cross-filter.test.ts`, `formatters.test.ts`, `kpi-aggregator.test.ts`.

Additional tests: `frontend/src/stores/drill-store.test.ts`, `frontend/src/stores/filter-store.test.ts`, `frontend/src/components/charts/ag-chart-wrapper.test.ts`, `frontend/src/components/charts/chart-factory.test.tsx`, `frontend/src/components/dashboard/grid-toolbar.test.tsx`.

### Frontend E2E tests

Playwright is configured in `frontend/playwright.config.ts`. The full stack must be running.

```bash
cd frontend
npx playwright test --reporter=list
```

E2E test files: `e2e/chart-showcase.spec.ts`, `e2e/tlm-stats-regression.spec.ts`.

### Backend tests

pytest with test files in `backend/tests/`:

```bash
cd backend
python -m pytest tests/ -v
```

Test files cover: `config_store`, `connection_status`, `database_registrar`, `dataset_sync`, `managed_charts`, `managed_datasets`, `merge_engine`, `query_engine`, `uri_builder`.

See [GETTING_STARTED.md](./GETTING_STARTED.md) for prerequisite setup and [ARCHITECTURE.md](./ARCHITECTURE.md) for system design context.
