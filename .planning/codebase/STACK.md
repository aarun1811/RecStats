# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- TypeScript ~5.9.3 - Frontend SPA (`frontend/src/`)
- Python 3.12+ - Backend API and query engine (`backend/app/`)

**Secondary:**
- SQL - Data source queries, Alembic migrations (`backend/app/config/seed/`, `backend/app/migrations/versions/`)
- Shell/Bash - Setup and seed scripts (`scripts/`, `superset/superset-entrypoint.sh`)

## Runtime

**Environment:**
- Node.js (version not pinned; no `.nvmrc`) - Frontend dev server and build
- Python 3.12+ (specified in `superset/Dockerfile`: `python:3.12-slim`) - Backend + Superset container
- Docker - PostgreSQL, Redis, Superset containers via `docker-compose.yml`

**Package Manager:**
- pnpm - Frontend (lockfile: `frontend/pnpm-lock.yaml`)
- pip - Backend (no `pyproject.toml`; uses `backend/requirements.txt`)

## Frameworks

**Core:**
- React 19.2.0 - Frontend UI framework (`frontend/src/`)
- FastAPI 0.128.6 - Backend HTTP API (`backend/app/main.py`)
- Apache Superset (latest from pip) - Headless query engine, runs in Docker (`superset/Dockerfile`)

**Testing:**
- Vitest 4.1.2 - Unit tests (`frontend/vitest.config.ts`)
- Playwright 1.59.1 - E2E tests (`frontend/playwright.config.ts`, `frontend/e2e/`)
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - DOM assertion matchers

**Build/Dev:**
- Vite 7.3.1 - Frontend bundler and dev server (`frontend/vite.config.ts`)
- @vitejs/plugin-react 5.1.1 - React Fast Refresh for Vite
- @tailwindcss/vite 4.1.18 - Tailwind CSS integration as Vite plugin
- TanStack Router Plugin 1.159.5 - File-based route generation (`frontend/src/routeTree.gen.ts`)
- Uvicorn 0.40.0 - ASGI server for FastAPI
- Alembic 1.18.4 - Database schema migrations (`backend/app/migrations/`)

**Linting/Formatting:**
- ESLint 9.39.1 - TypeScript linting (`frontend/eslint.config.js`)
- typescript-eslint 8.48.0 - TypeScript ESLint rules
- eslint-plugin-react-hooks 7.0.1 - React hooks lint rules
- eslint-plugin-react-refresh 0.4.24 - React refresh lint rules
- No Prettier configured (no `.prettierrc` found)

## Key Dependencies

### Frontend Critical

- `@tanstack/react-router` 1.159.5 - File-based routing (`frontend/src/routes/`)
- `@tanstack/react-query` 5.90.20 - Server state management (`frontend/src/lib/query-client.ts`)
- `zustand` 5.0.11 - Client state management (`frontend/src/stores/`)
- `ag-grid-enterprise` 35.0.1 - Enterprise data grid (`frontend/src/main.tsx` registers AllEnterpriseModule)
- `ag-charts-enterprise` 13.0.1 - Enterprise charting (`frontend/src/main.tsx` registers AllChartsEnterpriseModule)
- `echarts` 6.0.0 + `echarts-for-react` 3.0.6 - Exotic chart types only (Sankey, radar, gauge, etc.)

### Frontend UI

- `radix-ui` 1.4.3 + `@radix-ui/react-slot` 1.2.4 - Headless UI primitives
- `shadcn` 3.8.4 (devDep) - CLI for adding Shadcn/ui components (components live in `frontend/src/components/ui/`)
- `tailwindcss` 4.1.18 - Utility-first CSS (`frontend/src/index.css`)
- `tw-animate-css` 1.4.0 - Tailwind animation utilities
- `class-variance-authority` 0.7.1 - Component variant management
- `clsx` 2.1.1 + `tailwind-merge` 3.4.0 - Class name utilities (`frontend/src/lib/utils.ts`)
- `lucide-react` 0.563.0 - Icon library
- `motion` 12.34.0 - Animations (import from `motion/react`, NOT `framer-motion`)
- `sonner` 2.0.7 - Toast notifications
- `cmdk` 1.1.1 - Command palette
- `next-themes` 0.4.6 - Theme management (dark/light mode)
- `react-day-picker` 9.13.2 - Date picker component
- `react-resizable-panels` 4.6.2 - Resizable split panels
- `react-grid-layout` 2.2.3 - Draggable dashboard grid layout
- `@monaco-editor/react` 4.7.0 - SQL editor
- `date-fns` 4.1.0 - Date utility library

