# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- TypeScript ~5.9.3 - Frontend SPA (`frontend/src/`), strict mode enabled in `frontend/tsconfig.app.json`
- Python 3.12+ - Backend FastAPI app (`backend/app/`), uses `from __future__ import annotations` throughout

**Secondary:**
- SQL - Alembic migrations (`backend/app/migrations/versions/`), bootstrap (`docker/init-db.sql`), dataset/data-source templates stored as JSONB
- Shell/Bash - Setup and seed scripts (`scripts/setup-superset-local.sh`, `scripts/seed-postgres.py`)

## Runtime

**Environment:**
- Node.js (version not pinned; no `.nvmrc` in `frontend/`) - Frontend dev and build via Vite
- Python 3.12+ - Backend via Uvicorn
- Oracle Instant Client 19.3 at `/opt/oraclient/19.3_64/lib/` - Loaded by `backend/app/main.py` at import time for oracledb thick mode (required by Oracle national character sets such as NCS 871)
- Docker Desktop - Only PostgreSQL 16 runs in Docker for local dev (`docker-compose.yml`); production RHEL is fully native

**Package Manager:**
- `pnpm` - Frontend (lockfile: `frontend/pnpm-lock.yaml`)
- `pip` - Backend (no `pyproject.toml`; pinned versions in `backend/requirements.txt`)
- Lockfile: present for frontend; backend pins exact versions in requirements.txt

## Frameworks

**Core Frontend:**
- React 19.2.0 - UI framework (`frontend/src/main.tsx`, `frontend/src/App.tsx`)
- Vite 7.3.1 - Bundler and dev server (`frontend/vite.config.ts`)
- `@vitejs/plugin-react` 5.1.1 - React Fast Refresh for Vite
- TanStack Router 1.159.5 - File-based routing (`frontend/src/routes/`, generated `frontend/src/routeTree.gen.ts`)
- `@tanstack/router-plugin` 1.159.5 - Vite plugin that regenerates `routeTree.gen.ts`
- TanStack Query 5.90.20 - Server state / cache (`frontend/src/lib/query-client.ts`)
- `@tanstack/react-query-devtools` 5.91.3 - Query devtools
- Zustand 5.0.11 - Client state (`frontend/src/stores/`)
- Tailwind CSS 4.1.18 - Styling (`frontend/src/index.css`) via `@tailwindcss/vite` 4.1.18
- `tw-animate-css` 1.4.0 - Animation utilities for Tailwind

**Core Backend:**
- FastAPI 0.128.6 - HTTP API framework (`backend/app/main.py`)
- Uvicorn 0.40.0 - ASGI server
- Pydantic 2.12.5 - Validation (`backend/app/models/`)
- `pydantic-settings` 2.12.0 - Env configuration (`backend/app/config.py`)
- SQLAlchemy 2.0.49 `[asyncio]` extra - ORM/Core; project is **sync-only** as of 2026-04-10 (see docstring in `backend/app/db/engine.py`)
- Alembic 1.18.4 - Schema migrations (`backend/app/migrations/alembic.ini`, `backend/app/migrations/env.py`)

**Testing:**
- Vitest 4.1.2 - Frontend unit tests (`frontend/vitest.config.ts`, co-located `*.test.ts(x)` files)
- `@testing-library/react` 16.3.2 + `@testing-library/jest-dom` 6.9.1 - React test utilities
- `jsdom` 29.0.1 - DOM environment for Vitest
- Playwright 1.59.1 - E2E tests (`frontend/playwright.config.ts`, tests in `frontend/e2e/`)
- pytest (installed in `backend/venv`, not declared in `backend/requirements.txt`) - Backend tests in `backend/tests/`, config in `backend/tests/conftest.py`

**Build/Dev:**
- ESLint 9.39.1 (flat config in `frontend/eslint.config.js`) - Linter
- `typescript-eslint` 8.48.0 - TypeScript rules
- `eslint-plugin-react-hooks` 7.0.1 + `eslint-plugin-react-refresh` 0.4.24 - React lint rules
- `globals` 16.5.0 - ESLint globals config
- No Prettier config file detected (formatting handled by ESLint)
- No Python linter config detected (no ruff/flake8/mypy config present)
- `shadcn` 3.8.4 (devDep) - CLI used to scaffold components into `frontend/src/components/ui/`

