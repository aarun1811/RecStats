# RecViz

## What This Is

RecViz is an internal BI and visualization platform for Citi's Global Reconciliation Unit (GRU). A dev team creates parameterized datasets (SQL against Oracle) and business users build, view, and customize dashboards from those datasets — no dependency on another team for every change.

RecViz does NOT perform reconciliation. It only visualizes reconciliation data.

**See:** `.planning/PROJECT.md` for current milestone scope, constraints, and key decisions. `.planning/codebase/` for the living codebase map.

## Non-Negotiable Rules

These are hard rules. Breaking them guarantees breakage in Citi's environment.

1. **Oracle 19c only.** No PostgreSQL. No other databases. Period. Dev and prod both use Oracle 19c.
2. **`oracledb` thick mode only.** Production uses character set NCS 871 which thin mode does not support. Local dev matches via Oracle Instant Client.
3. **No async DB.** Oracle 19c's driver does not support async. Use sync `SQLAlchemy` `Session`, sync `oracledb`, FastAPI route handlers as plain `def` (Starlette runs them in a threadpool). Framework-level `async def` (lifespan, middleware) is fine.
4. **No Docker for the application.** Not in dev, not in prod. Python, FastAPI, and the frontend run natively. The Oracle database server runs in Docker locally (`gvenzl/oracle-free`) for convenience.
5. **No Redis, no Celery, no Superset.** All removed or being removed.
6. **No automated tests in this milestone.** Test writing is deferred to a future milestone. All verification is manual.
7. **Desktop only.** No mobile/tablet responsive design.
8. **Before using `Edit`, `Write`, or other file-changing tools, start work through a GSD command.** Use `/gsd-quick` for small fixes, `/gsd-debug` for bugs, `/gsd-execute-phase` for planned phase work.

## Architecture

```
React SPA (frontend)
    ↓ HTTP
FastAPI (backend)
    ↓ sync SQLAlchemy + oracledb (thick mode)
Oracle 19c
```

Three layers. That's it. No query engine middleware, no cache tier, no container orchestration.

## Tech Stack

### Frontend
| What | Use |
|---|---|
| Framework | React 19 |
| Build | Vite 6 |
| Language | TypeScript 5 (strict mode) |
| UI | Shadcn/ui + Radix primitives (owned code in `src/components/ui/`) |
| Styling | Tailwind CSS 4 + CSS-variable theme tokens |
| Data Grid | AG Grid Enterprise 35 |
| Charts (primary) | AG Charts Enterprise 13 (90% of visualizations) |
| Charts (exotic only) | ECharts 6 — Sankey, sunburst, radar, network, gauge, parallel coords, funnel ONLY |
| Routing | TanStack Router 1 (file-based) |
| Server State | TanStack Query 5 |
| Client State | Zustand 5 |
| Animations | `motion/react` (NOT `framer-motion`) |
| Icons | Lucide React |
| SQL Editor | Monaco Editor |
| Dates | date-fns 4 |

### Backend
| What | Use |
|---|---|
| Framework | FastAPI 0.128+ |
| Language | Python 3.12+ |
| ASGI | Uvicorn |
| Validation | Pydantic 2 |
| ORM | SQLAlchemy 2 (sync — no `[asyncio]` extras) |
| Oracle Driver | `oracledb` >= 3.3.0 (thick mode) |
| Migrations | Alembic (table name: `recviz_alembic_version`) |

## Project Structure

```
recviz/
├── frontend/src/
│   ├── components/
│   │   ├── ui/           # Shadcn/ui primitives (owned, not dependency)
│   │   ├── layout/       # Sidebar, topbar, theme provider
│   │   ├── dashboard/    # Filter bar, chart panels, drill breadcrumbs
│   │   ├── charts/       # Chart factory (AG Charts + ECharts wrappers)
│   │   ├── grid/         # AG Grid wrappers
│   │   ├── explorer/     # SQL editor, schema browser, results
│   │   ├── settings/     # Settings tabs (data sources, etc.)
│   │   └── shared/       # Skeletons, error boundary, empty states
│   ├── routes/           # TanStack Router file-based pages
│   ├── hooks/            # Custom hooks wrapping TanStack Query/mutations
│   ├── stores/           # Zustand stores (filter, drill, builder, layout-history)
│   ├── lib/              # api-client, utilities, formatters
│   └── types/            # Shared TypeScript types
├── backend/app/
│   ├── api/              # Route handlers (thin — validate, delegate, return)
│   ├── services/         # Business logic (query engine, dataset sync, config store)
│   ├── models/           # Pydantic request/response models
│   ├── db/               # SQLAlchemy engine, ORM models, session lifecycle
│   ├── migrations/       # Alembic migrations
│   ├── config/           # Database registry JSON (dev + prod variants)
│   └── core/             # DI, errors, dependencies
├── scripts/              # Setup/seed shell scripts
├── _references/          # Shadcn UI kit visual baseline (do not delete)
└── .planning/            # GSD workflow artifacts
```

