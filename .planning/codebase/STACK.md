# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- TypeScript ~5.9.3 - Frontend SPA (`frontend/src/`)
- Python 3.12+ - Backend API and query engine (`backend/app/`)

**Secondary:**
- SQL - Data source query templates, Alembic migrations (`backend/app/config/seed/`, `backend/app/migrations/versions/`)
- Shell/Bash - Setup and seed scripts (`scripts/`)

## Runtime

**Environment:**
- Node.js (version not pinned; no `.nvmrc` or `.node-version`) - Frontend dev server and build
- Python 3.12+ - Backend (FastAPI + Uvicorn)

**Package Manager:**
- pnpm - Frontend
  - Lockfile: `frontend/pnpm-lock.yaml` (present)
- pip - Backend
  - Requirements: `backend/requirements.txt` (no `pyproject.toml`)
  - No `pip-tools` or lockfile; direct pinned versions in requirements.txt

## Frameworks

**Core:**
- React 19.2.0 - Frontend UI framework (`frontend/src/`)
- FastAPI 0.128.6 - Backend HTTP API (`backend/app/main.py`)
- Vite 7.3.1 - Frontend bundler and dev server (`frontend/vite.config.ts`)

**Testing:**
- Vitest 4.1.2 - Unit tests (`frontend/vitest.config.ts`), `environment: 'node'`, excludes `e2e/**`
- Playwright 1.59.1 - E2E tests (`frontend/playwright.config.ts`), Chromium only, sequential workers
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - DOM assertion matchers

**Build/Dev:**
- @vitejs/plugin-react 5.1.1 - React Fast Refresh for Vite
- @tailwindcss/vite 4.1.18 - Tailwind CSS integration as Vite plugin
- TanStack Router Plugin 1.159.5 - File-based route generation (`frontend/src/routeTree.gen.ts`)
- ESLint 9.39.1 - TypeScript linting (`frontend/eslint.config.js`)
- typescript-eslint 8.48.0 - TypeScript ESLint rules
- eslint-plugin-react-hooks 7.0.1 - React hooks lint rules
- eslint-plugin-react-refresh 0.4.24 - React refresh lint rules
- shadcn 3.8.4 (devDep) - CLI for adding Shadcn/ui components
- Alembic 1.18.4 - Database schema migrations (`backend/app/migrations/`)

**No Prettier configured.** Formatting enforced by ESLint + TypeScript strict mode.

## Key Dependencies

### Frontend Critical

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-router` | 1.159.5 | File-based routing (`frontend/src/routes/`) |
| `@tanstack/react-query` | 5.90.20 | Server state management (`frontend/src/lib/query-client.ts`) |
| `@tanstack/react-query-devtools` | 5.91.3 | Query debugging in dev |
| `zustand` | 5.0.11 | Client state management (`frontend/src/stores/`) |
| `ag-grid-enterprise` | 35.0.1 | Enterprise data grid (requires license key) |
| `ag-grid-react` | 35.0.1 | React wrapper for AG Grid |
| `ag-charts-enterprise` | 13.0.1 | Enterprise charting (requires license key) |
| `ag-charts-react` | 13.0.1 | React wrapper for AG Charts |
| `echarts` | 6.0.0 | Exotic chart types only (Sankey, radar, gauge, etc.) |
| `echarts-for-react` | 3.0.6 | React wrapper for ECharts |
| `@monaco-editor/react` | 4.7.0 | SQL editor in Data Explorer |

### Frontend UI

| Package | Version | Purpose |
|---------|---------|---------|
| `radix-ui` | 1.4.3 | Headless UI primitives (via Shadcn/ui) |
| `@radix-ui/react-slot` | 1.2.4 | Slot composition primitive |
| `tailwindcss` | 4.1.18 | Utility-first CSS (`frontend/src/index.css`) |
| `tw-animate-css` | 1.4.0 | Tailwind animation utilities |
| `class-variance-authority` | 0.7.1 | Component variant management |
| `clsx` | 2.1.1 | Conditional class names |
| `tailwind-merge` | 3.4.0 | Merge conflicting Tailwind classes |
| `lucide-react` | 0.563.0 | Icon library |
| `motion` | 12.34.0 | Animations (import from `motion/react`, NOT `framer-motion`) |
| `sonner` | 2.0.7 | Toast notifications |
| `cmdk` | 1.1.1 | Command palette (Cmd+K) |
| `next-themes` | 0.4.6 | Theme management (dark/light mode toggle) |
| `react-day-picker` | 9.13.2 | Date picker component |
| `react-resizable-panels` | 4.6.2 | Resizable split panels |
| `react-grid-layout` | 2.2.3 | Draggable dashboard grid layout (builder canvas) |
| `date-fns` | 4.1.0 | Date utility library |

### Backend Critical

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | 0.128.6 | HTTP API framework (`backend/app/main.py`) |
| `uvicorn` | 0.40.0 | ASGI server |
| `pydantic` | 2.12.5 | Request/response validation (`backend/app/models/`) |
| `pydantic-settings` | 2.12.0 | Environment config (`backend/app/config.py`) |
| `sqlalchemy[asyncio]` | 2.0.49 | Async ORM for RecViz metadata + direct data source queries |
| `asyncpg` | 0.31.0 | Async PostgreSQL driver (primary) |
| `psycopg2-binary` | 2.9.11 | Sync PostgreSQL driver (Alembic migrations only) |
| `cryptography` | 44.0.3 | Fernet encryption for database credentials at rest (`backend/app/services/encryption.py`) |
| `python-dotenv` | 1.2.1 | `.env` file loading |

## Configuration

**Backend Environment:**
- Config via `pydantic-settings` in `backend/app/config.py`
- Reads from `backend/.env` (existence confirmed; contents not read)
- Required env vars:
  - `recon_db_url` - PostgreSQL connection for recon data (default: `postgresql://recviz:recviz_dev@localhost:5432/recon_data`)
  - `recviz_db_url` - Async PostgreSQL connection for RecViz metadata (default: `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta`)
  - `RECVIZ_ENCRYPTION_KEY` - Fernet key for credential encryption (**no default, must be set**)