## Key Dependencies

**Critical — Frontend Data:**
- `ag-grid-enterprise` 35.0.1 + `ag-grid-community` 35.0.1 + `ag-grid-react` 35.0.1 - Enterprise data grid; `AllEnterpriseModule` registered once in `frontend/src/main.tsx`
- `ag-charts-enterprise` 13.0.1 + `ag-charts-react` 13.0.1 - Primary chart library (90% of viz); `AllEnterpriseModule` registered in `frontend/src/main.tsx`
- `echarts` 6.0.0 + `echarts-for-react` 3.0.6 - Exotic chart types only (Sankey, Radar, Sunburst, Gauge, Funnel, Graph, Parallel). Registered via `echarts.use([...])` in `frontend/src/components/charts/echart-wrapper.tsx`
- Both enterprise libraries require valid license keys for production use

**Critical — Frontend UI:**
- `radix-ui` 1.4.3 + `@radix-ui/react-slot` 1.2.4 - Headless UI primitives (Shadcn base)
- `class-variance-authority` 0.7.1 + `clsx` 2.1.1 + `tailwind-merge` 3.4.0 - Class/variant utilities (`cn()` in `frontend/src/lib/utils.ts`)
- `lucide-react` 0.563.0 - Icon library
- `motion` 12.34.0 - Animations; imported as `motion/react` (NOT `framer-motion`) across 17 files (e.g., `frontend/src/components/shared/page-transition.tsx`, `frontend/src/components/shared/count-animation.tsx`)
- `next-themes` 0.4.6 - Theme management via `frontend/src/components/layout/theme-provider.tsx`
- `sonner` 2.0.7 - Toast notifications (wired into TanStack Query global error handler in `frontend/src/lib/query-client.ts`)
- `cmdk` 1.1.1 - Command palette (Cmd+K)
- `react-day-picker` 9.13.2 - Date picker
- `react-resizable-panels` 4.6.2 - Split panels (explorer layout)
- `react-grid-layout` 2.2.3 - Draggable dashboard canvas grid
- `@monaco-editor/react` 4.7.0 - SQL editor (explorer)
- `date-fns` 4.1.0 - Date utilities

**Critical — Backend Data/Infra:**
- `asyncpg` 0.31.0 - Async PostgreSQL driver (present for URI parsing; backend runs sync now)
- `psycopg2-binary` 2.9.11 - Sync PostgreSQL driver (used by Alembic and `EngineManager` runtime via `postgresql+psycopg2` URI)
- `oracledb` >=3.3.0 - Oracle driver; thick mode initialized in `backend/app/main.py` line 20 (`oracledb.init_oracle_client(lib_dir="/opt/oraclient/19.3_64/lib")`)
- `cryptography` 44.0.3 - Fernet symmetric encryption for DB credentials at rest (`backend/app/services/encryption.py`)

**Infrastructure:**
- `python-dotenv` 1.2.1 - `.env` file loading for Pydantic settings
- PostgreSQL 16 (Alpine) - Docker container for local dev (`docker-compose.yml`); holds both `superset_meta` (RecViz metadata) and `recon_data` (dev stand-in for Oracle)
- Redis - NOT used. No redis client in `backend/requirements.txt`; CLAUDE.md explicitly states "No Redis" for v2

**Not Present Despite Historical Mentions:**
- Apache Superset - Removed in v2.0; no `superset/` directory exists. Backend now queries databases directly via SQLAlchemy `text()` in `backend/app/services/query_engine.py`. Remaining `superset` references are in comments/migration names (e.g., `backend/app/migrations/versions/006_remove_dataset_superset_fields.py`), legacy env var defaults (`superset_meta` DB name in `backend/app/config.py`), and a historical seed script (`seed/register_superset.py`).
- `httpx` - NOT in `backend/requirements.txt` (was used as Superset proxy client; removed with Superset)
- `elasticsearch-py` / `pyhive` - NOT in `backend/requirements.txt`. Only `elasticsearch` and `hive` label strings remain in `backend/app/services/uri_builder.py` DEFAULT_PORTS (dead code path)
- Celery - Not present
- `weasyprint` / `openpyxl` / `playwright` (Python) - Not present; export features are stubs

