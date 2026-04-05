# Technology Stack

**Analysis Date:** 2026-04-05

## Languages

**Primary:**
- TypeScript ~5.9.3 - Frontend SPA (`frontend/src/`)
- Python 3.12+ - Backend API (`backend/app/`)

**Secondary:**
- SQL - Data source query templates (`backend/app/config/data_sources/*.json`), seed scripts (`scripts/seed-postgres.py`)
- CSS (Tailwind v4 + oklch color functions) - Theming (`frontend/src/index.css`)
- Bash - Superset entrypoint, setup scripts (`superset/superset-entrypoint.sh`, `scripts/setup-superset-local.sh`)

## Runtime

**Frontend Environment:**
- Node.js v24.x (detected v24.13.0 on dev machine)
- Browser target: ES2022 (`frontend/tsconfig.app.json` line 5)

**Backend Environment:**
- Python 3.12+ (detected 3.12.12)
- ASGI server: Uvicorn 0.40.0

**Package Managers:**
- pnpm (frontend) - Lockfile present: `frontend/pnpm-lock.yaml`
- pip (backend) - Requirements: `backend/requirements.txt` (no lockfile, pinned versions)

## Frameworks

**Core:**
- React 19.2+ - Frontend UI framework (`frontend/package.json`)
- FastAPI 0.128.6 - Backend API framework (`backend/requirements.txt`)
- Apache Superset (latest) - Headless query engine, runs in Docker (`superset/Dockerfile`)

**Testing:**
- Vitest 4.1.2 - Unit tests, config at `frontend/vitest.config.ts`
- Playwright 1.59.1 - E2E tests, config at `frontend/playwright.config.ts`
- Testing Library (React) 16.3.2 - Component test utilities
- Testing Library (jest-dom) 6.9.1 - DOM assertion matchers

**Build/Dev:**
- Vite 7.3.1 - Frontend bundler/dev server (`frontend/vite.config.ts`)
- ESLint 9.39.1 + typescript-eslint 8.48.0 - Linting (`frontend/eslint.config.js`)
- Tailwind CSS 4.1.18 (via `@tailwindcss/vite` plugin) - Utility CSS
- TanStack Router Plugin 1.159.5 - File-based route code generation

## Key Dependencies

### Frontend — Critical

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-router` | ^1.159.5 | File-based routing with type-safe params |
| `@tanstack/react-query` | ^5.90.20 | Server state management, caching, background refetching |
| `zustand` | ^5.0.11 | Client state (filter store, drill store) |
| `ag-grid-enterprise` | ^35.0.1 | Data grid with grouping, pivoting, enterprise features |
| `ag-charts-enterprise` | ^13.0.1 | Primary charting (bar, line, area, pie, heatmap, treemap, waterfall) |
| `echarts` | ^6.0.0 | Exotic charts only (Sankey, radar, gauge, funnel) |
| `@monaco-editor/react` | ^4.7.0 | SQL editor in Data Explorer |

### Frontend — UI/UX

| Package | Version | Purpose |
|---------|---------|---------|
| `radix-ui` | ^1.4.3 | Accessible UI primitives (via Shadcn/ui) |
| `class-variance-authority` | ^0.7.1 | Variant-based component styling |
| `tailwind-merge` | ^3.4.0 | Intelligent Tailwind class merging (`cn()` utility) |
| `clsx` | ^2.1.1 | Conditional className composition |
| `cmdk` | ^1.1.1 | Command palette (Cmd+K) |
| `sonner` | ^2.0.7 | Toast notifications |
| `motion` | ^12.34.0 | Animations (import from `motion/react`, NOT `framer-motion`) |
| `lucide-react` | ^0.563.0 | Icon library |
| `react-resizable-panels` | ^4.6.2 | Resizable split pane layouts |
| `react-day-picker` | ^9.13.2 | Date picker in filter bar |
| `date-fns` | ^4.1.0 | Date formatting/manipulation |
| `next-themes` | ^0.4.6 | Dark/light mode toggle (works with non-Next.js React) |
| `shadcn` | ^3.8.4 | CLI for adding Shadcn/ui components (dev dependency) |
| `tw-animate-css` | ^1.4.0 | Animation utilities for Tailwind |

### Backend — Critical

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | 0.128.6 | API framework |
| `uvicorn` | 0.40.0 | ASGI server |
| `httpx` | 0.28.1 | Async HTTP client for Superset proxy calls |
| `pydantic` | 2.12.5 | Request/response validation |
| `pydantic-settings` | 2.12.0 | Environment-based config (`backend/app/config.py`) |
| `sqlalchemy[asyncio]` | 2.0.49 | Async ORM for RecViz config tables |
| `asyncpg` | 0.31.0 | PostgreSQL async driver |
| `alembic` | 1.18.4 | Database migrations (`backend/app/migrations/`) |
| `psycopg2-binary` | 2.9.11 | Sync PostgreSQL driver (seed scripts, Superset) |
| `redis` | 4.6.0 | Listed in requirements but not yet imported in app code |
| `python-dotenv` | 1.2.1 | `.env` file loading |
| `requests` | 2.32.5 | Sync HTTP (seed/registration scripts only) |

### Not Yet Implemented (Listed in CLAUDE.md but not in requirements.txt)

| Package | Planned Purpose |
|---------|----------------|
| `elasticsearch-py` | Elasticsearch client for search/realtime data |
| `celery` | Async task queue for exports, heavy queries |
| `weasyprint` or `playwright` | PDF export |
| `openpyxl` | Excel export |

## Configuration

**Frontend Environment:**
- `VITE_API_BASE_URL` - Backend API URL (defaults to `http://localhost:8000` in `frontend/src/lib/api-client.ts`)
- No `.env` file present in frontend; uses Vite defaults

