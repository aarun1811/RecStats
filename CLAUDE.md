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
| Animations | Framer Motion 11 |
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
- **Animations**: Framer Motion for page transitions, chart load animations, KPI counter roll-up. Keep them fast (200-300ms) and purposeful.

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

## References

- Full design document: `RECVIZ_PLAN.md`