## Coding Conventions

### TypeScript / React

- **Strict TypeScript.** No `any`. No `@ts-ignore`. Use `unknown` + type narrowing.
- **Functional components only.** Named function declarations, not arrow functions.
- **Named exports** for components, hooks, stores, utilities. Exception: route pages use `createFileRoute(...)` (TanStack Router requirement).
- **One primary component per file.** Small helper components used only by that primary can live in the same file (comment-dividered).
- **Props interface** named `{ComponentName}Props`, defined directly above the component.
- **Hooks return objects**, not arrays (except when wrapping a lib that does).
- **No barrel exports** (no `index.ts` re-exporting). Import directly from source files.
- **Import order**: React → external libs → internal absolute (`@/`) → relative → types. Blank line between groups. Type imports use `import type` (enforced by `verbatimModuleSyntax`).
- **Semicolons omitted**, single quotes, 2-space indent, trailing commas in multi-line.

### File Naming

| Type | Convention | Example |
|---|---|---|
| Components | `kebab-case.tsx` | `kpi-card.tsx` |
| Hooks | `use-{name}.ts` | `use-chart-data.ts` |
| Stores | `{name}-store.ts` | `filter-store.ts` |
| Utils | `kebab-case.ts` | `api-client.ts` |
| Pages | `index.tsx` / `$paramName.tsx` | `$dashboardId.tsx` |
| Python | `snake_case.py` | `query_engine.py` |

### Shadcn / Tailwind

- Shadcn components live in `src/components/ui/` as **owned code**, not a dependency.
- Use `cn()` from `lib/utils.ts` to merge classes.
- **Extend Shadcn via composition, do not modify `ui/` files** unless absolutely necessary.
- **Only use Shadcn CSS variable colors**: `text-foreground`, `bg-background`, `text-muted-foreground`, `bg-muted`, `border`, `bg-primary`. **Never hardcode hex/rgb/hsl.**
- Status colors: `text-green-600 dark:text-green-400` (positive), `text-red-600 dark:text-red-400` (negative). Always include `dark:` variant.
- **Every component must work in dark mode.** No exceptions.
- Chart colors: read from CSS variables (`--color-chart-1..5`).

### State (Zustand)

- One store per concern: `filter-store`, `drill-store`, `builder-store`, `layout-history-store`, etc.
- Interface named `{Name}Store` defined above the store.
- Use selectors to avoid re-renders: `useFilterStore((s) => s.globalFilters.dateRange)`.
- **Zustand for UI state. TanStack Query for server data.** Never store fetched data in Zustand.

### Data Fetching (TanStack Query)

- Every data operation wrapped in a custom hook in `frontend/src/hooks/`.
- Query keys: `['entity', identifier, filters]` — e.g., `['chart-data', chartId, globalFilters]`.
- Defaults: `staleTime: 5 * 60 * 1000`, `gcTime: 30 * 60 * 1000`, `retry: 1`, `refetchOnWindowFocus: false`.
- Global error handler toasts `ApiError.userMessage` via Sonner.

### API Client

- Single `api-client.ts` in `lib/` using native `fetch` (no axios).
- Base URL from `import.meta.env.VITE_API_BASE_URL`.
- **Automatic `snake_case` → `camelCase` transform on responses**, with a skip set (`DATA_KEYS` = `rows`, `columns`, `data`, `config`) to preserve DB column names inside data payloads.
- 204 responses return `undefined`.
- Non-2xx throws `ApiError` with `status`, `code`, `userMessage`, `detail`, `retryAfter`.

### Python / FastAPI