**Frontend Environment:**
- Vite env vars via `import.meta.env`
- `VITE_API_BASE_URL` - Backend API URL (defaults to `http://localhost:8000`)

**Build Configuration:**
- `frontend/vite.config.ts` - Vite with React, Tailwind, TanStack Router plugins; `@` path alias to `src/`
- `frontend/tsconfig.json` - Project references (app, node, e2e)
- `frontend/tsconfig.app.json` - Strict mode, ES2022 target, bundler module resolution, `@/*` path alias
- `frontend/eslint.config.js` - Flat ESLint config with TypeScript + React plugins
- `frontend/vitest.config.ts` - Vitest with node environment, `@` alias, excludes e2e
- `frontend/playwright.config.ts` - Chromium only, sequential, auto-starts dev server on port 5173
- `frontend/components.json` - Shadcn CLI config: `new-york` style, `neutral` base color, CSS variables enabled

**Database Migrations:**
- `backend/app/migrations/alembic.ini` - Alembic config, uses `recviz_alembic_version` table (avoids Superset conflict)
- 7 migration files in `backend/app/migrations/versions/` (001 through 007)

## TypeScript Configuration

Strict mode with all safety flags enabled in `frontend/tsconfig.app.json`:

```
strict: true
noUnusedLocals: true
noUnusedParameters: true
noFallthroughCasesInSwitch: true
noUncheckedSideEffectImports: true
verbatimModuleSyntax: true
erasableSyntaxOnly: true
```

Target: ES2022, Module: ESNext, JSX: react-jsx

## Platform Requirements

**Development:**
- Docker Desktop - For PostgreSQL 16 container only (`docker-compose.yml`)
- Node.js + pnpm - Frontend (`pnpm dev` on port 5173)
- Python 3.12+ with venv - Backend (`uvicorn app.main:app --reload` on port 8000)
- PostgreSQL 16 (via Docker) - Two databases: `superset_meta` (RecViz metadata) and `recon_data` (dev recon data)
- Init SQL: `docker/init-db.sql` creates the `recon_data` database

**Production:**
- RHEL (on-prem deployment target)
- Oracle databases (primary recon data via `oracledb` thin mode driver)
- No cloud services - Fully self-hostable
- No Redis in current stack (removed with Superset)
- No Docker in prod - Runs natively
- AG Grid Enterprise and AG Charts Enterprise require valid license keys

**Startup Order (local dev):**
1. `docker compose up -d` (PostgreSQL)
2. `cd backend && uvicorn app.main:app --reload` (FastAPI on 8000)
3. `cd frontend && pnpm dev` (Vite on 5173)

## Notable Absences

- **No Superset** - Removed in v2.0. The `superset/` directory no longer exists. FastAPI queries databases directly via SQLAlchemy async engines.
- **No Redis** - Removed with Superset. TanStack Query handles client-side caching.
- **No Celery** - Task queue removed. Export endpoints are stubs.
- **No Elasticsearch** - No ES client in `backend/requirements.txt`. Search is SQL-based against RecViz metadata tables.
- **No httpx** - Removed from requirements when Superset proxy was dropped. All DB access is direct via SQLAlchemy.
- **No Prettier** - No `.prettierrc` or formatting config. ESLint handles code quality.
- **No Python linter config** - No ruff, flake8, or mypy configuration files.
- **No CI/CD pipeline** - No `.github/`, Jenkinsfile, or CI config present.

---

*Stack analysis: 2026-04-09*