**Backend Environment (.env file present):**
- `superset_url` - Superset base URL (default: `http://localhost:8088`)
- `superset_username` / `superset_password` - Superset auth credentials
- `redis_url` - Redis connection (default: `redis://localhost:6379/0`)
- `recon_db_url` - Reconciliation data PostgreSQL URI
- `recviz_db_url` - RecViz metadata PostgreSQL URI (async, uses `asyncpg`)
- `databases_config_path` - Path to `databases.json` config file
- Config class: `backend/app/config.py` using `pydantic-settings.BaseSettings`

**Build Configuration:**
- `frontend/vite.config.ts` - Vite plugins: TanStack Router, React, Tailwind CSS v4
- `frontend/tsconfig.app.json` - Strict TypeScript, ES2022 target, bundler module resolution
- `frontend/eslint.config.js` - Flat ESLint config with typescript-eslint + react-hooks + react-refresh
- Path alias: `@/*` maps to `./src/*` (both in tsconfig and Vite)

**Superset Configuration:**
- `superset/superset_config.py` - Metadata DB, Redis cache config, Celery broker, CORS
- `superset/superset_config_local.py` - Local dev overrides (if any)

**Database Configuration:**
- `backend/app/config/databases.json` - Logical database definitions with SQLAlchemy URIs, dialects, schemas
- `backend/app/migrations/alembic.ini` - Alembic migration config (uses custom `recviz_alembic_version` table)

## Platform Requirements

**Development:**
- Docker Desktop (for PostgreSQL 16 + Redis 7 + Superset containers)
- Node.js 24.x + pnpm
- Python 3.12+ with venv
- Docker Compose stack: `docker-compose.yml` runs postgres, redis, superset

**Startup Order:**
1. `docker compose up -d` (PostgreSQL + Redis + Superset)
2. `python scripts/seed-postgres.py` (seed recon data + dashboard configs)
3. `cd backend && uvicorn app.main:app --reload` (FastAPI on port 8000)
4. `cd frontend && pnpm dev` (Vite dev server on port 5173)

**Production Target:**
- On-premises deployment (corporate Citi environment)
- No cloud services; all dependencies must be self-hostable
- Data sources in production: Oracle (primary), Hive (historical), Elasticsearch (search/realtime)

---

*Stack analysis: 2026-04-05*
