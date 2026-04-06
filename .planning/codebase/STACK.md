# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- TypeScript 5.9 (strict mode) - Frontend SPA (`frontend/src/`)
- Python 3.12+ - Backend API (`backend/app/`)

**Secondary:**
- SQL - Dashboard data source queries, Alembic migrations
- Bash - Docker entrypoints, dev scripts (`scripts/`, `superset/superset-entrypoint.sh`)

## Runtime

**Frontend:**
- Node.js (no `.nvmrc` or `.node-version` pinned)
- Vite 7.3 dev server on `http://localhost:5173`

**Backend:**
- Python 3.12 (specified in `superset/Dockerfile`)
- Uvicorn ASGI server on `http://localhost:8000`

**Package Managers:**
- pnpm (frontend) - Lockfile: `frontend/pnpm-lock.yaml` present
- pip (backend) - Dependencies in `backend/requirements.txt`, no lockfile

## Frameworks

**Core:**
- React 19.2 - Frontend UI framework (`frontend/src/`)
- FastAPI 0.128 - Backend API framework (`backend/app/main.py`)
- Apache Superset (Docker container) - Headless query engine (`superset/Dockerfile`)

**Testing:**
- Vitest 4.1 - Unit/integration test runner (`frontend/vitest.config.ts`)
- Playwright 1.59 - E2E browser tests (`frontend/playwright.config.ts`, `frontend/e2e/`)
- Testing Library (React) 16.3 - Component test utilities
- jest-dom 6.9 - DOM assertion matchers

**Build/Dev:**
- Vite 7.3 - Frontend build tool (`frontend/vite.config.ts`)
- `@vitejs/plugin-react` 5.1 - React Fast Refresh + JSX transform
- `@tailwindcss/vite` 4.1 - Tailwind CSS Vite plugin
- `@tanstack/router-plugin` 1.159 - File-based route generation
- ESLint 9.39 - Linting (`frontend/eslint.config.js`)
- typescript-eslint 8.48 - TypeScript-specific lint rules

## Key Dependencies

### Frontend Critical

- **AG Grid Enterprise 35** - Data grid with enterprise features (`ag-grid-enterprise`, `ag-grid-react`)
- **AG Charts Enterprise 13** - Primary charting library (`ag-charts-enterprise`, `ag-charts-react`)
- **TanStack Router 1.159** - File-based routing (`@tanstack/react-router`)
- **TanStack Query 5.90** - Server state management (`@tanstack/react-query`)
- **Zustand 5.0** - Client state management (filter store, drill store)
- **Shadcn/ui** - UI component library (copy-pasted into `frontend/src/components/ui/`, not a runtime dependency). Style: `new-york`, base color: `neutral`.
- **Radix UI 1.4** - Underlying primitives for Shadcn components (`radix-ui`)

### Frontend Infrastructure

- **Tailwind CSS 4.1** - Utility-first CSS (`@tailwindcss/vite`)
- **tw-animate-css 1.4** - Animation utilities for Tailwind
- **Motion 12.34** - Animation library (imported as `motion/react`, NOT `framer-motion`)
- **ECharts 6.0** + `echarts-for-react` 3.0 - Exotic chart types only (Sankey, sunburst, radar, network, gauge, parallel coords, funnel)
- **Monaco Editor** (`@monaco-editor/react` 4.7) - SQL editor in Data Explorer
- **Sonner 2.0** - Toast notifications
- **cmdk 1.1** - Command palette (`Cmd+K`)
- **Lucide React 0.563** - Icon library
- **date-fns 4.1** - Date utilities
- **react-resizable-panels 4.6** - Split panel layouts
- **react-day-picker 9.13** - Date picker component
- **next-themes 0.4** - Theme switching (light/dark)
- **class-variance-authority 0.7** + `clsx 2.1` + `tailwind-merge 3.4` - Class utility chain for Shadcn

### Backend Critical

- **httpx 0.28** - Async HTTP client for Superset API proxy
- **Pydantic 2.12** + `pydantic-settings 2.12` - Request/response validation, env config
- **SQLAlchemy 2.0 (async)** + `asyncpg 0.31` - Async ORM for RecViz metadata tables
- **Alembic 1.18** - Database migrations (uses `recviz_alembic_version` table to avoid Superset conflicts)
- **psycopg2-binary 2.9** - PostgreSQL driver (sync, used by Superset registrations)
- **redis 4.6** - Redis client (Superset cache config, not directly used by FastAPI yet)
- **python-dotenv 1.2** - `.env` file loading
- **requests 2.32** - Sync HTTP (minimal usage, scripts)

### Superset Container

- **apache-superset** (latest pip) - Query engine (pinned reference: 6.0.0)
- **oracledb** (thin mode) - Oracle database driver (aliased as `cx_Oracle` for SQLAlchemy 1.4 compat)
- **pyhive** + **thrift** - Hive database driver
- **psycopg2-binary** - PostgreSQL driver
- **redis** + **cachelib** - Query result caching

## Configuration

**Environment:**
- Backend config via `pydantic-settings` (`backend/app/config.py`) reading from `backend/.env`
- Key settings: `superset_url`, `superset_username`, `superset_password`, `redis_url`, `recon_db_url`, `recviz_db_url`, `databases_config_path`
- Frontend config via Vite env vars: `VITE_API_BASE_URL` (defaults to `http://localhost:8000`)
- `.env` file exists at `backend/.env` (contains environment configuration)

**Build:**
- `frontend/vite.config.ts` - Vite build config with React, Tailwind, TanStack Router plugins
- `frontend/tsconfig.json` - TypeScript project references (app, node, e2e configs)
- `frontend/tsconfig.app.json` - Strict mode, ES2022 target, bundler module resolution, `@/` path alias
- `frontend/vitest.config.ts` - Vitest with node environment, excludes `e2e/`
- `frontend/eslint.config.js` - Flat config with recommended + react-hooks + react-refresh
- `frontend/playwright.config.ts` - Chromium only, single worker, auto-starts Vite dev server
- `frontend/components.json` - Shadcn CLI config (new-york style, neutral base, Lucide icons)
- `backend/app/migrations/alembic.ini` - Alembic config targeting `postgresql+asyncpg`
- `backend/app/config/databases.json` - Database registry (logical name -> SQLAlchemy URI mapping)

**Superset:**
- `superset/superset_config.py` - Docker Superset config (PostgreSQL metadata, Redis cache, Celery, Oracle shim)
- `superset/superset_config_local.py` - Local dev Superset config (SQLite metadata, SimpleCache, no Redis/Celery)

## Platform Requirements

**Development:**
- Docker Desktop (for PostgreSQL 16, Redis 7, Superset container)
- Node.js + pnpm (frontend)
- Python 3.12+ with venv (backend)
- Superset must be running before backend starts (backend authenticates on startup)
- Docker `init-db.sql` creates `recon_data` database alongside `superset_meta`

**Production (target):**
- On-premises deployment (corporate environment, no cloud services)
- All dependencies must be self-hostable
- Data sources: Oracle (primary recon data), Hive (historical/batch), Elasticsearch (search/realtime)
- PostgreSQL for Superset metadata (swappable to Oracle)
- Redis for query cache + Celery broker

**Local Dev Startup Order:**
1. `docker compose up -d` (PostgreSQL + Redis + Superset)
2. Wait for Superset health check (`http://localhost:8088/health`)
3. `cd backend && uvicorn app.main:app --reload` (authenticates to Superset on startup)
4. `cd frontend && pnpm dev`

---

*Stack analysis: 2026-04-06*
