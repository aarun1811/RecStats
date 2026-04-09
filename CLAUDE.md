# RecViz - Project Context & Conventions

## What Is This

RecViz is a custom visualization and analytics platform for reconciliation data. It uses **Apache Superset as a headless BI engine** (query engine, caching, database connectivity) with a **completely custom frontend** and a **FastAPI sidecar backend**.

RecViz does NOT perform reconciliation. It only visualizes and analyzes recon data.

## Architecture (3 layers)

```
React SPA (frontend) → FastAPI (backend/proxy) → Superset (headless engine) → Oracle/Hive/ES
                        ↘ Sidecar endpoints (direct ES, exports, custom aggs)
```

- **Frontend**: React 19 + Vite 6 + TypeScript 5 + Shadcn/ui + AG Grid Enterprise + AG Charts Enterprise
- **Backend**: FastAPI + httpx (async Superset proxy) + elasticsearch-py + Celery
- **Engine**: Apache Superset (pip install, REST API only, no UI exposed)
- **Cache**: Redis (Superset query cache + Celery broker)
- **Metadata DB**: PostgreSQL (Superset internal metadata)
- **Data Sources**: Oracle (primary recon data), Hive (historical/batch), Elasticsearch (search/realtime)

## Tech Stack Reference

### Frontend
| What | Use |
|---|---|
| Framework | React 19 |
| Build | Vite 6 |
| Language | TypeScript 5 (strict mode) |
| UI Components | Shadcn/ui + Radix primitives |
| Styling | Tailwind CSS 4 |
| Data Grid | AG Grid Enterprise 33 |
| Charts (primary) | AG Charts Enterprise 11 |
| Charts (exotic only) | Apache ECharts 5 (Sankey, sunburst, radar, network, gauge, parallel coords, funnel ONLY) |
| Routing | TanStack Router 1 (file-based) |
| Server State | TanStack Query 5 |
| Client State | Zustand 5 |
| Animations | Motion (`motion/react` — NOT `framer-motion`) |
| Resizable Panels | react-resizable-panels |
| Icons | Lucide React |
| Dates | date-fns 4 |
| SQL Editor | Monaco Editor |

### Backend
| What | Use |
|---|---|
| Framework | FastAPI 0.115+ |
| Language | Python 3.12+ |
| ASGI | Uvicorn |
| Validation | Pydantic 2 |
| HTTP Client | httpx (async) |
| ES Client | elasticsearch-py 8 |
| Task Queue | Celery 5 |
| PDF | WeasyPrint (or Playwright if complex layouts needed) |
| Excel | openpyxl |

## Project Structure

```
recviz/
├── frontend/          # React SPA
│   └── src/
│       ├── components/
│       │   ├── ui/           # Shadcn/ui components (owned, not dependency)
│       │   ├── layout/       # Root layout, sidebar, topbar, command palette
│       │   ├── dashboard/    # Filter bar, KPI cards, chart panels, drill breadcrumbs
│       │   ├── charts/       # AG Chart wrapper, EChart wrapper, chart factory
│       │   ├── grid/         # AG Grid wrapper, toolbar, cell renderers
│       │   ├── explorer/     # SQL editor, schema browser, query results
│       │   └── shared/       # Loading skeleton, error boundary, empty state
│       ├── pages/            # TanStack Router file-based pages
│       ├── hooks/            # Custom hooks (use-chart-data, use-grid-data, etc.)
│       ├── stores/           # Zustand stores (filter, drill, theme, sidebar)
│       ├── lib/              # Utilities, API client, constants, configs
│       └── types/            # Shared TypeScript types
├── backend/           # FastAPI
│   └── app/
│       ├── api/              # Route handlers (charts, datasets, sql, search, custom, export)
│       ├── services/         # Business logic (superset_client, elasticsearch, export, cache)
│       ├── models/           # Pydantic models (filters, chart_data, dataset, export)
│       └── core/             # Dependencies, exceptions, config
├── superset/          # Superset config (superset_config.py, init script)
└── infrastructure/    # Docker Compose, Nginx, Redis config, scripts
```

---

## Coding Conventions

### TypeScript / React

- **Strict TypeScript.** No `any`. No `@ts-ignore`. Use `unknown` + type narrowing if needed.
- **Functional components only.** No class components.
- **Named exports** for all components, hooks, stores, and utilities. Exception: page components use `default export` (required by TanStack Router file-based routing).
- **One primary component per file.** Small helper components used only by the primary component can live in the same file.
- **Props interface** defined above the component, named `{ComponentName}Props`:
  ```tsx
  interface KpiCardProps {
    title: string
    value: number
    trend?: { value: number; direction: 'up' | 'down' }
  }

  export function KpiCard({ title, value, trend }: KpiCardProps) {
    // ...
  }
  ```
- **Hooks** return objects, not arrays (except when wrapping a lib that returns arrays):
  ```tsx
  export function useChartData(chartId: string) {
    // returns useQuery result
  }
  ```
- **No barrel exports** (no `index.ts` re-exporting everything from a folder). Import directly from the file.
- **Imports order**: React → external libs → internal absolute paths → relative paths → types. Blank line between groups.