## Configuration

**Environment:**
- Backend config via `pydantic-settings` `BaseSettings` in `backend/app/config.py` (reads `backend/.env`)
- `.env` file present at `backend/.env` (existence noted only; not read)
- `backend/.env.example` documents three variables:
  - `RECVIZ_DB_URL` - Metadata DB URI (default: `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta`). **Note:** default URI has `+asyncpg` prefix but `backend/app/db/engine.py` now uses sync `create_engine`; the prefix is tolerated at parse time but should be updated.
  - `RECON_DB_URL` - Dev recon-data DB URI (default: `postgresql://recviz:recviz_dev@localhost:5432/recon_data`)
  - `RECVIZ_ENCRYPTION_KEY` - Fernet key, **REQUIRED**, no default in `Settings` class (typed as `SecretStr`). Generated via `EncryptionService.generate_key()` (`backend/app/services/encryption.py`)
- Frontend config via Vite `import.meta.env`:
  - `VITE_API_BASE_URL` (defaults to `http://localhost:8000`) - read in `frontend/src/lib/api-client.ts` line 1

**Build:**
- `frontend/vite.config.ts` - Vite plugins: `TanStackRouterVite`, `@vitejs/plugin-react`, `@tailwindcss/vite`; path alias `@` -> `frontend/src`
- `frontend/tsconfig.json` - Project references root
- `frontend/tsconfig.app.json` - Strict mode, `ES2022` target, `bundler` module resolution, `react-jsx`, `@/*` path alias
- `frontend/tsconfig.node.json`, `frontend/tsconfig.e2e.json` - Node and E2E project configs
- `frontend/vitest.config.ts` - Node environment, excludes `e2e/**`, shares `@` path alias
- `frontend/playwright.config.ts` - Chromium only, sequential (`workers: 1`, `fullyParallel: false`), auto-starts `pnpm dev` at `http://localhost:5173`
- `frontend/components.json` - Shadcn/ui config: style `new-york`, base color `neutral`, icon library `lucide`, CSS vars enabled, aliases `@/components`, `@/lib/utils`, `@/components/ui`
- `frontend/eslint.config.js` - Flat config; extends `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`; ignores `dist/`
- `backend/app/migrations/alembic.ini` - Alembic config. **Important:** `env.py` uses `version_table="recviz_alembic_version"` (not the default `alembic_version`) to avoid collisions with the historical Superset metadata DB

## Platform Requirements

**Development:**
- Docker Desktop (PostgreSQL 16 container via `docker-compose.yml`)
- Node.js + pnpm (frontend)
- Python 3.12+ with venv at `backend/venv/`
- Startup order: Docker Compose PostgreSQL -> Alembic migrations -> FastAPI backend (`uvicorn app.main:app --reload`) -> Frontend dev server (`pnpm dev`)
- AG Grid Enterprise + AG Charts Enterprise license keys (for non-trial usage)

**Production:**
- RHEL on-prem deployment, no sudo (see deployment docs referenced in `docs/`)
- Native processes (no Docker in prod)
- Oracle databases as primary recon data source; connected via oracledb thick mode using pre-installed Instant Client at `/opt/oraclient/19.3_64/lib/`
- PostgreSQL as RecViz metadata DB (or swappable Oracle via URI)
- No cloud services; fully self-hostable
- FastAPI serves the React SPA in prod by mounting `frontend/dist/` at `/` (see `backend/app/main.py` lines 219-232), with a 404 fallback that serves `index.html` for client-side routing (but preserves 404 JSON for `/api/*`)

## TypeScript Configuration

From `frontend/tsconfig.app.json`:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `noUncheckedSideEffectImports: true`
- `verbatimModuleSyntax: true`
- `erasableSyntaxOnly: true`
- Target: `ES2022`, Module: `ESNext`, JSX: `react-jsx`, moduleResolution: `bundler`

---

*Stack analysis: 2026-04-11*
