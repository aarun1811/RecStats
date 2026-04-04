# Technology Stack

**Analysis Date:** 2026-04-04

## Languages

**Primary:**
- TypeScript 5.9.3 - Frontend SPA (`frontend/src/`)
- Python 3.12+ - Backend API and Superset engine (`backend/`, `superset/`)

**Secondary:**
- SQL - Data source query templates (`backend/app/config/data_sources/*.json`), seed scripts (`seed/`, `scripts/`)
- Bash - Setup and entrypoint scripts (`scripts/setup-superset-local.sh`, `superset/superset-entrypoint.sh`)

## Runtime

**Frontend Environment:**
- Node.js (no `.nvmrc` or `.node-version` pinned; version determined by local install)
- Browser target: ES2022 (set in `frontend/tsconfig.app.json`)

**Backend Environment:**
- Python 3.12+ (Dockerfile uses `python:3.12-slim` at `superset/Dockerfile`)
- ASGI server: Uvicorn 0.40.0

**Package Managers:**
- Frontend: pnpm (lockfile present: `frontend/pnpm-lock.yaml`)
- Backend: pip (no Poetry/pipenv; raw `backend/requirements.txt`)

## Frameworks

**Core:**
- React 19.2.0 - Frontend SPA (`frontend/package.json`)
- FastAPI 0.128.6 - Backend REST API (`backend/requirements.txt`)
- Apache Superset (latest pip) - Headless BI/query engine (`superset/Dockerfile`, `backend/requirements.txt`)

**Build/Dev:**
- Vite 7.3.1 - Frontend bundler (`frontend/vite.config.ts`)
- `@vitejs/plugin-react` 5.1.1 - React JSX transform
- `@tailwindcss/vite` 4.1.18 - Tailwind CSS integration as Vite plugin
- `@tanstack/router-plugin` 1.159.5 - File-based route generation (produces `frontend/src/routeTree.gen.ts`)

**Testing:**
- None currently configured (no vitest, jest, or pytest config files detected)

## Key Dependencies

### Frontend Critical

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-router` | ^1.159.5 | File-based routing (`frontend/src/routes/`) |
| `@tanstack/react-query` | ^5.90.20 | Server state management; configured in `frontend/src/lib/query-client.ts` |
| `zustand` | ^5.0.11 | Client state (filter + drill stores at `frontend/src/stores/`) |
| `ag-grid-enterprise` | ^35.0.1 | Data grid with Enterprise features (registered in `frontend/src/main.tsx`) |
| `ag-grid-react` | ^35.0.1 | React wrapper for AG Grid |
| `ag-charts-enterprise` | ^13.0.1 | Primary charting library (registered in `frontend/src/main.tsx`) |
| `ag-charts-react` | ^13.0.1 | React wrapper for AG Charts |
| `echarts` | ^6.0.0 | Secondary charts (Sankey, sunburst, radar, gauge, etc.) |
| `echarts-for-react` | ^3.0.6 | React wrapper for ECharts |
| `@monaco-editor/react` | ^4.7.0 | SQL editor in Data Explorer |
| `motion` | ^12.34.0 | Animations (import from `motion/react`, NOT `framer-motion`) |
| `react-resizable-panels` | ^4.6.2 | Resizable split-panel layouts |
| `sonner` | ^2.0.7 | Toast notifications |
| `cmdk` | ^1.1.1 | Command palette (Cmd+K) |

### Frontend UI

| Package | Version | Purpose |
|---------|---------|---------|
| `radix-ui` | ^1.4.3 | Primitive UI components (underlying Shadcn/ui) |
| `@radix-ui/react-slot` | ^1.2.4 | Slot pattern for component composition |
| `class-variance-authority` | ^0.7.1 | Variant-based component styling |
| `clsx` | ^2.1.1 | Conditional classname joining |
| `tailwind-merge` | ^3.4.0 | Tailwind class deduplication (used in `cn()` at `frontend/src/lib/utils.ts`) |
| `lucide-react` | ^0.563.0 | Icon library |
| `date-fns` | ^4.1.0 | Date formatting/manipulation |
| `react-day-picker` | ^9.13.2 | Calendar/date picker component |
| `next-themes` | ^0.4.6 | Listed as dependency but NOT used; custom `ThemeProvider` at `frontend/src/components/layout/theme-provider.tsx` |
| `tailwindcss` | ^4.1.18 | Utility-first CSS (loaded as Vite plugin) |
| `tw-animate-css` | ^1.4.0 | Animation utilities for Tailwind |
| `shadcn` | ^3.8.4 | CLI tool (devDep) for adding Shadcn/ui components |

### Backend Critical

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | 0.128.6 | REST API framework |
| `uvicorn` | 0.40.0 | ASGI server |
| `httpx` | 0.28.1 | Async HTTP client for Superset proxy calls (`backend/app/services/superset_client.py`) |
| `pydantic` | 2.12.5 | Request/response validation and config models |
| `pydantic-settings` | 2.12.0 | Environment-based configuration (`backend/app/config.py`) |
| `python-dotenv` | 1.2.1 | `.env` file loading |
| `psycopg2-binary` | 2.9.11 | PostgreSQL driver (used by seed scripts and Superset metadata) |
| `redis` | 4.6.0 | Redis client (Superset cache + Celery broker) |
| `requests` | 2.32.5 | Sync HTTP (used in seed/registration scripts only) |
| `apache-superset` | latest | Headless query engine (pip install) |

### Superset Container Additional

| Package | Purpose |
|---------|---------|
| `cachelib` | Redis/file-based results backend for SQL Lab |
| `oracledb` | Oracle database driver (installed optionally in `scripts/setup-superset-local.sh`) |

## Configuration

### Environment Variables

**Backend** (via `pydantic-settings` in `backend/app/config.py`):
- `SUPERSET_URL` - Superset API base URL (default: `http://localhost:8088`)
- `SUPERSET_USERNAME` - Superset admin user (default: `admin`)
- `SUPERSET_PASSWORD` - Superset admin password (default: `admin`)
- `REDIS_URL` - Redis connection (default: `redis://localhost:6379/0`)
- `RECON_DB_URL` - PostgreSQL recon data URI (default: `postgresql://recviz:recviz_dev@localhost:5432/recon_data`)
- `DATABASES_CONFIG_PATH` - Path to `databases.json` (default: `backend/app/config/databases.json`)

