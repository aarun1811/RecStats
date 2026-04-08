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
<!-- Stack, conventions, and architecture details are in the hand-written sections above (Tech Stack Reference, Coding Conventions, Architecture). Full auto-generated details available in .planning/codebase/*.md files. -->
<!-- GSD:stack-end -->
<!-- GSD:conventions-start source:codebase/CONVENTIONS.md -->
<!-- GSD:conventions-end -->
<!-- GSD:architecture-start source:codebase/ARCHITECTURE.md -->
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
