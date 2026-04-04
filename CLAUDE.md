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

RecViz is an internal BI and visualization platform replacing Tableau and Qlik View for Citi's Global Reconciliation Unit (GRU). It provides a dashboard builder where the dev team creates datasets (SQL queries against Oracle/Hive/ES) and business users build, view, and customize dashboards from those datasets. Apache Superset serves as the headless query engine; a custom React frontend delivers the premium UI and builder experience.

**Core Value:** Business users can view, interact with, and customize dashboards over reconciliation data without depending on another team for every change.

### Constraints

- **Tech stack**: React 19 + Vite 6 + TypeScript 5 + Shadcn/ui + AG Grid/Charts Enterprise + FastAPI + Superset — established in existing codebase
- **Desktop only**: Optimize for large screens and data density. No mobile/tablet.
- **Superset as engine**: Keep Superset as headless query engine — best free option for multi-source query, caching, dataset management
- **No direct Superset UI**: Frontend never exposes Superset's UI to users. All queries proxied through FastAPI.
- **Data volume**: Millions of rows — aggregation-first, caching critical (Redis via Superset + TanStack Query client-side)
- **Corporate environment**: On-prem deployment, no cloud services. All dependencies must be self-hostable.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.9.3 - Frontend SPA (`frontend/src/`)
- Python 3.12+ - Backend API and Superset engine (`backend/`, `superset/`)
- SQL - Data source query templates (`backend/app/config/data_sources/*.json`), seed scripts (`seed/`, `scripts/`)
- Bash - Setup and entrypoint scripts (`scripts/setup-superset-local.sh`, `superset/superset-entrypoint.sh`)
## Runtime
- Node.js (no `.nvmrc` or `.node-version` pinned; version determined by local install)
- Browser target: ES2022 (set in `frontend/tsconfig.app.json`)
- Python 3.12+ (Dockerfile uses `python:3.12-slim` at `superset/Dockerfile`)
- ASGI server: Uvicorn 0.40.0
- Frontend: pnpm (lockfile present: `frontend/pnpm-lock.yaml`)
- Backend: pip (no Poetry/pipenv; raw `backend/requirements.txt`)
## Frameworks
- React 19.2.0 - Frontend SPA (`frontend/package.json`)
- FastAPI 0.128.6 - Backend REST API (`backend/requirements.txt`)
- Apache Superset (latest pip) - Headless BI/query engine (`superset/Dockerfile`, `backend/requirements.txt`)
- Vite 7.3.1 - Frontend bundler (`frontend/vite.config.ts`)
- `@vitejs/plugin-react` 5.1.1 - React JSX transform
- `@tailwindcss/vite` 4.1.18 - Tailwind CSS integration as Vite plugin
- `@tanstack/router-plugin` 1.159.5 - File-based route generation (produces `frontend/src/routeTree.gen.ts`)
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
- `SUPERSET_URL` - Superset API base URL (default: `http://localhost:8088`)
- `SUPERSET_USERNAME` - Superset admin user (default: `admin`)
- `SUPERSET_PASSWORD` - Superset admin password (default: `admin`)
- `REDIS_URL` - Redis connection (default: `redis://localhost:6379/0`)
- `RECON_DB_URL` - PostgreSQL recon data URI (default: `postgresql://recviz:recviz_dev@localhost:5432/recon_data`)
- `DATABASES_CONFIG_PATH` - Path to `databases.json` (default: `backend/app/config/databases.json`)
- `VITE_API_BASE_URL` - Backend API URL (default: `http://localhost:8000`)
- `POSTGRES_HOST` - PostgreSQL host (default: `localhost`, Docker: `postgres`)
- `REDIS_HOST` - Redis host (default: `localhost`, Docker: `redis`)
- `SECRET_KEY` - Superset Flask secret key
- `SUPERSET_CONFIG_PATH` - Path to Superset config file
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
### Production
- Deployment target: Not yet defined (no CI/CD, no Dockerfile for backend)
- Database targets: Oracle (primary), Hive (historical), Elasticsearch (search)
- Backend served via Uvicorn behind a reverse proxy (Nginx config referenced in CLAUDE.md)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Components: `kebab-case.tsx` (e.g., `kpi-card.tsx`, `config-filter-bar.tsx`, `ag-chart-wrapper.tsx`)
- Hooks: `use-{name}.ts` (e.g., `use-chart-data.ts`, `use-dashboard-config.ts`, `use-cross-filter.ts`)
- Stores: `{name}-store.ts` (e.g., `filter-store.ts`, `drill-store.ts`)
- Types: `{name}.ts` in `types/` (e.g., `chart.ts`, `filter.ts`, `dashboard-config.ts`)
- Utils/lib: `kebab-case.ts` (e.g., `api-client.ts`, `chart-themes.ts`, `cross-filter.ts`)
- Pages/routes: `index.tsx` for directory indices, `$paramName.tsx` for dynamic params (e.g., `$dashboardId.tsx`)
- All Python files use `snake_case.py` (e.g., `superset_client.py`, `config_store.py`, `query_engine.py`)
- Test files: `test_{module}.py` in `backend/tests/` (e.g., `test_config_store.py`, `test_query_engine.py`)
- React components: `PascalCase` (e.g., `KpiCard`, `ConfigFilterBar`, `AgChartWrapper`)
- Hooks: `useCamelCase` (e.g., `useChartData`, `useDashboardConfig`, `useCrossFilter`)
- Utility functions: `camelCase` (e.g., `applyCrossFilters`, `rowPassesCrossFilters`, `formatDates`)
- All functions and methods: `snake_case` (e.g., `list_dashboards`, `get_chart_data`, `_build_sql`)
- Private/internal methods: prefixed with underscore `_` (e.g., `_build_sql`, `_resolve_database`, `_load_configs`)
- `camelCase` for all variables and properties
- Constants: `UPPER_SNAKE_CASE` for module-level constants (e.g., `ECHART_TYPES`, `DEFAULT_COL_DEF`, `PAGE_SIZE`)
- `snake_case` for variables and function parameters
- Module constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_MAX_ROWS`, `TOKEN_REFRESH_BUFFER`, `CHART_DATASOURCE_MAP`)
- Props interfaces: `{ComponentName}Props` defined above the component (e.g., `KpiCardProps`, `ConfigFilterBarProps`)
- Type aliases: `PascalCase` (e.g., `ChartType`, `FilterValue`, `ChartClickEvent`)
- Use `interface` for object shapes, `type` for unions and aliases
- Pydantic models: `PascalCase` (e.g., `DashboardConfig`, `DataSourceConfig`, `FilterConfig`)
- Request/response models defined either in `app/models/` or inline in route files
## Code Style
- No Prettier config detected. Code style enforced via ESLint + TypeScript strict mode
- Single quotes for strings (consistent throughout codebase)
- Trailing commas in multi-line arrays/objects
- No semicolons (appears to be the convention based on all source files)
- 2-space indentation (TypeScript/TSX files)
- No explicit formatter config (no `pyproject.toml`, no Black/Ruff config)
- 4-space indentation (Python standard)
- Double quotes for strings (Python convention)
- Type hints used extensively via `from __future__ import annotations`
- ESLint 9 with flat config at `frontend/eslint.config.js`
- Plugins: `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Uses `js.configs.recommended` + `tseslint.configs.recommended` + `reactHooks.configs.flat.recommended`
- Run via: `pnpm lint`
- No linter config detected. No flake8, ruff, or pylint configuration
- Strict mode enabled in `frontend/tsconfig.app.json`: `"strict": true`
- Additional strict checks: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`
- `verbatimModuleSyntax` enabled (requires `type` keyword for type-only imports)
- Target: ES2022, module: ESNext, JSX: react-jsx
- Path alias: `@/*` maps to `./src/*`
## Import Organization
- Frontend: `@/*` resolves to `frontend/src/*` (configured in `tsconfig.json` and `vite.config.ts`)
- Backend: Uses relative Python imports from `app.` root (e.g., `from app.services.config_store import ConfigStore`)
## Component Patterns
## State Management Patterns
- `filter-store.ts`: Global filter values, locked filters, applied filters, cross-filters
- `drill-store.ts`: Drill-down state (source chart, breadcrumb levels)
- Stores hold state + simple setters. No business logic in stores.
- Use selectors to avoid re-renders:
- Custom hooks in `frontend/src/hooks/` wrap `useQuery` / `useMutation`
- Query key convention: `['entity', identifier, filters]` (e.g., `['chart-data', chartId, globalFilters]`)
- Global defaults in `frontend/src/lib/query-client.ts`: `staleTime: 5min`, `gcTime: 30min`, `retry: 1`, `refetchOnWindowFocus: false`
- Use `keepPreviousData` / `placeholderData` for smooth filter transitions
## API Client Pattern
- Uses native `fetch` (no axios)
- Generic typed methods: `api.get<T>()`, `api.post<T>()`, `api.put<T>()`, `api.delete<T>()`
- Custom `ApiError` class with `status` and `body` properties
- Auto-transforms snake_case response keys to camelCase (except data keys like `rows`, `columns`)
- Base URL from `import.meta.env.VITE_API_BASE_URL`, fallback `http://localhost:8000`
- Throws on non-2xx responses. TanStack Query handles errors.
## Error Handling
- `ErrorBoundary` class component at `frontend/src/components/shared/error-boundary.tsx` wraps the main app layout
- Chart wrappers show inline error states with retry buttons (see `frontend/src/components/charts/ag-chart-wrapper.tsx`)
- API client throws `ApiError` on non-2xx; TanStack Query catches and surfaces via `error` property
- Route-level errors handled by TanStack Router's `errorComponent`
- Loading states: Skeleton components for every data component. Never show blank screens.
- Empty states: "No data available" inline messages
- `HTTPException` raised in route handlers for known errors (404 not found, 400 bad request)
- `ValueError` raised in service layer, caught by route handlers and converted to `HTTPException`
- Superset client: auto-retries on 401 (re-authenticates), raises `httpx` errors for other failures
- Some endpoints silently fall through to mock data on Superset errors (e.g., `charts.py`, `sql.py`)
- `try/except Exception: pass` pattern used for Superset fallback (broad catch, silent fail)
## Backend Architecture Patterns
- Route handlers are thin: validate input, call service, return response
- Services live in `backend/app/services/`: `SupersetClient`, `ConfigStore`, `QueryEngine`, `DatabaseRegistrar`, `MergeEngine`
- Dependency injection via FastAPI `Depends()` with typed aliases at `backend/app/core/dependencies.py`:
- All request/response bodies use Pydantic models
- `CamelModel` base class at `backend/app/models/base.py` with `alias_generator = to_camel` for JSON camelCase serialization
- Some route handlers define inline request/response models (e.g., `KpiRequest`, `KpiResponse` in `dashboards.py`)
- Config models at `backend/app/models/dashboard_config.py` and `backend/app/models/data_source_config.py`
- All route handlers are `async def`
- `httpx.AsyncClient` for Superset HTTP calls
- Shared HTTP client created in lifespan, stored on `app.state`
- Each feature has its own router module in `backend/app/api/`
- All routers aggregated in `backend/app/api/router.py`
- URL prefix pattern: `/api/{resource}` (e.g., `/api/dashboards`, `/api/data-sources`, `/api/sql`)
- Tags match resource names for OpenAPI docs
## Routing Patterns (Frontend)
- Root route: `__root.tsx` (providers: ThemeProvider, QueryClientProvider, Toaster)
- Layout route: `_app.tsx` (sidebar, header, error boundary, page transitions)
- Page routes: `_app/dashboards/index.tsx`, `_app/explorer/index.tsx`, etc.
- Dynamic routes: `$dashboardId.tsx` for parameterized pages
- Root redirect: `/` redirects to `/dashboards`
- Route tree auto-generated in `frontend/src/routeTree.gen.ts` (do not edit manually)
## Tailwind CSS & Styling
- CSS variables defined in `frontend/src/index.css` using `oklch` color space
- Both light (`:root`) and dark (`.dark`) themes defined
- Dark mode via class strategy: `.dark` on `<html>` element
- Use only Shadcn semantic color classes: `text-foreground`, `bg-background`, `text-muted-foreground`, `bg-muted`, `border`, etc.
- Status colors: `text-green-600 dark:text-green-400` for positive, `text-red-600 dark:text-red-400` for negative
- Page padding: `p-6`
- Section gaps: `gap-4` to `gap-6`
- Card padding: Shadcn Card defaults
- Card hover: subtle lift (`translateY(-1px)`) + shadow (`box-shadow: 0 4px 12px`)
- Smooth focus transitions on interactive elements
- Page transitions: 200ms ease-out fade+slide via `motion/react` (see `frontend/src/components/shared/page-transition.tsx`)
## Chart Conventions
- Wrapper: `frontend/src/components/charts/ag-chart-wrapper.tsx`
- Theme reads CSS variables, updates on theme toggle
- Wrapper: `frontend/src/components/charts/echart-wrapper.tsx`
- Factory: `frontend/src/components/charts/chart-factory.tsx` routes to correct wrapper based on `vizType`
- `getAgChartsTheme()` and `getEChartsTheme()` read Shadcn CSS variables from DOM
- Series palette: 10 distinct colors starting with primary
## Logging
- Python `logging` module with `basicConfig(level=logging.INFO)` in `backend/app/main.py`
- Logger per module: `logger = logging.getLogger(__name__)`
- `logger.info()` for startup events, `logger.warning()` for recoverable errors
## Comments
- JSDoc-style `/** ... */` comments on exported utility functions explaining purpose and behavior
- Section separators using `// ----` comment lines in large files (see `config-filter-bar.tsx`)
- Inline comments explaining non-obvious behavior (e.g., key transform skip logic in `api-client.ts`)
- Module-level docstrings in service files (e.g., `"""Async Superset API client with auto-authentication and retry on 401."""`)
- Method docstrings for complex methods (e.g., `_build_sql`, `resolve`)
- Comments using `# ── Section ──` style in `superset_client.py`
## Module Design
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Config-driven dashboards: JSON files define filters, KPIs, charts, and grids
- Headless Superset: Superset runs as a query engine only; no Superset UI is exposed to users
- Frontend never talks to Superset directly; all queries proxy through FastAPI
- Two data flow paths: config-driven (active) and legacy hardcoded (dead code)
- Client-side state split: server data in TanStack Query, UI state in Zustand stores
- Mock fallbacks: every backend endpoint falls back to mock data when Superset is unavailable
## Layers
- Purpose: Renders dashboards, data explorer, reports, and settings UI
- Location: `frontend/src/`
- Contains: Route pages, UI components, chart wrappers, AG Grid wrappers
- Depends on: FastAPI backend via `frontend/src/lib/api-client.ts`
- Used by: End users via browser
- Purpose: Manages filter values, cross-filter selections, and drill-down state
- Location: `frontend/src/stores/`
- Contains: Zustand stores (`filter-store.ts`, `drill-store.ts`)
- Depends on: Nothing (pure client state)
- Used by: Dashboard components, hooks
- Purpose: Wraps TanStack Query to fetch and cache server data
- Location: `frontend/src/hooks/`
- Contains: Custom hooks (`use-dashboard-config.ts`, `use-data-source-query.ts`, `use-dashboard-kpis.ts`, `use-filter-options.ts`, `use-data-source-merge.ts`, `use-chart-data.ts`, etc.)
- Depends on: API client (`frontend/src/lib/api-client.ts`), Zustand stores
- Used by: Presentation components
- Purpose: HTTP endpoints for the frontend; thin handlers that validate and delegate
- Location: `backend/app/api/`
- Contains: Route modules (`dashboards.py`, `data_sources.py`, `charts.py`, `sql.py`, `databases.py`, `export.py`, `search.py`, `custom.py`, `views.py`)
- Depends on: Services layer via FastAPI dependency injection
- Used by: Frontend API client
- Purpose: Business logic, Superset communication, config loading, query building
- Location: `backend/app/services/`
- Contains: `superset_client.py`, `query_engine.py`, `config_store.py`, `database_registrar.py`, `merge_engine.py`, `uri_builder.py`
- Depends on: Superset REST API, JSON config files
- Used by: API route handlers
- Purpose: Request/response validation and configuration schemas
- Location: `backend/app/models/`
- Contains: `dashboard_config.py`, `data_source_config.py`, `database_config.py`, `filters.py`, `chart_data.py`, `database.py`, `dataset.py`, `export.py`, `views.py`, `base.py`
- Depends on: Pydantic v2
- Used by: API handlers, services, config loading
- Purpose: JSON files defining dashboards, data sources, and database connections
- Location: `backend/app/config/`
- Contains: `dashboards/*.json`, `data_sources/*.json`, `databases.json`, `seed/seed.db`
- Depends on: Nothing (static files)
- Used by: `ConfigStore` and `DatabaseRegistrar` services
- Purpose: Executes SQL against connected databases, provides caching and result formatting
- Location: `superset/` (config only; Superset itself is a pip install / Docker container)
- Contains: `superset_config.py`, `superset_config_local.py`, Dockerfile
- Depends on: PostgreSQL (metadata), Redis (cache), connected data sources (Oracle/SQLite/etc.)
- Used by: `SupersetClient` service
## Data Flow
- **Server state**: TanStack Query caches all API responses; `staleTime: 5min`, `gcTime: 30min`
- **Filter state**: Zustand `filter-store` holds `values` (current), `applied` (last committed), and `locked` (URL-pinned); components read `applied` for data queries
- **Drill state**: Zustand `drill-store` holds breadcrumb stack of drill levels (currently unused in config-driven dashboards)
- **Cross-filter state**: Zustand `filter-store.crossFilters[]` + `frontend/src/lib/cross-filter.ts` client-side filtering (currently unused in config-driven dashboards)
## Key Abstractions
- Purpose: Complete specification for a dashboard -- filters, KPIs, charts, grids, layout, features
- Examples: `backend/app/config/dashboards/tlm-stats.json`
- Pattern: JSON config validated by Pydantic model `backend/app/models/dashboard_config.py`, mirrored in TypeScript `frontend/src/types/dashboard-config.ts`
- Purpose: Defines a queryable data source with SQL template, filter mappings, database routing, and column definitions
- Examples: `backend/app/config/data_sources/tlm_automatch.json`, `backend/app/config/data_sources/tlm_breaks.json`
- Pattern: SQL template with `{{filters}}` and `{{values}}` placeholders replaced at query time by `QueryEngine._build_sql()`
- Purpose: Logical-to-physical database mapping; registers databases in Superset and resolves names to Superset IDs
- Examples: `backend/app/config/databases.json`
- Pattern: On startup, syncs `databases.json` entries into Superset. At query time, resolves logical name -> Superset numeric ID via cache with refresh
- Purpose: Central query orchestration -- resolves database, builds SQL from templates, executes via Superset
- Examples: `backend/app/services/query_engine.py`
- Pattern: Template SQL + filter mappings + dynamic/static database routing + dialect-aware date functions
- Purpose: Routes chart rendering to the correct wrapper (AG Charts vs ECharts) based on viz type
- Examples: `frontend/src/components/charts/chart-factory.tsx`
- Pattern: Set-based dispatch; `ECHART_TYPES` set contains exotic types, everything else goes to AG Charts
- Purpose: In-memory registry of all dashboard and data source configs loaded from JSON files
- Examples: `backend/app/services/config_store.py`
- Pattern: Loads all JSON from `backend/app/config/dashboards/` and `backend/app/config/data_sources/` at startup, keyed by ID
## Entry Points
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads `index.html`
- Responsibilities: Registers AG Grid/Charts modules, renders React root with `<App />`, which creates TanStack Router
- Location: `frontend/src/routes/__root.tsx`
- Triggers: Every page load
- Responsibilities: Provides `ThemeProvider`, `QueryClientProvider`, `Toaster`, `ReactQueryDevtools`
- Location: `frontend/src/routes/_app.tsx`
- Triggers: All pages under `/_app/*` (dashboards, explorer, reports, settings)
- Responsibilities: Renders sidebar (`AppSidebar`), header (`Header`), and animated `Outlet`
- Location: `frontend/src/routes/index.tsx`
- Triggers: Navigating to `/`
- Responsibilities: Redirects to `/dashboards`
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --reload`
- Responsibilities: Creates FastAPI app, configures CORS, registers all API routers, manages lifespan (creates httpx client, authenticates to Superset, loads configs, syncs databases, creates QueryEngine)
- Location: `backend/app/api/router.py`
- Triggers: Included by `main.py`
- Responsibilities: Aggregates all 10 route modules into single `api_router`
- Location: `backend/app/main.py` (line 90)
- Triggers: `GET /health`
- Responsibilities: Returns `{"status": "ok", "superset": True}`
## Error Handling
- Backend API handlers wrap Superset calls in try/except and return mock data on failure (see `backend/app/api/charts.py`, `backend/app/api/sql.py`, `backend/app/api/databases.py`)
- `QueryEngine` raises `ValueError` for config/routing errors; API handlers convert to `HTTPException(400)`
- `SupersetClient` auto-retries on 401 (re-authenticates and retries the request)
- Frontend `ErrorBoundary` (`frontend/src/components/shared/error-boundary.tsx`) catches React rendering errors
- TanStack Query handles fetch errors with `retry: 1` default
- `api-client.ts` throws `ApiError` on non-2xx responses; TanStack Query surfaces these to components
## Cross-Cutting Concerns
- Backend: Python `logging` module; `logging.basicConfig(level=logging.INFO)` in `backend/app/main.py`
- Frontend: No structured logging; console only
- Backend: Pydantic v2 models for all request bodies and config files
- Frontend: TypeScript interfaces mirror backend models; `api-client.ts` auto-transforms snake_case keys to camelCase
- Backend-to-Superset: username/password auth via Superset REST API with JWT token (auto-refresh on expiry/401) in `backend/app/services/superset_client.py`
- User-to-RecViz: No authentication implemented. All endpoints are open.
- Superset: Redis-backed query cache (`superset/superset_config.py`), data cache, and filter state cache
- Frontend: TanStack Query in-memory cache with 5min stale, 30min GC (`frontend/src/lib/query-client.ts`)
- Backend: `DatabaseRegistrar` caches name->ID mappings in memory with 30-second TTL refresh
- Backend: `CORSMiddleware` allows `localhost:5173`, `localhost:3000`, `localhost:4200` (`backend/app/main.py`)
- Superset: CORS configured to allow `localhost:5173` and `localhost:8000` (`superset/superset_config.py`)
- `X-Frame-Options: ALLOWALL` header set by `XFrameOptionsMiddleware` in `backend/app/main.py` to allow iframe embedding
## Two Dashboard Systems (Legacy vs Config-Driven)
- Components: `dashboard-renderer.tsx`, `config-filter-bar.tsx`, `config-kpi-row.tsx`, `config-chart-grid.tsx`, `config-data-grid.tsx`
- API routes: `/api/dashboards/*`, `/api/data-sources/*`
- Services: `ConfigStore`, `QueryEngine`, `MergeEngine`, `DatabaseRegistrar`
- Data: JSON config files in `backend/app/config/`
- Components: `filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx`, `chart-panel.tsx`, `cross-filter-bar.tsx`, `drill-breadcrumb.tsx`
- API routes: `/api/charts/*`, `/api/custom/*`
- Hooks: `use-chart-data.ts`, `use-kpi-data.ts`, `use-breaks-data.ts`, `use-cross-filter.ts`, `use-drill-down.ts`
- Note: Contains cross-filter and drill-down logic missing from config-driven system; references `globalFilters` shape not used by config-driven filter store
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