### Backend Critical

- `httpx` 0.28.1 - Async HTTP client for Superset proxy (`backend/app/services/superset_client.py`)
- `pydantic` 2.12.5 - Request/response validation (`backend/app/models/`)
- `pydantic-settings` 2.12.0 - Environment configuration (`backend/app/config.py`)
- `sqlalchemy[asyncio]` 2.0.49 - Async ORM for RecViz metadata DB (`backend/app/db/`)
- `asyncpg` 0.31.0 - Async PostgreSQL driver
- `psycopg2-binary` 2.9.11 - Sync PostgreSQL driver (used by Alembic)
- `redis` 4.6.0 - Redis client (available but not directly used in backend yet)
- `requests` 2.32.5 - Sync HTTP client (seed scripts)
- `python-dotenv` 1.2.1 - .env file loading

### Superset Container Dependencies (in `superset/Dockerfile`)

- `apache-superset` (latest) - Query engine
- `psycopg2-binary` - PostgreSQL driver for metadata
- `redis` + `cachelib` - Query result caching
- `oracledb` - Oracle database driver (thin mode, no Instant Client)
- `pyhive` + `thrift` - Hive database driver

## Configuration

**Environment:**
- Backend config via `pydantic-settings` in `backend/app/config.py` (reads from `.env` file)
- Required env vars: `superset_url`, `superset_username`, `superset_password`, `redis_url`, `recon_db_url`, `recviz_db_url`, `databases_config_path`
- `.env` file present at `backend/.env` (not committed; existence noted only)
- Frontend config via Vite env vars (`import.meta.env.VITE_API_BASE_URL`, defaults to `http://localhost:8000`)

**Build:**
- `frontend/vite.config.ts` - Vite build config with React, Tailwind, TanStack Router plugins
- `frontend/tsconfig.json` - TypeScript project references (app, node, e2e)
- `frontend/tsconfig.app.json` - Strict mode, ES2022 target, bundler module resolution, `@/*` path alias
- `frontend/eslint.config.js` - Flat ESLint config with TypeScript + React plugins
- `frontend/vitest.config.ts` - Vitest with node environment, excludes e2e
- `frontend/playwright.config.ts` - Chromium only, sequential, auto-starts dev server

**Database Config:**
- `backend/app/config/databases.json` - Local dev database entries (PostgreSQL standing in for Oracle)
- `backend/app/config/databases.prod.json` - Production database entries (Oracle + Hive)
- `backend/app/migrations/alembic.ini` - Alembic migration config (uses `recviz_alembic_version` table to avoid Superset conflicts)

**Superset Config:**
- `superset/superset_config.py` - Docker Superset config (PostgreSQL metadata, Redis cache, Celery, oracledb shim)
- `superset/superset_config_local.py` - Native local dev config (SQLite metadata, SimpleCache, no Celery)

## Platform Requirements

**Development:**
- Docker Desktop (for PostgreSQL 16, Redis 7, Superset containers)
- Node.js + pnpm (frontend)
- Python 3.12+ with venv (backend)
- Startup order: Docker Compose first, then Superset (must be healthy), then backend (FastAPI), then frontend (Vite)

**Production:**
- RHEL (on-prem deployment target)
- Oracle databases (primary recon data via `oracledb` thin mode driver)
- Hive (historical/batch data via `pyhive`)
- No cloud services -- fully self-hostable
- AG Grid Enterprise and AG Charts Enterprise require valid license keys

## TypeScript Configuration

**Strict mode enabled with additional checks:**
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `noUncheckedSideEffectImports: true`
- `verbatimModuleSyntax: true`
- `erasableSyntaxOnly: true`

**Path alias:** `@/*` maps to `./src/*` (configured in both `tsconfig.app.json` and `vite.config.ts`)

---

*Stack analysis: 2026-04-09*