### File Naming

| Type | Convention | Example |
|---|---|---|
| Components | `kebab-case.tsx` | `kpi-card.tsx`, `filter-bar.tsx` |
| Hooks | `use-{name}.ts` | `use-chart-data.ts` |
| Stores | `{name}-store.ts` | `filter-store.ts` |
| Types | `{name}.ts` | `chart.ts`, `filter.ts` |
| Utils/lib | `kebab-case.ts` | `api-client.ts`, `filter-utils.ts` |
| Pages | `index.tsx` or `$paramName.tsx` | `index.tsx`, `$dashboardId.tsx` |
| Tests | `{name}.test.ts(x)` | `kpi-card.test.tsx` |
| Python | `snake_case.py` | `superset_client.py` |

### Shadcn/ui Rules

- All Shadcn components live in `src/components/ui/`. They are **owned code** — copy-pasted in, not a dependency.
- Use the `cn()` utility from `lib/utils.ts` for merging Tailwind classes.
- **Extend** Shadcn components via composition. Do NOT modify the base ui/ files unless absolutely necessary.
- Custom domain components (filter bar, KPI card, etc.) compose Shadcn primitives.

### Tailwind CSS Rules

- Use Shadcn's **CSS variable-based theming** system. Colors reference `hsl(var(--primary))` etc.
- Prefer Tailwind utility classes. Avoid custom CSS files.
- Use `@apply` only in rare global style cases.
- This is a **desktop-first** application. Responsive design is secondary.
- Dark mode via Tailwind `dark:` variant + class strategy (toggle on `<html>`).

### State Management (Zustand)

- Separate stores for separate concerns: `filter-store`, `drill-store`, `theme-store`, `sidebar-store`.
- Stores hold **state + simple setters**. No complex business logic in stores.
- Use **selectors** to avoid unnecessary re-renders:
  ```tsx
  const dateRange = useFilterStore((s) => s.globalFilters.dateRange)
  ```
- Cross-filter and drill-down state lives in Zustand. Server data lives in TanStack Query.

### Data Fetching (TanStack Query)

- All server state managed by TanStack Query. Never store fetched data in Zustand.
- Custom hooks wrap `useQuery` / `useInfiniteQuery` / `useMutation`.
- **Query key convention**: `['entity', identifier, filters]`
  ```tsx
  queryKey: ['chart-data', chartId, globalFilters]
  ```
- Default `staleTime`: `5 * 60 * 1000` (5 min)
- Default `gcTime`: `30 * 60 * 1000` (30 min)
- Use `keepPreviousData` / `placeholderData` for filter transitions (show old data while fetching new).

### API Client

- Single `api-client.ts` in `lib/` using `fetch` (no axios — keep it lightweight).
- Typed request/response with generics.
- Base URL from `import.meta.env.VITE_API_BASE_URL`.
- Throw on non-2xx responses. Let TanStack Query handle errors.

### Python / FastAPI

- **Async everywhere.** All endpoints are `async def`. Use `httpx.AsyncClient` for Superset calls.
- **Pydantic v2** models for all request bodies and responses.
- **Service layer pattern**: Route handlers call services. Services call external APIs/DBs. No direct DB/HTTP calls in route handlers.
- **Dependency injection** via `FastAPI.Depends()` for services (Superset client, ES client, Redis).
- **Config** via `pydantic-settings` (`BaseSettings` class reading from env vars).
- Route handlers are thin — validate input, call service, return response.

---

## Design & UX Principles

- **Ultra-premium feel.** Generous spacing, subtle animations, skeleton loaders, micro-interactions.
- **Skeleton loading** on every data component. Never show a blank screen.
- **Progressive loading**: KPI cards first (small payload) → charts → grid.
- **Dark mode is first-class.** Every component must work in both light and dark.
- **Typography**: Inter or Geist font. Clear hierarchy: page title 24px, section 18px, body 14px, caption 12px.
- **Color**: Shadcn CSS variable system. 2-3 accent colors max. Muted backgrounds. No harsh colors.
- **AG Grid theme**: Quartz theme customized to match Shadcn's CSS variables.
- **AG Charts theme**: Custom theme matching Shadcn's color system.
- **Animations**: `motion/react` for page transitions, chart load animations, KPI counter roll-up. Keep them fast (200-300ms) and purposeful. Import from `motion/react`, NOT `framer-motion`.

## Charting Rules

- **AG Charts** for 90% of visualizations (line, bar, area, pie, donut, scatter, heatmap, treemap, waterfall, bullet, box plot, combo).
- **ECharts** ONLY for: Sankey, sunburst, radar/spider, graph/network, gauge, parallel coordinates, funnel.
- Never use ECharts for a chart type AG Charts supports.
- Both wrapped behind a unified `ChartWrapperProps` interface.

## Filtering Model (3 tiers)

1. **Global filters** (filter bar) → trigger backend calls → Superset query with WHERE clauses
2. **Cross-filters** (chart click interactions) → client-side only → Zustand → useMemo on cached data → zero network calls
3. **Drill-down** (depth navigation) → client-side for aggregated levels, backend call for detail level

## Key Decisions