**Frontend** (via Vite `import.meta.env`):
- `VITE_API_BASE_URL` - Backend API URL (default: `http://localhost:8000`)

**Docker/Superset** (via Docker Compose environment):
- `POSTGRES_HOST` - PostgreSQL host (default: `localhost`, Docker: `postgres`)
- `REDIS_HOST` - Redis host (default: `localhost`, Docker: `redis`)
- `SECRET_KEY` - Superset Flask secret key
- `SUPERSET_CONFIG_PATH` - Path to Superset config file

**Env files detected:**
- `backend/.env` (present; not read for security)

### Build Configuration

| File | Purpose |
|------|---------|
| `frontend/vite.config.ts` | Vite build config with React, Tailwind CSS, TanStack Router plugins; `@` alias to `src/` |
| `frontend/tsconfig.json` | Root TS config with `@/*` path alias |
| `frontend/tsconfig.app.json` | App TS config: strict mode, ES2022 target, bundler module resolution, `noUnusedLocals`, `noUnusedParameters` |
| `frontend/tsconfig.node.json` | Node-side TS config (for Vite config itself) |
| `frontend/eslint.config.js` | Flat ESLint config: `@eslint/js` recommended + `typescript-eslint` + `react-hooks` + `react-refresh` |
| `superset/superset_config.py` | Superset Docker config (PostgreSQL metadata, Redis caching, Celery, CORS) |
| `superset/superset_config_local.py` | Superset local dev config (SQLite metadata, SimpleCache, no Celery, no Redis) |
| `docker-compose.yml` | Docker Compose for PostgreSQL 16 + Redis 7 + Superset |
| `backend/app/config/databases.json` | Database connection registry (currently 4 SQLite databases for local dev) |

### Theming Configuration

- Shadcn/ui CSS variable system defined in `frontend/src/index.css`
- Uses oklch color space for both light and dark themes
- 32 Shadcn/ui components in `frontend/src/components/ui/`
- Custom `ThemeProvider` at `frontend/src/components/layout/theme-provider.tsx` (stores preference in `localStorage` under key `recviz-theme`)
- Chart theme bridge: `frontend/src/lib/chart-themes.ts` reads CSS vars and generates AG Charts / ECharts theme objects

## Platform Requirements

### Development

- macOS / Linux (scripts use bash)
- Node.js with pnpm
- Python 3.12+ with pip
- Docker + Docker Compose (for PostgreSQL, Redis, optional Superset container)
- OR: Run Superset natively via `scripts/setup-superset-local.sh` (uses SQLite, no Docker needed)

**Local dev startup (3 terminals):**
1. `docker compose up` (or skip and use local Superset)
2. `cd frontend && pnpm dev` (Vite dev server on port 5173)
3. `cd backend && uvicorn app.main:app --reload` (FastAPI on port 8000)

### Production

- Deployment target: Not yet defined (no CI/CD, no Dockerfile for backend)
- Database targets: Oracle (primary), Hive (historical), Elasticsearch (search)
- Backend served via Uvicorn behind a reverse proxy (Nginx config referenced in CLAUDE.md)

---

*Stack analysis: 2026-04-04*