- **Route handlers are `def`, not `async def`** (Starlette threadpool). Exceptions: lifespan, middleware, framework-level hooks.
- **`sync` SQLAlchemy `Session`**, injected via `DbSessionDep`.
- **Service layer pattern**: route handlers are thin (validate → call service → return). Business logic and DB calls live in `backend/app/services/`.
- **Pydantic v2** models for all request/response bodies. Base class `CamelModel` in `backend/app/models/base.py` auto-generates camelCase aliases.
- **Config** via `pydantic-settings` in `backend/app/config.py`, reading from `.env`.
- **`from __future__ import annotations`** at top of every Python file.
- **Dependency injection**: `Annotated[Type, Depends(factory)]`. Named types: `DbSessionDep`, `QueryEngineDep`, `ConfigStoreDep`, `ResolvedDataSourceDep`, etc.
- Session lifecycle via `get_db_session()` generator with auto commit/rollback.
- Private helpers prefixed `_` (not exported).
- Table names prefixed `recviz_` (e.g., `recviz_dashboards`, `recviz_charts`).
- `sanitize_detail()` in `backend/app/core/errors.py` redacts connection strings and truncates long error messages before returning to clients.

## Design & UX Principles

- **Ultra-premium feel.** Generous spacing, subtle animations, skeleton loaders, micro-interactions.
- **Skeleton loading on every data component.** Never a blank screen.
- **Dark mode is first-class.** Every component must work in both light and dark.
- **Typography**: Inter font. Page title `text-2xl font-semibold tracking-tight`, section `text-lg font-medium`, body `text-sm`, caption `text-xs text-muted-foreground`.
- **Animations**: `motion/react` (NOT `framer-motion`). Fast (200–300ms), purposeful. Page transitions 200ms ease-out, KPI counters ~1s.
- **Spacing**: pages own `p-6`, section gaps `gap-6`, grid gaps `gap-4`.

## Charting Rules

- **AG Charts** for 90% of visualizations: line, bar, area, pie, donut, scatter, heatmap, treemap, waterfall, bullet, box plot, combo.
- **ECharts** ONLY for: Sankey, sunburst, radar/spider, graph/network, gauge, parallel coordinates, funnel.
- Never use ECharts for a chart type AG Charts supports.
- Both wrapped behind a unified `ChartWrapperProps` interface via `chart-factory.tsx`.

## Filtering Model

1. **Global filters** (filter bar) → backend calls → SQL `WHERE` clauses
2. **Cross-filters** (chart click interactions) → client-side only → Zustand → `useMemo` on cached data → zero network
3. **Drill-down** (depth navigation) → client-side for aggregated levels, backend call for detail level

## Infrastructure

### Local Dev
- **Docker Oracle** (`gvenzl/oracle-free:latest`) -- local dev database. Oracle 23ai Free in container, code targets 19c compatibility. Start: `docker run -d --name oracle-free -p 1521:1521 -e ORACLE_PASSWORD=RecViz2026 -e APP_USER=recviz -e APP_USER_PASSWORD=recviz_dev gvenzl/oracle-free:latest`
- **Oracle Instant Client** installed locally for thick mode parity with prod.
- **Backend**: `uvicorn app.main:app --reload`
- **Frontend**: `pnpm dev`
- **Seed data**: `cd backend && PYTHONPATH=. python ../scripts/seed-oracle.py`
- **Migrations**: `cd backend && PYTHONPATH=. alembic -c app/migrations/alembic.ini upgrade head`
- **No Postgres. No Redis. No Celery.**

### Production (Citi)
- Native on RHEL — no containers.
- Oracle 19c with NCS 871 character set.
- `oracledb` thick mode via Instant Client.

## References

- `.planning/PROJECT.md` — current milestone scope and decisions
- `.planning/codebase/` — codebase map (ARCHITECTURE, STACK, STRUCTURE, CONCERNS, CONVENTIONS, INTEGRATIONS, TESTING)
- `_references/shadcn-ui-kit-dashboard/` — visual baseline for UI work

## GSD Workflow Enforcement

Before using `Edit`, `Write`, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Entry points:
- `/gsd-quick` — small fixes, doc updates, ad-hoc tasks
- `/gsd-debug` — investigation and bug fixing
- `/gsd-execute-phase` — planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