- Dashboard layout configs stored in **sidecar DB (Oracle)**, not in Superset.
- Superset used purely as query engine — no Superset UI exposed to users.
- FastAPI proxies all Superset API calls — frontend never talks to Superset directly.
- Auth strategy TBD (will be added later, likely SSO/SAML/OIDC).

## Reference UI Kit

`_references/shadcn-ui-kit-dashboard/` is the visual baseline. Adapt these components and patterns:

### Components to copy + adapt into `src/components/ui/`
| Component | Source | Purpose |
|-----------|--------|---------|
| `empty.tsx` | `components/ui/` | Composable empty state (Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent) |
| `spinner.tsx` | `components/ui/` | Loading spinner (Loader2Icon) |
| `kbd.tsx` | `components/ui/` | Keyboard shortcut badges (Cmd+K display) |
| `timeline.tsx` | `components/ui/` | Timeline for query history |
| `resizable.tsx` | `components/ui/` | Resizable split panels (Data Explorer layout) |

### Components to adapt into `src/components/`
| Component | Source | Purpose |
|-----------|--------|---------|
| `count-animation.tsx` | `components/ui/custom/` | KPI animated counters using `motion/react` |
| `app-sidebar.tsx` | `components/layout/sidebar/` | Sidebar structure, collapsible icon mode |
| `nav-main.tsx` | `components/layout/sidebar/` | Nav groups with collapsible sub-items + dropdown in icon mode |
| `nav-user.tsx` | `components/layout/sidebar/` | User avatar + dropdown in sidebar footer |
| `search.tsx` | `components/layout/header/` | Cmd+K search input → CommandDialog |
| `theme-switch.tsx` | `components/layout/header/` | Sun/moon theme toggle |

### Adaptation rules
- Replace `usePathname()` → `useLocation().pathname` (TanStack Router)
- Replace `next/link` `<Link>` → TanStack Router `<Link>`
- Replace `useRouter().push()` → `useNavigate()()`
- Remove `"use client"` directives (not needed in Vite/React)
- Keep all Tailwind classes and Shadcn patterns exactly as-is

---

## Styling Consistency Rules

These rules ensure visual uniformity across all phases and all components.

