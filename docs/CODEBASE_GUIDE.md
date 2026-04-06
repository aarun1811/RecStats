# RecViz Codebase Guide

> **Purpose:** This document is a comprehensive, file-level reference of the RecViz codebase as-built. It is written for AI agents and developers who need to understand the system quickly and start making changes without re-exploring every file. Read CLAUDE.md for conventions/rules; read this for how the code actually works today.
>
> **Last updated:** 2026-03-28

---

## Table of Contents

1. [Architecture As-Built](#1-architecture-as-built)
2. [The Two Parallel Systems](#2-the-two-parallel-systems)
3. [Frontend Deep Dive](#3-frontend-deep-dive)
4. [Backend Deep Dive](#4-backend-deep-dive)
5. [Infrastructure & Seed Data](#5-infrastructure--seed-data)
6. [Data Flows End-to-End](#6-data-flows-end-to-end)
7. [Known Gaps & Technical Debt](#7-known-gaps--technical-debt)
8. [File Reference Index](#8-file-reference-index)

---

## 1. Architecture As-Built

```
Browser
  │
  ├── http://localhost:5173  ─── React SPA (Vite dev server)
  │                                │
  │                                │  fetch() via api-client.ts
  │                                ▼
  ├── http://localhost:8000  ─── FastAPI Backend (sidecar)
  │                                │
  │                                ├── Config Store (JSON files on disk)
  │                                ├── Mock Data (in-memory fallback)
  │                                │
  │                                │  httpx.AsyncClient
  │                                ▼
  └── http://localhost:8088  ─── Apache Superset (headless, REST API only)
                                   │
                                   ├── SQLAlchemy → Oracle (production)
                                   ├── SQLAlchemy → SQLite (local dev seed DB)
                                   ├── Metadata → PostgreSQL (Docker)
                                   └── Cache → Redis (Docker)
```

**Key architectural facts:**
- The frontend NEVER talks to Superset directly. All queries go through FastAPI.
- FastAPI has two modes: **Superset mode** (real queries) and **Mock mode** (hardcoded data when Superset is unavailable).
- Dashboard layouts are defined as JSON config files in the backend, NOT in Superset.
- Superset is used purely as a SQL query execution engine via its REST API.

---

## 2. The Two Parallel Systems

**This is the most important thing to understand.** There are two dashboard systems in the codebase, built at different times:

### System A: Legacy (hardcoded, pre-config-driven)

Built first. Uses hardcoded chart IDs, Superset datasource IDs, and a fixed `GlobalFilters` type with specific field names (region, desk, status, etc.).

**Backend routes:** `/api/charts/*`, `/api/custom/kpi`, `/api/datasets/*`
**Frontend components:** `cross-filter-bar.tsx`, `drill-breadcrumb.tsx`, `grid-toolbar.tsx` (in `dashboard/`), cell renderers (in `grid/cell-renderers/`). Note: 6 legacy components have been removed (`filter-bar.tsx`, `kpi-row.tsx`, `kpi-card.tsx`, `chart-grid.tsx`, `chart-panel.tsx`, `data-grid.tsx`).
**Frontend hooks:** `use-chart-data.ts`, `use-kpi-data.ts`, `use-breaks-data.ts`, `use-prefetch.ts`

**Status:** These components are NOT wired to any route. They reference a defunct filter store shape (`globalFilters`, `updateGlobalFilter`) that no longer exists in the store. They would crash at runtime. However, they contain valuable logic for cross-filtering and drill-down that the config-driven system lacks.

### System B: Config-driven (current, active)

Built second. Dashboard structure is defined by JSON config files. The frontend reads the config and dynamically renders filters, KPIs, charts, and grids.

**Backend routes:** `/api/dashboards/*`, `/api/data-sources/*`
**Frontend components:** `dashboard-renderer.tsx`, `config-filter-bar.tsx`, `config-kpi-row.tsx`, `config-chart-grid.tsx`, `config-data-grid.tsx`
**Frontend hooks:** `use-dashboard-config.ts`, `use-dashboard-kpis.ts`, `use-data-source-query.ts`, `use-data-source-merge.ts`, `use-filter-options.ts`

**Status:** This is what users see. The `/$dashboardId` route loads a config and renders it. Currently serves the "TLM Statistics Dashboard" (`tlm-stats`). Adding a new dashboard = adding a JSON file.

### What's missing in the config-driven system

| Feature | Legacy has it | Config-driven has it |
|---------|:---:|:---:|
| Global filters | Yes | Yes |
| KPI cards with trends | Yes | Yes |
| Chart rendering (AG/ECharts) | Yes | Yes |
| AG Grid data tables | Yes | Yes |
| Multi-source merge | No | Yes |
| Dynamic database routing | No | Yes |
| Cascading filter options | No | Yes |
| Cross-filtering (chart click) | Yes | **No** |
| Drill-down (depth navigation) | Yes | **No** |
| Chart export (PNG/CSV) | Yes | **No** |
| Fullscreen charts | Yes | **No** |

---

## 3. Frontend Deep Dive

### 3.1 Entry & Routing

**Root:** `frontend/src/main.tsx`
- Registers AG Charts modules (`AllCommunityModule` from ag-charts-enterprise)
- Note: This registers community modules, not enterprise. If enterprise chart types are needed (waterfall, heatmap, treemap), change to `AllEnterpriseModule`.
- Renders `<App />` inside `<StrictMode>`

**App:** `frontend/src/App.tsx`
- Creates TanStack Router instance with `routeTree` from `routeTree.gen.ts` (auto-generated)
- Renders `<RouterProvider>`

**Route tree:**

```
__root.tsx              → ThemeProvider + QueryClientProvider + Toaster + ReactQueryDevtools
├── index.tsx           → Redirect to /dashboards
├── _app.tsx            → Layout: SidebarProvider + Sidebar + Header + AnimatedOutlet
│   ├── dashboards/
│   │   ├── index.tsx       → Dashboard list (cards with nav links)
│   │   └── $dashboardId.tsx → Config-driven dashboard via DashboardRenderer
│   ├── explorer/
│   │   └── index.tsx       → SQL IDE (Monaco + schema browser + results)
│   ├── reports/
│   │   └── index.tsx       → Scheduled exports (MOCK DATA ONLY)
│   └── settings/
│       └── index.tsx       → Appearance + Saved Views + Data Sources tabs
└── embed/
    └── dashboards/
        └── $dashboardId.tsx → Chromeless embeddable dashboard (no sidebar/header)
```

**Key routing details:**
- `_app.tsx` is a layout route (underscore prefix = pathless layout in TanStack Router)
- `$dashboardId` routes use `useParams()` to get the dashboard ID
- Page transitions use `motion/react` via `PageTransition` wrapper
- The embed route parses URL params: `filter.{id}=value`, `filter.lock=id1,id2`, `theme=dark|light`

### 3.2 Layout Components

| File | Purpose |
|------|---------|
| `components/layout/app-sidebar.tsx` | Collapsible sidebar with logo, environment badge, nav groups, user avatar. Uses Shadcn's `SidebarProvider` (256px width). Auto-collapses on mobile. Closes on route change. |
| `components/layout/header.tsx` | 56px sticky header with blur backdrop. Contains breadcrumbs (auto-generated from route), CommandPalette trigger, notification bell (mock), ThemeSwitch. |
| `components/layout/nav-main.tsx` | Sidebar navigation groups with collapsible sub-items. In icon mode, shows dropdown menu on hover. |
| `components/layout/nav-user.tsx` | User avatar + name + dropdown in sidebar footer. Hardcoded user "Aarun Srinivas". |
| `components/layout/command-palette.tsx` | Cmd+K dialog using Shadcn CommandDialog. Searches dashboards, charts, datasets via `/api/search`. Recent searches stored in localStorage. Navigation on select. |
| `components/layout/search.tsx` | Simpler static search component. **UNUSED** — CommandPalette is used instead. |
| `components/layout/theme-provider.tsx` | Custom theme provider (NOT `next-themes`). Supports light/dark/system. Persists to localStorage `recviz-theme`. Applies class to `<html>`. |
| `components/layout/theme-switch.tsx` | Sun/moon toggle button using Shadcn Button + Lucide icons. |

### 3.3 Dashboard Components (Config-Driven — THE ACTIVE SYSTEM)

| File | Purpose |
|------|---------|
| `components/dashboard/dashboard-renderer.tsx` | **The orchestrator.** Receives a `DashboardConfig`, initializes filter store with defaults + URL overrides + locked filters, auto-applies on load. Renders: ConfigFilterBar → ConfigKpiRow → ConfigChartGrid → ConfigDataGrid in order. Handles loading/error states. |
| `components/dashboard/config-filter-bar.tsx` | Renders filter controls from config. Supports `single-select` (Shadcn Select), `multi-select` (checkbox popover), `preset-range` (toggle group). Dynamic options fetched via `useFilterOptions()` with cascading dependencies (`dependsOn`). Single-selects auto-select first option. Apply/Reset buttons write to filter store's `applied` snapshot. |
| `components/dashboard/config-kpi-row.tsx` | Renders KPI cards from `useDashboardKpis()` results. Each card shows label, formatted value (with `toLocaleString`), and optional percentage trend badge (green for positive context, red for negative like "breaks"). Uses `CountAnimation` for animated number display. Skeleton loading. |
| `components/dashboard/config-chart-grid.tsx` | Renders charts in a 12-column CSS grid. Two source types: `sourceType: 'query'` (independent `useDataSourceQuery()` call per chart) or `sourceType: 'kpi_values'` (builds data from already-fetched KPI results — zero extra queries). Uses `ChartFactory` for rendering. Each chart is wrapped in a Card with title. |
| `components/dashboard/config-data-grid.tsx` | Renders AG Grid tables. Supports single-source or merged-source (via `useDataSourceMerge()`). Conditional visibility via `visibleWhen` expression (e.g., `breaks_count > 0` — evaluates against KPI values). Full AG Grid Enterprise with pagination (100 rows/page), sorting, column filtering, quick-filter search. Uses Quartz theme with programmatic dark mode. |

### 3.4 Dashboard Components (Legacy — NOT WIRED TO ROUTES)

| File | Purpose | Status |
|------|---------|--------|
| `components/dashboard/cross-filter-bar.tsx` | Active cross-filter badges with remove buttons. | Working, depends on filter store's crossFilters |
| `components/dashboard/drill-breadcrumb.tsx` | Animated breadcrumb trail for drill navigation. | Working, depends on drill store |
| `components/dashboard/grid-toolbar.tsx` | Grid toolbar with export, column toggle, quick filter. | Working component |
| `components/grid/cell-renderers/status-cell.tsx` | Colored badge for status values. | Working component |
| `components/grid/cell-renderers/amount-cell.tsx` | Currency-formatted number cell. | Working component |
| `components/grid/cell-renderers/sla-cell.tsx` | SLA indicator (check/X icon). | Working component |

### 3.5 Chart Components

| File | Purpose |
|------|---------|
| `components/charts/chart-factory.tsx` | Routes `vizType` to the right wrapper. ECharts for: sankey, radar, sunburst, gauge, funnel, graph, parallel. AG Charts for everything else. Accepts `ChartWrapperProps` (data, vizType, categoryKey, valueKeys, title, onChartClick, activeSelection). |
| `components/charts/ag-chart-wrapper.tsx` | Builds AG Charts options from data. `buildSeries()` maps viz types: bar, stacked-bar, line, area, pie, donut, scatter, histogram, waterfall, combo. `formatDates()` auto-detects epoch-ms values. `makeItemStyler()` dims non-selected items for cross-filter highlighting. Theme refreshes via `requestAnimationFrame` on `resolvedTheme` change. Click handler debounced 250ms to distinguish single-click from double-click. |
| `components/charts/echart-wrapper.tsx` | Tree-shaken ECharts (only required chart types imported). Custom "recviz" theme registered from CSS variables, re-registered on theme change. `buildEChartsOption()` handles: sankey (links + nodes), radar (indicator + values), sunburst (tree data), gauge (single value), funnel (descending values), graph (nodes + edges), parallel (multi-axis). |

### 3.6 Explorer Components

| File | Purpose |
|------|---------|
| `components/explorer/sql-editor.tsx` | Monaco Editor configured for SQL. Cmd+Enter to execute. Theme switches between `vs-dark` and `vs` on theme change. Auto-resizes to container. |
| `components/explorer/schema-browser.tsx` | Tree view of databases → datasets → columns (with type icons). Data from `useDatasets()`. Click column to insert into editor. Collapsible tree with search filter. |
| `components/explorer/query-results.tsx` | AG Grid showing query results. Status bar with row count and execution time. CSV export button, clipboard copy, "Chart It" button that opens `ChartBuilderDialog`. |
| `components/explorer/query-history.tsx` | Timeline component showing past queries. Each entry shows SQL preview, status badge, row count, relative timestamp (via date-fns `formatDistanceToNow`). Click to load query back into editor. |
| `components/explorer/chart-builder-dialog.tsx` | Quick visualization dialog. Pick chart type (bar/line/pie), X column, Y column from query result columns. Renders inline AG Charts preview. |

### 3.7 Settings Components

| File | Purpose |
|------|---------|
| `routes/_app/settings/index.tsx` | Three tabs: Appearance, Saved Views, Data Sources. |
| Appearance tab | Theme picker (Light/Dark/System) with visual preview cards. Density (Comfortable/Compact) and Font Size (Small/Medium/Large) buttons exist but **are not wired to any state**. |
| Saved Views tab | Lists views from `useSavedViews()`. Shows dashboard ID, creation date, delete button. "Load" button **does nothing** (no click handler). |
| `components/settings/data-sources-tab.tsx` | Grid/list toggle view of database connections. Search filtering. "Add Data Source" button opens `DataSourceSheet`. |
| `components/settings/data-source-sheet.tsx` | Side panel for database CRUD. Create mode: backend type picker, display name, Simple/Advanced connection tabs, test connection. Detail mode: shows datasets with infinite scroll, sync/test/edit/delete buttons. |
| `components/settings/data-source-card.tsx` | Card view of a database connection (name, type icon, dataset count, status dot). |
| `components/settings/data-source-row.tsx` | Row/list view of a database connection. |
| `components/settings/data-sources-toolbar.tsx` | Search input + view toggle + add button for the data sources list. |

### 3.8 Embed Components

| File | Purpose |
|------|---------|
| `components/embed/embed-topbar.tsx` | Thin topbar for embedded dashboards. Shows dashboard name + "Open in RecViz" link. No sidebar, no header. |
| `routes/embed/dashboards/$dashboardId.tsx` | Parses URL params for initial filters, locked filters, and theme. Renders `DashboardRenderer` with these overrides. |

### 3.9 Shared Components

| File | Purpose |
|------|---------|
| `components/shared/count-animation.tsx` | Animated number counter using `motion/react` `useMotionValue` + `useTransform` + `animate()`. Rolls up from 0 to target value over ~1s. Formats with `toLocaleString`. |
| `components/shared/error-boundary.tsx` | React error boundary with reset button. Shows error message in a Card. |
| `components/shared/page-transition.tsx` | `motion/react` wrapper for page enter/exit animations. Fade + slight vertical slide, 200ms. |

### 3.10 Stores

| File | State | Actions |
|------|-------|---------|
| `stores/filter-store.ts` | `values: Record<string, FilterValue>` (current filter values), `locked: Set<string>` (immutable filters for embeds), `applied: Record<string, FilterValue>` (snapshot at last Apply click — used as query keys), `crossFilters: CrossFilter[]` | `setFilterValue`, `initializeFilters`, `applyFilters`, `resetFilters`, `addCrossFilter` (toggle pattern), `removeCrossFilter`, `clearCrossFilters` |
| `stores/drill-store.ts` | `sourceChartId: string \| null`, `levels: DrillLevel[]` (stack of column+value pairs) | `drillDown`, `drillUp`, `drillToLevel`, `resetDrill` |

**Important:** The filter store was refactored from a `GlobalFilters`-typed shape (with named fields like `region`, `desk`) to a generic `Record<string, FilterValue>` shape. The legacy components still reference the old shape and will crash.

### 3.11 Hooks

| Hook | Purpose | Used by |
|------|---------|---------|
| `use-dashboard-config.ts` | `useQuery` for `GET /api/dashboards/{id}` — returns full `DashboardConfig` | `$dashboardId.tsx` route |
| `use-dashboards.ts` | `useQuery` for `GET /api/dashboards` — returns dashboard list | Dashboard list page |
| `use-dashboard-kpis.ts` | `useQuery` for `POST /api/dashboards/{id}/kpis` with applied filters — returns `KpiResult[]` | `ConfigKpiRow`, `ConfigChartGrid` (for kpi_values source), `ConfigDataGrid` (for visibleWhen) |
| `use-data-source-query.ts` | `useQuery` for `POST /api/data-sources/{id}/query` with applied filters — returns `{columns, rows}` | `ConfigChartGrid`, `ConfigDataGrid` |
| `use-data-source-merge.ts` | `useQuery` for `POST /api/data-sources/merge` — merges multiple sources | `ConfigDataGrid` (merged grids) |
| `use-filter-options.ts` | `useQuery` for `GET /api/data-sources/{id}/distinct/{column}` with dependency filters — returns `string[]` | `ConfigFilterBar` (cascading dropdowns) |
| `use-chart-data.ts` | `useQuery` for `POST /api/charts/{id}/data` with legacy GlobalFilters | **Legacy only** — not used by config-driven system |
| `use-kpi-data.ts` | `useQuery` for `POST /api/custom/kpi` with legacy GlobalFilters | **Legacy only** |
| `use-breaks-data.ts` | `useQuery` for `POST /api/datasets/breaks/data` with legacy GlobalFilters | **Legacy only** |
| `use-filter-options.ts` | Dynamic filter options with cascading dependency support | `ConfigFilterBar` |
| `use-cross-filter.ts` | Reads `crossFilters` from store, returns `appliedCrossFilters` + `isCrossFilterActive` helpers | Legacy `ChartGrid`, `DataGrid` |
| `use-drill-down.ts` | Per-chart drill-down hook with config-defined hierarchy. `applyDrillFilters()` filters + re-aggregates data by drill levels. `reaggregateByField()` groups + sums metric columns (accepts optional `metricColumns` from config, falls back to numeric-type heuristic). | Config-driven drill-down |
| `use-sql-execute.ts` | `useMutation` for `POST /api/sql/execute` | Explorer page |
| `use-sql-history.ts` | `useQuery` for `GET /api/sql/history` | Explorer query history panel |
| `use-datasets.ts` | `useQuery` for `GET /api/datasets` | Schema browser |
| `use-dataset.ts` | `useQuery` for `GET /api/datasets/{id}` | Schema browser detail |
| `use-databases.ts` | Full CRUD hooks: `useDatabases`, `useDatabase`, `useDatabaseDatasets`, `useCreateDatabase`, `useUpdateDatabase`, `useDeleteDatabase`, `useTestConnection`, `useSyncDatasets` | Settings data sources tab |
| `use-search.ts` | `useMutation` for `POST /api/search` | Command palette |
| `use-saved-views.ts` | `useQuery` + `useMutation` for `/api/views` CRUD | Settings saved views tab |
| `use-prefetch.ts` | Prefetches 6 hardcoded chart IDs on mount | **Legacy only** — disconnected from config-driven system |
| `use-mobile.ts` | Media query hook for responsive breakpoint | Layout (auto-collapse sidebar) |

### 3.12 Lib / Utilities

| File | Purpose |
|------|---------|
| `lib/api-client.ts` | Fetch-based HTTP client with `get`/`post`/`put`/`del` methods. Auto-transforms response keys from `snake_case` to `camelCase` via `transformKeys()`, EXCEPT values inside `rows` or `columns` keys (preserves raw DB column names). Throws `ApiError` on non-2xx. Base URL defaults to `http://localhost:8000`. |
| `lib/query-client.ts` | TanStack QueryClient config: 5-min staleTime, 30-min gcTime, 1 retry, no refetch on window focus. |
| `lib/chart-themes.ts` | Reads CSS variables from DOM at runtime. Builds AG Charts theme (palette + axis/legend overrides). Builds ECharts theme (registered as "recviz"). Series palette: primary CSS variable + 9 hardcoded hex colors (slight deviation from "no hardcoded colors" rule). |
| `lib/cross-filter.ts` | `applyCrossFilters(data, filters, excludeChartId)` — filters data rows client-side, excludes filters from the source chart (so clicking a chart doesn't filter itself). Returns filtered array. |
| `lib/utils.ts` | `cn()` utility for merging Tailwind classes (clsx + tailwind-merge). |

### 3.13 Types

| File | Key types |
|------|-----------|
| `types/dashboard-config.ts` | `DashboardConfig` (filters, kpis, charts, grids, layout, features), `FilterConfig`, `KpiConfig`, `ChartConfig`, `GridConfig`, `DataSourceRef`, `MergeConfig` |
| `types/filter.ts` | `FilterValue` (string \| string[] \| null), `CrossFilter` (chartId, field, value), `AppliedFilters` (Record<string, FilterValue>) |
| `types/chart.ts` | `ChartWrapperProps` (data, vizType, categoryKey, valueKeys, title, onChartClick, activeSelection), `VizType` union type, `ChartDataResponse` |
| `types/api.ts` | `ApiError`, `KpiResult` (id, label, value, percentage, context), `SqlResult` (columns, rows, query_id, status, duration_ms) |
| `types/dashboard.ts` | Legacy `Dashboard` type with hardcoded fields |
| `types/dataset.ts` | `Dataset`, `DatasetColumn` |
| `types/database.ts` | `DatabaseInfo`, `DatabaseCreate`, `TestConnectionResult` |
| `types/views.ts` | `SavedView`, `SavedViewCreate` |
| `types/index.ts` | Re-exports from other type files (barrel export — exception to the "no barrel exports" rule, but only for types) |

### 3.14 CSS & Theming

**`frontend/src/index.css`:**
- Uses `oklch()` color space for all Shadcn CSS variables
- Full light and dark themes with semantic tokens (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, sidebar-*)
- 5 chart colors per theme (`--chart-1` through `--chart-5`)
- `@layer components` for micro-interactions: `.card-hover` (lift on hover), smooth focus transitions
- Custom scrollbar colors matching theme
- `--radius: 0.625rem` for border radius

---

## 4. Backend Deep Dive

### 4.1 Entry Point & Startup

**`backend/app/main.py`:**

Lifespan startup sequence (strict order):
1. Create shared `httpx.AsyncClient` (120s timeout)
2. Authenticate to Superset via `SupersetClient.authenticate()` — **hard requirement, crashes if Superset is down**
3. Load config files via `ConfigStore()`
4. Sync databases into Superset via `DatabaseRegistrar.sync()`
5. Create `QueryEngine` with config store + superset client + database registrar

All shared services stored on `app.state`, retrieved via DI from `core/dependencies.py`.

**Middleware:**
- CORS: allows localhost:5173, :3000, :4200
- X-Frame-Options: ALLOWALL (for iframe embedding)

**Note on mock mode:** Despite SETUP.md claiming mock mode works without Superset, the current `main.py` will crash on startup if Superset is unavailable because `authenticate()` is called unconditionally. The try/except in the lifespan handler catches this and sets `superset=None`, but individual endpoints need to handle the None case.

### 4.2 API Routes — Config-Driven System

#### `/api/dashboards` — `backend/app/api/dashboards.py`

| Endpoint | Method | Request | Response | Purpose |
|----------|--------|---------|----------|---------|
| `/api/dashboards` | GET | — | `[{id, title, description}]` | List all dashboards from config files |
| `/api/dashboards/{id}` | GET | — | Full `DashboardConfig` JSON | Get complete dashboard definition |
| `/api/dashboards/{id}/kpis` | POST | `{filters: dict}` | `{kpis: [{id, value, percentage?}]}` | Execute KPI queries with trend computation |

**KPI computation flow:**
1. For each KPI in config, iterate over its `sources` (each has `data_source_id` + `metric` column)
2. Call `query_engine.execute()` for each source
3. Sum the metric column values across all result rows
4. Compute trend percentages (e.g., `breaks / total_items * 100`) by cross-referencing other KPI values

#### `/api/data-sources` — `backend/app/api/data_sources.py`

| Endpoint | Method | Request | Response | Purpose |
|----------|--------|---------|----------|---------|
| `/api/data-sources/{id}/query` | POST | `{filters: dict}` | `{columns, rows, row_count, truncated}` | Execute a data source query |
| `/api/data-sources/merge` | POST | `{sources, merge_on, merge_type, filters}` | `{columns, rows, row_count}` | Execute + merge multiple sources |
| `/api/data-sources/{id}/distinct/{column}` | GET | `?filter.*=value` query params | `string[]` | Distinct values for filter dropdowns |

### 4.3 API Routes — Legacy System

#### `/api/charts` — `backend/app/api/charts.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/charts` | GET | List all charts (Superset or mock) |
| `/api/charts/{id}` | GET | Get chart metadata |
| `/api/charts/{id}/data` | POST | Get chart data with filters + drill |

Uses `CHART_DATASOURCE_MAP` (hardcoded string → Superset datasource ID mapping) and `CHART_QUERIES` (predefined query definitions). Builds Superset adhoc_filters from `GlobalFilters` and `DrillLevel` objects.

#### `/api/custom` — `backend/app/api/custom.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/custom/kpi` | POST | Legacy KPI aggregations (4 fixed queries) |
| `/api/custom/aggregations` | POST | Generic aggregation query |
| `/api/custom/counterparties` | GET | Autocomplete for counterparty names |

#### `/api/datasets` — `backend/app/api/datasets.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/datasets` | GET | List datasets (always mock) |
| `/api/datasets/{id}` | GET | Dataset metadata with columns |
| `/api/datasets/{id}/data` | POST | Paginated raw data with filters + sort |

#### `/api/databases` — `backend/app/api/databases.py`

Full CRUD for database connections. Uses `uri_builder.build_sqlalchemy_uri()` to construct URIs from form fields. Proxies to Superset for create/update/delete, falls back to in-memory mock store.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/databases` | GET | List databases |
| `/api/databases/{id}` | GET | Get database details |
| `/api/databases/{id}/datasets` | GET | Datasets for a database (paginated) |
| `/api/databases` | POST | Create database connection |
| `/api/databases/{id}` | PUT | Update database |
| `/api/databases/{id}` | DELETE | Delete database |
| `/api/databases/test` | POST | Test connection |
| `/api/databases/{id}/sync` | POST | Trigger dataset refresh |

#### `/api/sql` — `backend/app/api/sql.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sql/execute` | POST | Execute arbitrary SQL via Superset (returns 503 if Superset unavailable) |
| `/api/sql/history` | GET | Last 50 query executions (in-memory) |
| `/api/sql/databases` | GET | Available databases |

When Superset is unavailable, the endpoint returns HTTP 503 with a `superset_unavailable` error and a `retry_after` hint. There is no mock SQL fallback.

#### `/api/search` — `backend/app/api/search.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search` | POST | Substring search across dashboards, charts, datasets |

#### `/api/export` — `backend/app/api/export.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/export/pdf` | POST | Queue PDF export |
| `/api/export/excel` | POST | Queue Excel export |
| `/api/export/{job_id}/status` | GET | Check export status |

**Entirely stubbed.** Creates job IDs but never processes them. No Celery integration.

#### `/api/views` — `backend/app/api/views.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/views` | GET | List saved views |
| `/api/views` | POST | Create saved view |
| `/api/views/{id}` | DELETE | Delete saved view |

In-memory storage. Resets on server restart.

### 4.4 Services

#### `services/superset_client.py` — Superset API Wrapper

Async HTTP client wrapping Superset's REST API v1.

**Authentication:**
- `authenticate()` → POST `/api/v1/security/login` with username/password → stores JWT
- `authenticate()` also fetches CSRF token inline → GET `/api/v1/security/csrf_token/` → stores CSRF token
- Auto-refreshes token after 25 minutes (Superset default expiry: 30 min)
- Auto-retries on 401 (re-authenticates + retries once)

**Key methods:**
- `get_chart_data(datasource_id, queries)` — POST to `/api/v1/chart/data` (the primary query mechanism for legacy charts)
- `execute_sql(database_id, sql, limit)` — POST to `/api/v1/sqllab/execute/` (used by config-driven system + SQL explorer)
- CRUD methods for charts, datasets, dashboards, databases

#### `services/query_engine.py` — SQL Template Engine

The most sophisticated service. Builds and executes SQL from config templates.

**`execute(data_source_id, filters)` flow:**

1. **Database resolution** (`_resolve_database`):
   - **Static routing**: Config specifies a fixed `database` name (e.g., `reconmgmt_manual` → `superset_db_reconmgmt`)
   - **Dynamic routing**: Config specifies `routing.filter_key` (e.g., `tlm_instance`) + `routing.database_map` (e.g., `{"TLMP_CONSUMER": "superset_db_TCOSPRD"}`). Reads the filter value and looks it up. Raises `ValueError` if missing.

2. **Superset ID resolution**: `database_registrar.resolve(logical_name)` → numeric Superset database ID

3. **SQL building** (`_build_sql`):
   - `{{column}}` → replaced with requested column (validated against allowed list)
   - `{{values}}` → replaced with comma-separated, single-quote-escaped values
   - `{{value}}` → replaced with single escaped value
   - `{{date_range_clause}}` → dialect-specific date range SQL:
     - Oracle: `TRUNC(SYSDATE) - DECODE({{days}}, 1, 1, 7, 7, 30, 30, 1)`
     - SQLite: `date('now', '-' || {{days}} || ' days')`
     - PostgreSQL: `CURRENT_DATE - INTERVAL '{{days}} days'`
   - `{{filters}}` → assembled AND clauses from filter mappings
   - Remaining `{{...}}` placeholders stripped via regex
   - Schema prefixes stripped when target DB has no schema (SQLite dev mode)

4. **Execution**: `superset_client.execute_sql(database_id, sql)`

5. **Result**: `{columns, rows, row_count, truncated}`

**`execute_distinct(data_source_id, column, filters)`** — variant that returns a flat `string[]` for filter dropdowns.

#### `services/merge_engine.py` — Multi-Source Join

Stateless utility. Two join types:
- **outer_join**: All rows from both sides, `None` for missing columns
- **inner_join**: Only matching rows

Implementation: Python-level hash join (dict index on right side by merge key tuple). Multi-source merges are fold-left: merge(A, B, C) = merge(merge(A, B), C).

#### `services/config_store.py` — JSON Config Loader

Loads at startup from `app/config/`:
- `dashboards/*.json` → parsed as `DashboardConfig`
- `data_sources/*.json` → parsed as `DataSourceConfig`

Read-only, no hot-reload. Currently: 1 dashboard (`tlm-stats`), 4 data sources.

#### `services/database_registrar.py` — Database Lifecycle

**`sync()`** (startup): Lists Superset databases, creates any missing ones from `databases.json`, caches name→ID mapping.

**`resolve(name)`** (per-query): Returns Superset numeric ID from cache. Cache miss triggers refresh with 30s cooldown + negative cache.

Also provides `get_dialect()`, `get_schema()`, `get_all_schemas()` for the query engine.

#### `services/uri_builder.py` — SQLAlchemy URI Construction

Builds URIs from form fields. Supports:
- Oracle: `oracle+cx_oracle://user:pass@host:port/?service_name=DB`
- PostgreSQL: `postgresql://user:pass@host:port/db`
- Hive: `hive://user:pass@host:port/db`
- Elasticsearch: `elasticsearch+http://host:port/`

### 4.5 Models

**Base:** `models/base.py` — `CamelModel` with `alias_generator=to_camel`, auto-converts snake_case Python → camelCase JSON.

**Config models (plain `BaseModel`, NOT `CamelModel`):**

| File | Key models |
|------|------------|
| `models/dashboard_config.py` | `DashboardConfig` (id, title, description, filters[], kpis[], charts[], grids[], layout, features{crossFilter, drillDown}), `FilterConfig`, `KpiConfig` (sources[], trend), `ChartConfig` (vizType, sourceType, dataSourceId, layout{colSpan, rowSpan}), `GridConfig` (dataSourceId OR sources[]+mergeConfig, visibleWhen, columns[]) |
| `models/data_source_config.py` | `DataSourceConfig` (id, database OR routing{type, filterKey, databaseMap}, sql, filterMappings[], columns[], allowedDistinctColumns[]) |
| `models/database_config.py` | `DatabaseEntry` (name, sqlalchemyUri, dialect, schema), `DatabasesConfig` (databases[]) |

**API models (CamelModel):**

| File | Key models |
|------|------------|
| `models/filters.py` | `GlobalFilters` (9 optional fields: region, country, lob, desk, currency, status, counterparty, date_from, date_to), `DrillLevel` (column, value), `ChartDataRequest` (filters, drill_levels, limit), `KpiRequest` (filters dict), `KpiResult`/`KpiResponse` |
| `models/chart_data.py` | `ChartDataResponse` (columns, data, row_count), `ChartConfig` (legacy) |
| `models/dashboard.py` | Legacy `DashboardConfig` (different from dashboard_config.py — has layout items + cross_filter_rules) |
| `models/dataset.py` | `DatasetResponse`, `DatasetColumn`, `DatasetDataRequest`/`Response` |
| `models/database.py` | `DatabaseCreate`/`Update`/`Info`, `TestConnectionRequest`/`Response` |
| `models/export.py` | `ExportRequest`, `ExportStatus` |
| `models/views.py` | `SavedView`, `SavedViewCreate` |

**Note:** There are TWO different `DashboardConfig` classes — `models/dashboard.py` (legacy) and `models/dashboard_config.py` (config-driven). They serve different purposes.

### 4.6 Configuration Files

#### `backend/app/config/dashboards/tlm-stats.json`

The TLM Statistics Dashboard definition:
- **4 filters**: `tlm_instance` (single-select from reconmgmt_recon_bank), `recon` (multi-select, depends on tlm_instance), `set_id` (multi-select, depends on tlm_instance+recon), `date_range` (preset-range: 1/7/30 days, default=1)
- **4 KPIs**: `total_items` (automatch + manual), `breaks` (with % of total), `automatch` (with % of total), `manual_match` (with % of total)
- **1 chart**: "Recon Distribution" donut from KPI values (zero extra queries)
- **2 grids**: "Break Statistics" (direct query, visible when breaks > 0), "Reconciliation Statistics" (merge of automatch + manual on `[agent_code, set_id, stmt_date]`, visible when total_items > 0)

#### `backend/app/config/data_sources/*.json`

| File | Database | Routing | SQL complexity |
|------|----------|---------|----------------|
| `tlm_breaks.json` | Dynamic by `tlm_instance` | Maps TLMP_CONSUMER → TCOSPRD, etc. | Complex: 3-table JOIN (bank, message_feed, item), WHERE flag_2=0 |
| `tlm_automatch.json` | Dynamic by `tlm_instance` | Same mapping | Complex: LEFT JOIN to tlm_bdr_relationship_header, CASE expressions |
| `reconmgmt_recon_bank.json` | Static: superset_db_reconmgmt | Always same DB | Simple: SELECT DISTINCT with `{{column}}` placeholder |
| `reconmgmt_manual.json` | Static: superset_db_reconmgmt | Always same DB | Medium: SELECT from mr_csum_man_match_stats_hist with schema prefix |

#### `backend/app/config/databases.json`

4 database entries, all pointing to SQLite seed DB in local dev:
- `superset_db_TCOSPRD` (TLM Consumer)
- `superset_db_TFINPRD` (TLM Finance)
- `superset_db_TWMPRD` (TLM Wealth)
- `superset_db_reconmgmt` (ReconMgmt)

In production, each would point to a different Oracle instance.

### 4.7 Tests

| File | Tests | Coverage |
|------|-------|----------|
| `tests/test_query_engine.py` | 10 | SQL building +/- filters, dynamic/static routing, SQLite/Oracle dialect, schema stripping, SQL injection escaping, column validation |
| `tests/test_merge_engine.py` | 3 | Outer join, inner join, empty right side |
| `tests/test_database_registrar.py` | 8 | Sync create/skip, resolve IDs, unknown errors, refresh on miss, negative cache, dialect/schema getters |
| `tests/test_config_store.py` | 6 | List dashboards, get specific (assert 4 filters/4 KPIs/1 chart/2 grids), not-found, data source retrieval + routing type |

**No tests for:** API routes, SupersetClient, mock data/SQL executor, frontend.

---

## 5. Infrastructure & Seed Data

### 5.1 Docker Compose (`docker-compose.yml`)

Three services:
- **PostgreSQL 16-alpine** (port 5432): Creates `superset_meta` + `recon_data` databases
- **Redis 7-alpine** (port 6379): Query cache + Celery broker
- **Superset** (port 8088): Custom Dockerfile on Python 3.12-slim

### 5.2 Superset Configuration

Two configs:
- `superset/superset_config.py` — Docker mode: PostgreSQL metadata, Redis cache, Celery async
- `superset/superset_config_local.py` — Local dev: SQLite metadata, in-memory cache, no Celery, CSRF disabled, unsafe DB checks disabled (allows SQLite data sources)

### 5.3 Seed Data

**SQLite seed** (`scripts/generate-seed-db.py`):
Generates `backend/app/config/seed/seed.db` with tables matching TLM schema:
- `bank` (~200 rows), `message_feed` (~500), `item` (~5K), `tlm_bdr_relationship_header` (~4K)
- `recon_bank` (dimension table for filters)
- `mr_csum_man_match_stats_hist` (~2K rows)
- Auto-updates `databases.json` with absolute path

**PostgreSQL seed** (`seed/create_recon_db.py`):
Legacy seed for PostgreSQL. Creates: `counterparties` (50), `transactions` (1M), `breaks` (~150K), `daily_metrics` (365).

**Superset registration** (`seed/register_superset.py`):
Registers the PostgreSQL `recon_data` database in Superset, creates 4 datasets, 10 charts, 1 dashboard.

---

## 6. Data Flows End-to-End

### 6.1 Dashboard Load Flow

```
User navigates to /dashboards/tlm-stats
  → $dashboardId.tsx extracts params
  → useDashboardConfig('tlm-stats') fires
    → GET /api/dashboards/tlm-stats
    → ConfigStore returns tlm-stats.json
  → DashboardRenderer receives config
  → Initializes filter store (defaults from config)
  → Renders ConfigFilterBar
    → For each filter, useFilterOptions() fires
      → GET /api/data-sources/reconmgmt_recon_bank/distinct/tlm_instance
      → QueryEngine builds: SELECT DISTINCT tlm_instance FROM recon_bank
      → Superset executes SQL → returns values
    → User selects options, clicks Apply
    → filterStore.applyFilters() snapshots values → applied
  → Renders ConfigKpiRow
    → useDashboardKpis('tlm-stats', applied) fires
      → POST /api/dashboards/tlm-stats/kpis {filters: applied}
      → For each KPI source, QueryEngine executes SQL
      → Backend sums values, computes trend percentages
      → Returns [{id: 'total_items', value: 5000}, {id: 'breaks', value: 150, percentage: 3.0}, ...]
    → Cards render with CountAnimation
  → Renders ConfigChartGrid
    → Charts with sourceType 'kpi_values' build data from KPI results (no extra query)
    → Charts with sourceType 'query' fire useDataSourceQuery()
  → Renders ConfigDataGrid
    → Evaluates visibleWhen against KPI values
    → Single-source grids fire useDataSourceQuery()
    → Merged grids fire useDataSourceMerge()
      → POST /api/data-sources/merge {sources, merge_on, filters}
      → Backend executes each source, MergeEngine outer-joins results
```

### 6.2 Cross-Filter Flow (Legacy System Only)

```
User clicks a bar segment in a chart
  → AgChartWrapper onClick fires
  → addCrossFilter({ chartId, field: categoryKey, value: clickedCategory })
  → Filter store toggles: if same filter exists, removes it; otherwise adds it
  → CrossFilterBar renders active filter badges
  → All other chart instances:
    → useCrossFilter() reads crossFilters from store
    → applyCrossFilters(data, filters, excludeChartId) filters rows client-side
    → Chart re-renders with filtered data (no network call)
  → Source chart: makeItemStyler() dims non-selected items
  → DataGrid: isExternalFilterPresent/doesExternalFilterPass filters rows
  → KpiRow: computeKpis() recomputes from filtered data
```

### 6.3 SQL Explorer Flow

```
User types SQL in Monaco editor
  → Presses Cmd+Enter
  → useSqlExecute() mutation fires
    → POST /api/sql/execute {sql, database_id, limit}
    → If Superset available: superset_client.execute_sql()
    → If not: returns 503 (superset_unavailable)
  → QueryResults AG Grid renders columns + rows
  → Query added to in-memory history
  → User clicks "Chart It" → ChartBuilderDialog opens
    → Select chart type, X column, Y column
    → AG Charts renders inline preview
```

### 6.4 Embeddable Dashboard Flow

```
External app renders iframe: /embed/dashboards/tlm-stats?filter.tlm_instance=TLMP_CONSUMER&filter.lock=tlm_instance&theme=dark

  → embed/$dashboardId.tsx parses URL search params
  → Extracts: initialFilters={tlm_instance: 'TLMP_CONSUMER'}, lockedFilters=['tlm_instance'], theme='dark'
  → Sets theme via useTheme().setTheme('dark')
  → Renders EmbedTopbar (dashboard name + "Open in RecViz" link)
  → Renders DashboardRenderer with initialFilters + lockedFilters
  → DashboardRenderer initializes filter store with locked set
  → Locked filters render as disabled in ConfigFilterBar
  → Everything else works the same as normal dashboard
```

---

## 7. Known Gaps & Technical Debt

### Critical (Functional Gaps)

| # | Issue | Impact | Where |
|---|-------|--------|-------|
| 1 | **Cross-filter not in config-driven dashboards** | Users can't click charts to filter other charts in the active dashboard system | `ConfigChartGrid` lacks onChartClick + cross-filter integration |
| 2 | **Drill-down not in config-driven dashboards** | Users can't drill into chart segments for deeper analysis | `ConfigChartGrid` lacks drill-down integration |
| 3 | **Chart panel features missing in config-driven** | No export PNG/CSV, no fullscreen, no refresh per-chart | `ConfigChartGrid` renders charts directly without `ChartPanel` wrapper |
| 4 | **Export system entirely stubbed** | Export buttons create job IDs but never produce files | `backend/app/api/export.py` — no Celery worker, no file generation |

### High (Broken / Dead Code)

| # | Issue | Impact | Where |
|---|-------|--------|-------|
| 5 | **Legacy components removed** | 6 legacy components (`filter-bar.tsx`, `kpi-row.tsx`, `kpi-card.tsx`, `chart-grid.tsx`, `chart-panel.tsx`, `data-grid.tsx`) have been deleted from the codebase. | Previously in `components/dashboard/` and `components/grid/` |
| 6 | **Two `DashboardConfig` types** | Confusing — which one to use? | `models/dashboard.py` vs `models/dashboard_config.py` |
| 7 | **Reports page is all mock data** | No functional buttons, no backend support | `routes/_app/reports/index.tsx` |
| 8 | **Silent exception swallowing in backend** | `try/except Exception: pass` everywhere — debugging nightmare | Most API route handlers |

### Medium (Incomplete Features)

| # | Issue | Impact | Where |
|---|-------|--------|-------|
| 9 | **Settings density/font size not wired** | UI controls exist but do nothing | `routes/_app/settings/index.tsx` |
| 10 | **Saved views "Load" button non-functional** | Can save views but can't load them | Settings saved views tab |
| 11 | **In-memory state resets on restart** | Saved views, query history, mock DB store all lost | Various backend route handlers |
| 12 | **Startup crashes without Superset** | Despite mock mode claim, `authenticate()` is called unconditionally | `backend/app/main.py` lifespan |
| 13 | **No authentication/authorization** | All endpoints publicly accessible | Entire backend |

### Low (Cleanup / Consistency)

| # | Issue | Where |
|---|-------|-------|
| 14 | `next-themes` in package.json but unused (custom ThemeProvider used) | `frontend/package.json` |
| 15 | `redis_url`/`recon_db_url` declared in config but never used | `backend/app/config.py` |
| 16 | `search.tsx` exists but unused (CommandPalette used instead) | `components/layout/search.tsx` |
| 17 | `use-prefetch.ts` references hardcoded legacy chart IDs | `hooks/use-prefetch.ts` |
| 18 | AG Charts registers `AllCommunityModule` not `AllEnterpriseModule` | `frontend/src/main.tsx` |
| 19 | 9 hardcoded hex colors in chart palette | `lib/chart-themes.ts` |
| 20 | AG Grid theme inconsistency (CSS class vs programmatic) | Legacy vs config-driven grid components |
| 21 | `databases.json` has absolute local path for SQLite URI | `backend/app/config/databases.json` |
| 22 | Duplicate `DashboardConfig` model names | Backend models |

---

## 8. File Reference Index

### Frontend — Active (Config-Driven System)

```
frontend/src/
├── main.tsx                                    # AG Charts registration + StrictMode + App render
├── App.tsx                                     # TanStack Router provider
├── index.css                                   # CSS variables, themes, micro-interactions
├── routeTree.gen.ts                            # Auto-generated route tree (DO NOT EDIT)
│
├── routes/
│   ├── __root.tsx                              # Root: ThemeProvider + QueryClient + Toaster
│   ├── index.tsx                               # Redirect / → /dashboards
│   ├── _app.tsx                                # Layout: Sidebar + Header + AnimatedOutlet
│   ├── _app/
│   │   ├── dashboards/
│   │   │   ├── index.tsx                       # Dashboard list page
│   │   │   └── $dashboardId.tsx                # Config-driven dashboard page
│   │   ├── explorer/index.tsx                  # SQL IDE page
│   │   ├── reports/index.tsx                   # Reports page (MOCK)
│   │   └── settings/index.tsx                  # Settings page (3 tabs)
│   └── embed/dashboards/$dashboardId.tsx       # Embeddable dashboard (chromeless)
│
├── components/
│   ├── ui/                                     # Shadcn components (33 files) — DO NOT MODIFY
│   ├── layout/
│   │   ├── app-sidebar.tsx                     # Main sidebar
│   │   ├── header.tsx                          # Top header bar
│   │   ├── nav-main.tsx                        # Sidebar nav groups
│   │   ├── nav-user.tsx                        # Sidebar user avatar
│   │   ├── command-palette.tsx                 # Cmd+K search dialog
│   │   ├── theme-provider.tsx                  # Theme context provider
│   │   ├── theme-switch.tsx                    # Light/dark toggle
│   │   └── search.tsx                          # UNUSED simple search
│   ├── dashboard/
│   │   ├── dashboard-renderer.tsx              # Config orchestrator (THE MAIN COMPONENT)
│   │   ├── config-filter-bar.tsx               # Dynamic filters from config
│   │   ├── config-kpi-row.tsx                  # KPI cards from config
│   │   ├── config-chart-grid.tsx               # Charts from config
│   │   ├── config-data-grid.tsx                # AG Grid tables from config
│   │   ├── auto-refresh-control.tsx            # Auto-refresh toggle with interval control
│   │   ├── chart-fullscreen-dialog.tsx          # Fullscreen chart dialog
│   │   ├── chart-toolbar.tsx                    # Per-chart toolbar (export, fullscreen, refresh)
│   │   ├── cross-filter-bar.tsx                 # Cross-filter badges with remove buttons
│   │   ├── dashboard-toolbar.tsx                # Dashboard-level toolbar (auto-refresh, export)
│   │   ├── drill-breadcrumb.tsx                 # Drill navigation breadcrumbs
│   │   ├── drill-detail-grid.tsx                # Detail-level drill-down AG Grid
│   │   └── grid-toolbar.tsx                     # Grid toolbar with export, column toggle, quick filter
│   ├── charts/
│   │   ├── chart-factory.tsx                   # Routes vizType → AG or ECharts
│   │   ├── ag-chart-wrapper.tsx                # AG Charts rendering
│   │   └── echart-wrapper.tsx                  # ECharts rendering
│   ├── explorer/
│   │   ├── sql-editor.tsx                      # Monaco SQL editor
│   │   ├── schema-browser.tsx                  # Database/table/column tree
│   │   ├── query-results.tsx                   # AG Grid results + status
│   │   ├── query-history.tsx                   # Timeline of past queries
│   │   └── chart-builder-dialog.tsx            # Quick viz from query results
│   ├── grid/
│   │   └── cell-renderers/
│   │       ├── status-cell.tsx                 # Reusable status badge
│   │       ├── amount-cell.tsx                 # Reusable currency format
│   │       └── sla-cell.tsx                    # Reusable SLA indicator
│   ├── settings/
│   │   ├── data-sources-tab.tsx                # Database list view
│   │   ├── data-source-sheet.tsx               # Database CRUD side panel
│   │   ├── data-source-card.tsx                # Card view of DB connection
│   │   ├── data-source-row.tsx                 # Row view of DB connection
│   │   └── data-sources-toolbar.tsx            # Search + view toggle
│   ├── embed/
│   │   └── embed-topbar.tsx                    # Thin bar for embedded dashboards
│   └── shared/
│       ├── count-animation.tsx                 # Animated number counter
│       ├── error-boundary.tsx                  # Error boundary with reset
│       └── page-transition.tsx                 # motion/react page animations
│
├── hooks/
│   ├── use-dashboard-config.ts                 # GET dashboard config
│   ├── use-dashboards.ts                       # GET dashboard list
│   ├── use-dashboard-kpis.ts                   # POST KPI queries
│   ├── use-data-source-query.ts                # POST data source query
│   ├── use-data-source-merge.ts                # POST multi-source merge
│   ├── use-filter-options.ts                   # GET distinct values for filters
│   ├── use-chart-data.ts                       # LEGACY chart data
│   ├── use-kpi-data.ts                         # LEGACY KPI data
│   ├── use-breaks-data.ts                      # LEGACY breaks data
│   ├── use-cross-filter.ts                     # Cross-filter helpers
│   ├── use-drill-down.ts                       # Drill-down logic
│   ├── use-sql-execute.ts                      # SQL execution mutation
│   ├── use-sql-history.ts                      # Query history
│   ├── use-datasets.ts                         # Dataset list
│   ├── use-dataset.ts                          # Single dataset
│   ├── use-databases.ts                        # Full database CRUD hooks
│   ├── use-search.ts                           # Search mutation
│   ├── use-saved-views.ts                      # Saved views CRUD
│   ├── use-prefetch.ts                         # LEGACY prefetch
│   └── use-mobile.ts                           # Responsive breakpoint
│
├── stores/
│   ├── filter-store.ts                         # Filter values + applied + locked + crossFilters
│   └── drill-store.ts                          # Drill levels + source chart
│
├── lib/
│   ├── api-client.ts                           # Fetch-based HTTP client (snake→camel transform)
│   ├── query-client.ts                         # TanStack Query config
│   ├── chart-themes.ts                         # AG Charts + ECharts theme builders
│   ├── cross-filter.ts                         # Client-side cross-filter logic
│   └── utils.ts                                # cn() Tailwind class merger
│
└── types/
    ├── dashboard-config.ts                     # DashboardConfig, FilterConfig, KpiConfig, etc.
    ├── filter.ts                               # FilterValue, CrossFilter, AppliedFilters
    ├── chart.ts                                # ChartWrapperProps, VizType
    ├── api.ts                                  # ApiError, KpiResult, SqlResult
    ├── dashboard.ts                            # Legacy Dashboard type
    ├── dataset.ts                              # Dataset, DatasetColumn
    ├── database.ts                             # DatabaseInfo, DatabaseCreate
    ├── views.ts                                # SavedView types
    └── index.ts                                # Type re-exports
```

### Backend

```
backend/
├── app/
│   ├── main.py                                 # FastAPI app, lifespan, middleware
│   ├── config.py                               # pydantic-settings (Superset URL, credentials)
│   ├── __init__.py
│   │
│   ├── core/
│   │   ├── dependencies.py                     # DI: SupersetDep, ConfigStoreDep, QueryEngineDep
│   │   └── __init__.py
│   │
│   ├── api/
│   │   ├── router.py                           # Aggregated API router
│   │   ├── dashboards.py                       # Config-driven: list, get, KPIs
│   │   ├── data_sources.py                     # Config-driven: query, merge, distinct
│   │   ├── charts.py                           # Legacy: chart data with Superset datasource IDs
│   │   ├── custom.py                           # Legacy: KPI aggregations, counterparties
│   │   ├── datasets.py                         # Legacy: dataset list + paginated data
│   │   ├── databases.py                        # Database CRUD (proxies to Superset)
│   │   ├── sql.py                              # SQL execution (Superset only) + history
│   │   ├── search.py                           # Substring search
│   │   ├── export.py                           # STUBBED: PDF/Excel export
│   │   ├── views.py                            # Saved views (in-memory)
│   │   └── __init__.py
│   │
│   ├── services/
│   │   ├── superset_client.py                  # Async Superset API wrapper (auth, CSRF, retry)
│   │   ├── query_engine.py                     # SQL template engine (routing, building, execution)
│   │   ├── merge_engine.py                     # Multi-source hash join
│   │   ├── config_store.py                     # JSON config file loader
│   │   ├── database_registrar.py               # Superset database lifecycle management
│   │   ├── uri_builder.py                      # SQLAlchemy URI construction
│   │   └── __init__.py
│   │
│   ├── models/
│   │   ├── base.py                             # CamelModel (snake→camel auto-alias)
│   │   ├── dashboard_config.py                 # Config-driven dashboard model (THE MAIN ONE)
│   │   ├── data_source_config.py               # Data source config model
│   │   ├── database_config.py                  # Database registry entry model
│   │   ├── filters.py                          # GlobalFilters, DrillLevel, KpiRequest/Response
│   │   ├── chart_data.py                       # Legacy chart response models
│   │   ├── dashboard.py                        # Legacy dashboard model (DIFFERENT from dashboard_config.py)
│   │   ├── dataset.py                          # Dataset models
│   │   ├── database.py                         # Database CRUD models
│   │   ├── export.py                           # Export models (stubbed)
│   │   ├── views.py                            # Saved view models
│   │   └── __init__.py
│   │
│   ├── config/
│   │   ├── databases.json                      # Database registry (4 entries → SQLite in dev)
│   │   ├── dashboards/
│   │   │   └── tlm-stats.json                  # TLM Statistics Dashboard definition
│   │   ├── data_sources/
│   │   │   ├── tlm_breaks.json                 # TLM breaks (dynamic routing, complex SQL)
│   │   │   ├── tlm_automatch.json              # TLM automatch (dynamic routing)
│   │   │   ├── reconmgmt_recon_bank.json       # Filter dimension table (static routing)
│   │   │   └── reconmgmt_manual.json           # Manual match stats (static routing)
│   │   └── seed/
│   │       ├── seed.db                         # SQLite seed database
│   │       └── .gitkeep
│   │
│   └── mock_data.py                            # Hardcoded mock data for all entities
│
├── tests/
│   ├── test_query_engine.py                    # 10 tests
│   ├── test_merge_engine.py                    # 3 tests
│   ├── test_database_registrar.py              # 8 tests
│   ├── test_config_store.py                    # 6 tests
│   └── __init__.py
│
├── .env                                        # Environment variables
└── .venv/                                      # Python virtual environment
```

### Infrastructure & Scripts

```
03-RecViz/recviz/
├── docker-compose.yml                          # PostgreSQL + Redis + Superset
├── docker/
│   └── init-db.sql                             # Creates recon_data database
├── superset/
│   ├── Dockerfile                              # Superset container (Python 3.12-slim)
│   ├── superset-entrypoint.sh                  # Init script (db upgrade, create admin, init)
│   ├── superset_config.py                      # Docker mode config (Postgres + Redis + Celery)
│   └── superset_config_local.py                # Local dev config (SQLite + SimpleCache)
├── seed/
│   ├── create_recon_db.py                      # PostgreSQL seed (1M transactions, 150K breaks)
│   └── register_superset.py                    # Register DB + datasets + charts in Superset
├── scripts/
│   └── generate-seed-db.py                     # SQLite seed generator for config-driven system
├── requirements.txt                            # Python dependencies
├── SETUP.md                                    # Getting started guide
└── CODEBASE_GUIDE.md                           # THIS FILE
```