### Spacing
- Page padding: `p-6` (pages own their own padding, layout provides none)
- Section gaps: `gap-6` between major sections (filter bar → KPIs → charts → grid)
- Card internal padding: use Shadcn Card defaults (don't override)
- Grid gaps: `gap-4` for chart grids, `gap-4` for KPI rows

### Colors
- **ONLY** use Shadcn CSS variable colors: `text-foreground`, `bg-background`, `text-muted-foreground`, `bg-muted`, `border`, `bg-primary`, `text-primary-foreground`, etc.
- **NEVER** hardcode hex/rgb/hsl values. Everything goes through CSS variables.
- Status colors: use semantic classes — `text-green-600 dark:text-green-400` for positive, `text-red-600 dark:text-red-400` for negative. Always include dark variant.
- Chart colors: read from CSS variables via `getComputedStyle`, build palette from Shadcn theme.

### Typography
- Font: Inter (loaded via Google Fonts or local)
- Page title: `text-2xl font-semibold tracking-tight`
- Section title: `text-lg font-medium`
- Body: `text-sm` (14px default)
- Caption/label: `text-xs text-muted-foreground`
- Monospace (code/SQL): `font-mono text-sm`

### Borders & Radius
- Use Shadcn's `--radius` variable (via `rounded-md`, `rounded-lg`)
- Borders: `border` class (uses Shadcn's `--border` color)
- No custom border colors or widths

### Shadows
- Cards: Shadcn default (no extra shadow)
- Hover elevation: `hover:shadow-md` + `hover:-translate-y-0.5` (subtle lift)
- Dropdowns/popovers: Shadcn defaults

### Dark Mode
- Every component MUST work in dark mode. No exceptions.
- Test both modes during each phase before marking complete.
- AG Grid: Quartz theme auto-detects via CSS variables
- AG Charts: theme reads CSS variables, updates on toggle
- Monaco Editor: `vs-dark` in dark mode, light theme in light mode

### Animation Durations
- Page transitions: 200ms ease-out
- Chart load: 200ms ease-out (fade + scale 0.97→1.0)
- KPI counter: ~1s with motion/react `animate()`
- Tooltip delay: 300ms
- Sidebar collapse: spring animation (Shadcn default)
- Toast: slide-in (Sonner default)

---

## Infrastructure

### Local Dev Setup
- **Docker Compose**: Redis (v7) + PostgreSQL (v16) only — supporting services
- **Native (pip install)**: Apache Superset — query engine, runs with `superset run`
- **Native (pnpm)**: React frontend — runs with `pnpm dev`
- **Native (uvicorn)**: FastAPI backend — runs with `uvicorn app.main:app --reload`

### Database Strategy
- Superset metadata: PostgreSQL (Docker) — swappable to Oracle via config
- Recon data: PostgreSQL (Docker) — stands in for Oracle in dev. Same SQLAlchemy URI pattern.
- Cache: Redis (Docker) — Superset query cache + Celery broker

---

## Current State (As of 2026-03-28)

> **IMPORTANT FOR AGENTS:** Read `recviz/CODEBASE_GUIDE.md` for the complete, file-level codebase reference. It documents every component, every API endpoint, every data flow, and every known gap. This section is a summary.

### Two Parallel Dashboard Systems

There are TWO dashboard systems in the codebase:

1. **Config-driven (ACTIVE):** JSON config files define dashboards. Components prefixed `config-*`. Routes: `/api/dashboards/*`, `/api/data-sources/*`.
2. **Legacy (DEAD CODE):** Hardcoded charts, defunct store shape. Components: `filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx`. **Would crash at runtime.** But contains cross-filter + drill-down logic missing from config-driven system.

### Critical Gaps

- Cross-filtering and drill-down not in config-driven dashboards
- Chart export/fullscreen not in config-driven charts
- Export (PDF/Excel) entirely stubbed
- Reports page is all mock data
- No authentication on any endpoint

## References

- **Codebase guide (READ THIS FIRST):** `recviz/CODEBASE_GUIDE.md`
- Full design document: `RECVIZ_PLAN.md`
- Build plan: `RECVIZ_V2_BUILD_PLAN.md`
- Reference UI kit: `_references/shadcn-ui-kit-dashboard/`
- V1 lessons: `02-RecViz-Old/LESSONS_FOR_NEXT_BUILD.md`

<!-- GSD:project-start source:PROJECT.md -->
## Project

**RecViz**

RecViz is an internal BI and visualization platform replacing Tableau and Qlik View for Citi's Global Reconciliation Unit (GRU). It provides a dashboard builder where the dev team creates datasets (SQL queries against Oracle) and business users build, view, and customize dashboards from those datasets. FastAPI serves as the backend with a direct SQLAlchemy query engine; a custom React frontend delivers the premium UI and builder experience.

**Core Value:** Business users can view, interact with, and customize dashboards over reconciliation data without depending on another team for every change.

### Constraints

- **Tech stack**: React 19 + Vite 6 + TypeScript 5 + Shadcn/ui + AG Grid/Charts Enterprise + FastAPI + Superset — established in existing codebase
- **Desktop only**: Optimize for large screens and data density. No mobile/tablet.
- **No Superset**: Superset removed in v2.0. FastAPI queries databases directly via SQLAlchemy.
- **No Redis**: No caching layer. TanStack Query handles client-side caching.
- **No Docker in prod**: Production runs natively on Oracle. Docker only for local dev (PostgreSQL).
- **Data volume**: Millions of rows — aggregation-first, TanStack Query client-side caching.
- **Corporate environment**: On-prem deployment, no cloud services. All dependencies must be self-hostable.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~5.9.3 - Frontend SPA (`frontend/src/`)
- Python 3.12+ - Backend API and query engine (`backend/app/`)
- SQL - Data source queries, Alembic migrations (`backend/app/config/seed/`, `backend/app/migrations/versions/`)
- Shell/Bash - Setup and seed scripts (`scripts/`, `superset/superset-entrypoint.sh`)
## Runtime
- Node.js (version not pinned; no `.nvmrc`) - Frontend dev server and build
- Python 3.12+ (specified in `superset/Dockerfile`: `python:3.12-slim`) - Backend + Superset container
- Docker - PostgreSQL, Redis, Superset containers via `docker-compose.yml`
- pnpm - Frontend (lockfile: `frontend/pnpm-lock.yaml`)
- pip - Backend (no `pyproject.toml`; uses `backend/requirements.txt`)
## Frameworks
- React 19.2.0 - Frontend UI framework (`frontend/src/`)
- FastAPI 0.128.6 - Backend HTTP API (`backend/app/main.py`)
- Apache Superset (latest from pip) - Headless query engine, runs in Docker (`superset/Dockerfile`)
- Vitest 4.1.2 - Unit tests (`frontend/vitest.config.ts`)
- Playwright 1.59.1 - E2E tests (`frontend/playwright.config.ts`, `frontend/e2e/`)
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - DOM assertion matchers
- Vite 7.3.1 - Frontend bundler and dev server (`frontend/vite.config.ts`)
- @vitejs/plugin-react 5.1.1 - React Fast Refresh for Vite
- @tailwindcss/vite 4.1.18 - Tailwind CSS integration as Vite plugin
- TanStack Router Plugin 1.159.5 - File-based route generation (`frontend/src/routeTree.gen.ts`)
- Uvicorn 0.40.0 - ASGI server for FastAPI
- Alembic 1.18.4 - Database schema migrations (`backend/app/migrations/`)
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
- Backend config via `pydantic-settings` in `backend/app/config.py` (reads from `.env` file)
- Required env vars: `superset_url`, `superset_username`, `superset_password`, `redis_url`, `recon_db_url`, `recviz_db_url`, `databases_config_path`
- `.env` file present at `backend/.env` (not committed; existence noted only)
- Frontend config via Vite env vars (`import.meta.env.VITE_API_BASE_URL`, defaults to `http://localhost:8000`)
- `frontend/vite.config.ts` - Vite build config with React, Tailwind, TanStack Router plugins
- `frontend/tsconfig.json` - TypeScript project references (app, node, e2e)
- `frontend/tsconfig.app.json` - Strict mode, ES2022 target, bundler module resolution, `@/*` path alias
- `frontend/eslint.config.js` - Flat ESLint config with TypeScript + React plugins
- `frontend/vitest.config.ts` - Vitest with node environment, excludes e2e
- `frontend/playwright.config.ts` - Chromium only, sequential, auto-starts dev server
- `backend/app/config/databases.json` - Local dev database entries (PostgreSQL standing in for Oracle)
- `backend/app/config/databases.prod.json` - Production database entries (Oracle + Hive)
- `backend/app/migrations/alembic.ini` - Alembic migration config (uses `recviz_alembic_version` table to avoid Superset conflicts)
- `superset/superset_config.py` - Docker Superset config (PostgreSQL metadata, Redis cache, Celery, oracledb shim)
- `superset/superset_config_local.py` - Native local dev config (SQLite metadata, SimpleCache, no Celery)
## Platform Requirements
- Docker Desktop (for PostgreSQL 16, Redis 7, Superset containers)
- Node.js + pnpm (frontend)
- Python 3.12+ with venv (backend)
- Startup order: Docker Compose first, then Superset (must be healthy), then backend (FastAPI), then frontend (Vite)
- RHEL (on-prem deployment target)
- Oracle databases (primary recon data via `oracledb` thin mode driver)
- Hive (historical/batch data via `pyhive`)
- No cloud services -- fully self-hostable
- AG Grid Enterprise and AG Charts Enterprise require valid license keys
## TypeScript Configuration
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `noUncheckedSideEffectImports: true`
- `verbatimModuleSyntax: true`
- `erasableSyntaxOnly: true`
<!-- GSD:stack-end -->
<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Components: `kebab-case.tsx` (e.g., `config-filter-bar.tsx`, `dashboard-list-card.tsx`)
- Hooks: `use-{name}.ts` (e.g., `use-data-source-query.ts`, `use-managed-dashboards.ts`)
- Stores: `{name}-store.ts` (e.g., `filter-store.ts`, `drill-store.ts`, `builder-store.ts`)
- Types: `{name}.ts` in `frontend/src/types/` (e.g., `chart.ts`, `filter.ts`, `dashboard-config.ts`)
- Utils/lib: `kebab-case.ts` in `frontend/src/lib/` (e.g., `api-client.ts`, `cross-filter.ts`, `formatters.ts`)
- Route pages: `index.tsx` for list pages, `$paramName.tsx` for detail pages (TanStack Router file-based routing)
- Tests: `{name}.test.ts(x)` co-located with source file (e.g., `cross-filter.test.ts` next to `cross-filter.ts`)
- Python: `snake_case.py` (e.g., `superset_client.py`, `query_engine.py`, `managed_dashboards.py`)
- TypeScript: `camelCase` (e.g., `useDataSourceQuery`, `applyCrossFilters`, `buildSeries`)
- Python: `snake_case` (e.g., `list_managed_dashboards`, `_build_sql`, `_resolve_database`)
- Private Python helpers: prefix with underscore (e.g., `_to_response`, `_is_connection_failure`)
- TypeScript: `camelCase` for variables and props (e.g., `crossFilters`, `appliedFilters`, `dataSourceId`)
- Python: `snake_case` (e.g., `superset_client`, `database_registrar`, `status_tracker`)
- Constants: `UPPER_SNAKE_CASE` in both languages (e.g., `DEFAULT_MAX_ROWS`, `DATA_KEYS`, `EXPORT_PIXEL_RATIO`)
- TypeScript interfaces: `PascalCase` (e.g., `FilterStore`, `ChartWrapperProps`, `ChartDataResponse`)
- Props interface: named `{ComponentName}Props` and defined directly above the component
- Python Pydantic models: `PascalCase` (e.g., `DashboardCreate`, `DashboardResponse`, `CamelModel`)
- `PascalCase` function names (e.g., `ConfigFilterBar`, `DashboardRenderer`, `ErrorPanel`)
- Named exports for all components, hooks, stores, and utilities
- Exception: page-level route components use `function ComponentName()` locally and `export const Route = createFileRoute(...)` for the route
## Code Style
- No Prettier config file detected; formatting enforced by ESLint + TypeScript
- Semicolons: omitted (no semicolons in TypeScript files)
- Trailing commas: used in multi-line parameter lists and arrays
- Single quotes for strings in TypeScript
- Double quotes for strings in Python (convention follows FastAPI/Pydantic ecosystem)
- 2-space indentation in TypeScript, 4-space in Python
- ESLint flat config at `frontend/eslint.config.js`
- Plugins: `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`
- Extends: `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`
- TypeScript strict mode enabled in `frontend/tsconfig.app.json`: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- No Python linter config detected (no ruff, flake8, or mypy config files)
- `strict: true` in `tsconfig.app.json`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `verbatimModuleSyntax: true`
- `erasableSyntaxOnly: true`
- Target: ES2022, Module: ESNext, JSX: react-jsx
## Import Organization
- Blank line between groups
- Type imports use `import type { ... }` syntax (enforced by `verbatimModuleSyntax`)
- `@/*` maps to `frontend/src/*` (configured in `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`)
## Component Patterns
- All React components are functional. No class components anywhere in the codebase.
- Components use named function declarations, not arrow functions:
- Define `{ComponentName}Props` interface directly above the component:
- Small helper components (used only by the primary component) live in the same file
- Separated by comment dividers:
- Private helpers are not exported (no `export` keyword)
- No `index.ts` re-exporting. Import directly from the source file:
## State Management (Zustand)
- One store per concern: `filter-store.ts`, `drill-store.ts`, `builder-store.ts`, `layout-history-store.ts`
- Interface defined above the store, named `{Name}Store`:
- Zustand: UI state only (filters, drill state, builder state, layout)
- TanStack Query: all server data. Never store fetched data in Zustand.
## Data Fetching (TanStack Query)
- Every data-fetching operation wrapped in a custom hook in `frontend/src/hooks/`:
- Examples: `['managed-dashboards']`, `['managed-dashboard', id]`, `['data-source', dataSourceId, filters]`
- `staleTime`: 5 minutes
- `gcTime`: 30 minutes
- `retry`: 1
- `refetchOnWindowFocus`: false
- Global error handler: toasts `ApiError.userMessage` via Sonner
## API Client
- Uses native `fetch` (no axios)
- Base URL from `import.meta.env.VITE_API_BASE_URL`, defaults to `http://localhost:8000`
- Automatic `snake_case` to `camelCase` key transformation on responses
- `DATA_KEYS` set (`rows`, `columns`, `data`, `config`) are skip-transformed to preserve DB column names
- 204 responses return `undefined`
- Non-2xx responses throw `ApiError` with structured fields: `status`, `code`, `userMessage`, `detail`, `retryAfter`
## Error Handling
- `ApiError` class in `frontend/src/lib/api-client.ts` — structured error with `status`, `code`, `userMessage`, `detail`
- Global TanStack Query error handler toasts `ApiError.userMessage` via Sonner
- Component-level: check `isError` from useQuery, render `<ErrorPanel>` with retry callback
- `<ErrorBoundary>` component wraps route outlet in `frontend/src/routes/_app.tsx`
- Pattern: `const apiError = error instanceof ApiError ? error : null`
- FastAPI `HTTPException` for client errors (404, 409, 422)
- `sanitize_detail()` in `backend/app/core/errors.py` — truncates long messages, redacts DB connection strings
- Route handlers log full exceptions server-side, return sanitized details to clients
- Connection-level failures detected via pattern matching on Superset error text (`_CONNECTION_FAILURE_PATTERNS`)
## Logging
- Errors surface via TanStack Query's global error handler + Sonner toasts
- Python `logging` module with `logging.basicConfig(level=logging.INFO)` in `backend/app/main.py`
- Logger created per-module: `logger = logging.getLogger(__name__)`
- Used for startup events, sync status, and error context before sanitization
## Comments
- JSDoc-style `/** */` comments on exported functions that have non-obvious behavior
- Comment dividers between logical sections within a file:
- Inline comments for business logic, workarounds, and non-obvious decisions
- Test file headers with `/** */` blocks explaining scope, context, and preconditions
- Simple getters, setters, and obvious component wiring are not commented
## Function Design
- Hooks return the TanStack Query result object directly (not wrapped)
- Store hooks return objects with state + actions
- Utility functions return typed values
## Module Design
- No default exports except implicit route exports from TanStack Router file-based routing.
## Python / FastAPI Conventions
- All route handlers are `async def`
- Services use `async` methods for I/O operations
- `httpx.AsyncClient` for outbound HTTP, `asyncpg` for database
- Route handlers in `backend/app/api/` — thin, validate input, call service, return response
- Services in `backend/app/services/` — business logic, external API calls, DB queries
- No direct DB/HTTP calls in route handlers (except simple SQLAlchemy queries for CRUD)
- `Annotated[Type, Depends(factory)]` pattern for type-safe DI
- Named dependency types: `DbSessionDep`, `SupersetDep`, `ConfigStoreDep`, `QueryEngineDep`, `DatasetSyncDep`, `ResolvedDataSourceDep`
- Session lifecycle managed via `get_db_session()` generator with auto commit/rollback
- Base class `CamelModel` in `backend/app/models/base.py` auto-generates camelCase aliases
- All request/response models inherit `CamelModel`
- Field validation via `Field(min_length=1, max_length=256)` etc.
- `from __future__ import annotations` at top of every Python file for forward references
- Located in `backend/app/db/models/`
- Use `Mapped[T]` + `mapped_column()` (SQLAlchemy 2.0 style)
- Table names prefixed with `recviz_` (e.g., `recviz_dashboards`, `recviz_charts`)
- JSONB for flexible config storage
- Each entity has its own router file in `backend/app/api/` (e.g., `managed_dashboards.py`, `managed_charts.py`)
- Routers use `prefix="/api/..."` and `tags=[...]`
- Aggregated in `backend/app/api/router.py` via `api_router.include_router()`
## Shadcn/ui Rules
- Style: `new-york` (from `frontend/components.json`)
- Base color: `neutral`
- CSS variables enabled
- Icon library: Lucide React
- Use `cn()` from `frontend/src/lib/utils.ts` for class merging (clsx + tailwind-merge)
- Extend Shadcn via composition, not modification of base `ui/` files
- Domain components compose Shadcn primitives (e.g., `ConfigFilterBar` composes `Select`, `Popover`, `Command`, `Button`)
## Tailwind CSS Rules
- Shadcn CSS variable theming in `frontend/src/index.css`
- Colors reference variables: `text-foreground`, `bg-background`, `text-muted-foreground`, `bg-muted`, `border`, `bg-primary`
- Status colors: `text-green-600 dark:text-green-400` (positive), `text-red-600 dark:text-red-400` (negative)
- Chart colors: `--color-chart-1` through `--color-chart-5`
- Class strategy: `dark` class on `<html>` element
- Custom variant: `@custom-variant dark (&:is(.dark *));`
- Every component must include `dark:` variants for colors
- ThemeProvider at `frontend/src/components/layout/theme-provider.tsx`
- No mobile/tablet responsive design. Desktop-optimized layouts.
- Fixed widths for filter controls (e.g., `w-[180px]`, `w-[200px]`)
## Spacing and Typography
- Page padding: `p-6` (each page owns its padding)
- Section gaps: `space-y-6` between major sections
- Card padding: Shadcn defaults (not overridden)
- Grid gaps: `gap-3` for KPI rows, `gap-4` for chart grids
- Page title: `text-2xl font-semibold tracking-tight`
- Section title: `text-lg font-medium`
- Body: `text-sm` (14px default)
- Caption/label: `text-xs text-muted-foreground`, `text-[11px] font-medium uppercase tracking-wider text-muted-foreground` for KPI labels
- Monospace: `font-mono text-sm`
<!-- GSD:conventions-end -->
<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Config-driven dashboards: Dashboard layout, charts, KPIs, filters, and grids are defined as JSON configs stored in PostgreSQL (JSONB columns)
- Superset as headless query engine: Superset handles SQL execution, database connectivity, caching, and dataset management. No Superset UI is exposed.
- FastAPI as both proxy and sidecar: Proxies Superset API calls AND provides its own CRUD endpoints for managed entities (dashboards, charts, KPIs, datasets)
- Builder pattern: Users create/edit dashboards, charts, KPIs, and datasets through wizard-style builder UIs that persist configs to the backend
- Dual data paths: "Data sources" (legacy config-driven queries) and "managed datasets" (Superset virtual datasets) coexist
## Layers
- Purpose: Renders dashboards, builder UIs, SQL explorer, settings, and library/CRUD pages
- Location: `frontend/src/`
- Contains: Route pages, components, hooks, stores, types, utilities
- Depends on: FastAPI backend (via `api-client.ts`)
- Used by: End users via browser
- Purpose: Manages client-side state (filters, drills, builder) and server cache
- Location: `frontend/src/stores/` (Zustand), `frontend/src/hooks/` (TanStack Query)
- Contains: Filter store, drill store, builder store, layout history store; query/mutation hooks
- Depends on: API client for server state; pure functions for computed state
- Used by: Components via selectors and hooks
- Purpose: Authenticates to Superset, proxies queries, provides CRUD for managed entities, handles search, export stubs
- Location: `backend/app/api/`
- Contains: Route handlers organized by domain (dashboards, charts, KPIs, datasets, data sources, databases, SQL, search, export, views)
- Depends on: Service layer, DB session, Superset client
- Used by: Frontend API client
- Purpose: Encapsulates business logic - query building/execution, database registration, dataset sync, config migration, data merging
- Location: `backend/app/services/`
- Contains: `superset_client.py`, `query_engine.py`, `database_registrar.py`, `dataset_sync.py`, `config_store.py`, `merge_engine.py`, `connection_status.py`, `config_migrator.py`, `uri_builder.py`
- Depends on: Superset REST API (via httpx), SQLAlchemy async sessions
- Used by: API route handlers via dependency injection
- Purpose: Stores RecViz-managed entities (dashboards, charts, KPIs, datasets, data sources) and Superset metadata
- Location: `backend/app/db/` (engine, base, models), `backend/app/migrations/`
- Contains: SQLAlchemy ORM models, async engine config, Alembic migrations
- Depends on: PostgreSQL (asyncpg driver)
- Used by: Service and API layers via `DbSessionDep`
- Purpose: Executes SQL against configured databases, manages dataset metadata, handles query caching
- Location: `superset/` (config files and Dockerfile)
- Contains: `superset_config.py`, Dockerfile, entrypoint script
- Depends on: PostgreSQL (metadata), Redis (cache), configured data source databases
- Used by: FastAPI backend via `SupersetClient`
## Data Flow
- **Server state**: TanStack Query manages all API data with 5-min stale time, 30-min GC time. Mutations invalidate related query keys.
- **Filter state**: Zustand `filter-store` holds values, applied snapshot, locked set, and cross-filters. Filters are applied on explicit "Apply" action.
- **Drill state**: Zustand `drill-store` holds per-chart drill level stacks.
- **Builder state**: Zustand `builder-store` holds dashboard layout being edited, with dirty tracking.
- **Layout history**: Zustand `layout-history-store` provides undo/redo for builder canvas layouts.
- **URL state**: Dashboard filters are bidirectionally synced to URL search params via `dashboard-url-state.ts`.
## Key Abstractions
- Purpose: Complete dashboard definition - filters, KPIs, charts, grids, features, layout
- Examples: `frontend/src/types/dashboard-config.ts`, stored in `recviz_dashboards.config` JSONB column
- Pattern: The frontend builder writes this config; the renderer reads it. The backend stores and retrieves it as opaque JSON.
- Purpose: Defines a parameterized SQL query with database routing and filter mappings
- Examples: `backend/app/models/data_source_config.py`, stored in `recviz_data_sources.config` JSONB column
- Pattern: Query templates use `{{filters}}`, `{{values}}`, `{{date_range_clause}}` placeholders. `QueryEngine._build_sql()` resolves them.
- Purpose: Unified interface for rendering any chart type, routing to AG Charts or ECharts
- Examples: `frontend/src/components/charts/chart-factory.tsx`, `frontend/src/types/chart.ts`
- Pattern: Factory pattern - `ChartFactory` inspects `config.vizType`, delegates to `AgChartWrapper` or `EChartWrapper`. Both expose `ChartRef` for export.
- Purpose: Async HTTP client wrapping all Superset REST API calls with auto-authentication and 401 retry
- Examples: `backend/app/services/superset_client.py`
- Pattern: Singleton created in FastAPI lifespan, stored in `app.state.superset`, injected via `SupersetDep`
- Purpose: Resolves database routing, builds SQL from templates, executes via Superset, tracks connection status
- Examples: `backend/app/services/query_engine.py`
- Pattern: Stateful service (holds registrar + tracker references), per-request `execute()` calls resolve data source -> database -> SQL -> result
- Purpose: Provide request-scoped services to route handlers without boilerplate
- Examples: `backend/app/core/dependencies.py`
- Pattern: Annotated types (`DbSessionDep`, `SupersetDep`, `QueryEngineDep`, `ConfigStoreDep`, `ResolvedDataSourceDep`, `DatasetSyncDep`) used as function parameter type hints
## Entry Points
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads `index.html`, Vite serves bundled JS
- Responsibilities: Registers AG Grid/Charts enterprise modules, mounts React root with `<App />`
- Location: `frontend/src/routes/__root.tsx`
- Triggers: Router initialization in `App.tsx`
- Responsibilities: Wraps app in ThemeProvider, QueryClientProvider, Toaster, ErrorBoundary
- Location: `frontend/src/routes/_app.tsx`
- Triggers: Any `/_app/*` route match
- Responsibilities: Renders sidebar, header, animated outlet for page content
- Location: `frontend/src/routes/index.tsx`
- Triggers: Navigation to `/`
- Responsibilities: Redirects to `/dashboards`
- Location: `frontend/src/routes/embed/dashboards/$dashboardId.tsx`
- Triggers: Navigation to `/embed/dashboards/:id`
- Responsibilities: Renders dashboard without sidebar/header, supports `?theme=`, `?hide=`, `?filter.*`, `?filter.lock`
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --reload`
- Responsibilities: Lifespan initializes Superset client, database registrar, query engine, dataset sync service. Mounts all API routers. CORS + X-Frame-Options middleware.
- Location: `backend/app/main.py` (`GET /health`)
- Triggers: Infrastructure health probes
- Responsibilities: Returns `{"status": "ok", "superset": true}`
## Error Handling
- `ErrorBoundary` component (`frontend/src/components/shared/error-boundary.tsx`) catches React rendering errors
- TanStack Query's `QueryCache.onError` shows toast notifications for `ApiError` instances (`frontend/src/lib/query-client.ts`)
- `ApiError` class (`frontend/src/lib/api-client.ts`) parses structured error responses with `status`, `code`, `userMessage`, `detail`, `retryAfter`
- Chart components show skeleton loaders during loading, error panels with retry on failure, "No data available" on empty results
- Non-2xx fetch responses throw `ApiError`; TanStack Query retries once then exposes error to components
- Route handlers catch specific exceptions (`ValueError`, `httpx.ConnectError`, `httpx.HTTPStatusError`, `httpx.TimeoutException`) and map to appropriate HTTP status codes
- `sanitize_detail()` (`backend/app/core/errors.py`) truncates long messages and redacts connection-string URIs before sending to clients
- Superset connection failures return 503 with `retry_after` hint
- `QueryEngine._handle_connection_error()` inspects exception types and response bodies to mark databases as unreachable in `ConnectionStatusTracker`
- `DatasetSyncService` treats Superset sync failures as non-blocking (dataset saves succeed; sync retried at startup)
- DB session dependency (`get_db_session`) auto-commits on success, auto-rollbacks on exception
## Cross-Cutting Concerns
- Frontend: TypeScript strict mode for compile-time type safety. Runtime validation via TanStack Router `validateSearch` for URL params.
- Backend: Pydantic v2 models validate all request bodies. `CamelModel` base class provides camelCase alias generation. SQLAlchemy models enforce DB constraints.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->
