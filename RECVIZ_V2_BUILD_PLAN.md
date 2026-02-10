# RecViz v2 — 6-Hour Build Plan (20 Phases)

**Goal:** Fully working prototype — real Superset integration, dashboards with cross-filtering and drill-down, SQL explorer, reports, settings, command palette, animations, skeleton loading. Leadership demo-ready.

**Timer:** 6:00:00
**Rule:** Never move to Phase N+1 until Phase N is verified working.

---

## Pre-Flight (before timer starts)

- [ ] Node.js 20+ (`node -v`)
- [ ] Python 3.12+ (`python3 --version`)
- [ ] pnpm (`pnpm -v`) — install if missing: `npm i -g pnpm`
- [ ] Homebrew (`brew -v`)
- [ ] **Docker Desktop installed** — download from docker.com/products/docker-desktop, install, start engine, verify `docker -v` and `docker compose version`
- [ ] AG Grid / AG Charts license keys ready (or accept trial watermark)
- [ ] Terminal with 3-4 split panes ready (frontend, backend, superset, general)
- [ ] Browser open with DevTools

## Reference Kit

The `_references/shadcn-ui-kit-dashboard/` folder contains a production-quality Shadcn dashboard. We adapt these patterns and components directly:

| Component | Source | Use In RecViz |
|-----------|--------|---------------|
| `count-animation.tsx` | `components/ui/custom/` | KPI animated counters |
| `empty.tsx` | `components/ui/` | Empty states (no data, no results) |
| `spinner.tsx` | `components/ui/` | Loading indicators |
| `kbd.tsx` | `components/ui/` | Keyboard shortcut badges (Cmd+K) |
| `timeline.tsx` | `components/ui/` | Query history in Data Explorer |
| `resizable.tsx` | `components/ui/` | Split panels in Data Explorer |
| `app-sidebar.tsx` | `components/layout/sidebar/` | Sidebar structure + collapsible icon mode |
| `nav-main.tsx` | `components/layout/sidebar/` | Nav groups with collapsible sub-items |
| `nav-user.tsx` | `components/layout/sidebar/` | User menu in sidebar footer |
| `search.tsx` | `components/layout/header/` | Cmd+K command palette pattern |
| `theme-switch.tsx` | `components/layout/header/` | Dark/light toggle |

**Adapt, don't copy blindly** — reference uses Next.js (`usePathname`, `Link`). We use TanStack Router (`useLocation`, `Link`). Replace framework-specific code during adaptation.

---

## Phase 1 — Frontend Scaffold (10 min) ⏱ 0:00 → 0:10

**Delivers:** React 19 + Vite 6 + TypeScript 5 strict + Tailwind CSS 4 + path aliases. The empty canvas.

**Actions:**
- `pnpm create vite frontend --template react-ts`
- Install Tailwind 4: `pnpm add -D tailwindcss @tailwindcss/vite`
- Configure Vite plugin for Tailwind + path aliases (`@/` → `src/`)
- Set up `tsconfig.json` with strict mode + path aliases
- Set up `src/index.css` with `@import "tailwindcss"`
- Create folder skeleton:
  ```
  src/
  ├── components/ (ui/, layout/, dashboard/, charts/, grid/, explorer/, shared/)
  ├── pages/
  ├── hooks/
  ├── stores/
  ├── lib/
  └── types/
  ```

**Verify:** `pnpm dev` → blank page at localhost:5173, zero console errors.

---

## Phase 2 — Shadcn/ui + All Frontend Dependencies (10 min) ⏱ 0:10 → 0:20

**Delivers:** Complete UI component library + all npm packages installed.

**Actions:**
- `pnpm dlx shadcn@latest init` (New York style, zinc, CSS variables)
- Batch install all Shadcn components we'll need:
  ```
  button card sidebar input select command dialog skeleton toast
  separator tabs popover dropdown-menu sheet tooltip badge
  scroll-area breadcrumb calendar avatar sonner toggle-group
  collapsible checkbox label textarea switch
  ```
- Install all other frontend deps in one shot:
  ```
  pnpm add @tanstack/react-router @tanstack/router-plugin
  pnpm add @tanstack/react-query @tanstack/react-query-devtools
  pnpm add zustand
  pnpm add ag-charts-react ag-charts-enterprise
  pnpm add ag-grid-react ag-grid-enterprise
  pnpm add echarts echarts-for-react
  pnpm add @monaco-editor/react
  pnpm add motion                    # NOT framer-motion — use motion/react imports
  pnpm add lucide-react
  pnpm add date-fns
  pnpm add react-resizable-panels    # For Data Explorer split layout
  ```
- Copy custom components from `_references/shadcn-ui-kit-dashboard/components/ui/`:
  - `empty.tsx` → `src/components/ui/empty.tsx` (adapt imports)
  - `spinner.tsx` → `src/components/ui/spinner.tsx`
  - `kbd.tsx` → `src/components/ui/kbd.tsx`
  - `timeline.tsx` → `src/components/ui/timeline.tsx` (adapt: remove "use client")
  - `resizable.tsx` → `src/components/ui/resizable.tsx`
- Copy `count-animation.tsx` from `_references/.../components/ui/custom/` → `src/components/shared/count-animation.tsx` (adapt imports)
- Verify `cn()` utility exists in `lib/utils.ts`
- Set up Inter/Geist font in `index.html`

**Verify:** Import `<Button>` in app.tsx, render it, see styled button. No dependency errors. All copied components import cleanly.

---

## Phase 3 — Infrastructure: Docker (Redis + PostgreSQL) + Superset pip install (20 min) ⏱ 0:20 → 0:40

**Delivers:** Redis and PostgreSQL running in Docker. Superset installed via pip and running natively. All services connected.

**Architecture:**
- **Docker Compose** → Redis (cache/Celery) + PostgreSQL (Superset metadata + recon data)
- **Native (pip install)** → Superset, FastAPI, React (for hot reload and easy debugging)

**Actions:**
- Create `docker-compose.yml` with 2 services:
  - **postgres** (v16-alpine): two databases `superset_meta` + `recon_data`, port 5432, volume for persistence
  - **redis** (v7-alpine): port 6379, for Superset cache + Celery broker
- `docker compose up -d` → both services running
- Create Python venv: `python3 -m venv .venv && source .venv/bin/activate`
- `pip install apache-superset`
- Create `superset/superset_config.py`:
  ```python
  import os
  SECRET_KEY = os.environ.get("SECRET_KEY", "recviz-dev-secret-key")

  # PostgreSQL in Docker for metadata (swap to Oracle in prod — just change this URI)
  SQLALCHEMY_DATABASE_URI = "postgresql://recviz:recviz_dev@localhost:5432/superset_meta"

  CACHE_CONFIG = {
      "CACHE_TYPE": "redis",
      "CACHE_DEFAULT_TIMEOUT": 300,
      "CACHE_KEY_PREFIX": "recviz_",
      "CACHE_REDIS_URL": "redis://localhost:6379/0",
  }
  DATA_CACHE_CONFIG = {
      "CACHE_TYPE": "redis",
      "CACHE_DEFAULT_TIMEOUT": 600,
      "CACHE_KEY_PREFIX": "recviz_data_",
      "CACHE_REDIS_URL": "redis://localhost:6379/1",
  }
  FEATURE_FLAGS = {"ENABLE_TEMPLATE_PROCESSING": True}
  ENABLE_CORS = True
  CORS_OPTIONS = {
      "supports_credentials": True,
      "allow_headers": ["*"],
      "resources": ["/api/*"],
      "origins": ["http://localhost:5173", "http://localhost:8000"],
  }
  class CeleryConfig:
      broker_url = "redis://localhost:6379/2"
      result_backend = "redis://localhost:6379/3"
  CELERY_CONFIG = CeleryConfig
  ```
- Set env: `export SUPERSET_CONFIG_PATH=$(pwd)/superset/superset_config.py`
- Init Superset:
  ```bash
  superset db upgrade
  superset fab create-admin --username admin --firstname Admin --lastname User --email admin@recviz.local --password admin
  superset init
  ```
- Start Superset: `superset run -h 0.0.0.0 -p 8088 --with-threads`

**Verify:**
```bash
docker compose ps                  # postgres + redis both Up
curl -X POST http://localhost:8088/api/v1/security/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin","provider":"db"}'
# Returns {"access_token": "..."}
```

**Files:**
```
02-RecViz/recviz/
├── docker-compose.yml             # Redis + PostgreSQL only
└── superset/
    ├── superset_config.py
    └── requirements-superset.txt
```

**Fallback:** If Docker issues > 10 min, use SQLite for Superset metadata + in-memory cache (no Redis). Superset supports this out of the box.

---

## Phase 4 — Seed Recon Data + Superset Registration (15 min) ⏱ 0:40 → 0:55

**Delivers:** Realistic reconciliation dataset in SQLite, registered in Superset with datasets and pre-configured chart definitions.

**Actions:**
- Seed data into `recon_data` PostgreSQL database (running in Docker) with tables:
  - **`break_records`** (500+ rows):
    id, trade_date, settlement_date, counterparty, desk, break_type, amount, currency, status, aging_days, aging_bucket, sla_breach, created_at, resolved_at, notes
    - Desks: Operations, Treasury, Settlements, FX, Equity
    - Break types: Cash, Position, Settlement, Nostro, Fee, Margin, Collateral
    - Statuses: Open, Resolved, Investigating, Escalated
    - Aging buckets: 0-1d, 2-3d, 4-7d, 8-14d, 15-30d, 30d+
    - Dates spanning last 6 months, realistic amounts ($1K-$5M)
    - ~60% Resolved, ~25% Open, ~10% Investigating, ~5% Escalated
  - **`daily_summary`** (180 rows — 6 months of daily data):
    date, desk, break_type, total_count, resolved_count, open_count, total_amount, avg_aging
  - **`counterparties`** (50 rows):
    id, name, region, risk_rating
- Create `seed/register_superset.py` — Python script that:
  1. Authenticates to Superset API
  2. Registers `recon_data` PostgreSQL database as a Superset database connection
  3. Creates datasets: break_records, daily_summary
  4. Creates Superset chart definitions:
     - "Break Trend" (time series, trade_date vs count)
     - "Breaks by Type" (bar, break_type vs count)
     - "Breaks by Desk" (pie, desk vs count)
     - "Aging Distribution" (bar, aging_bucket vs count, grouped by status)
  5. Creates dashboard definition: "Recon Overview" with all 4 charts
- Run the seed script

**Verify:**
```bash
python seed/register_superset.py
# Then:
curl -H "Authorization: Bearer $TOKEN" http://localhost:8088/api/v1/dataset/
# Returns the registered datasets
```

**Files:**
```
02-RecViz/recviz/seed/
├── create_recon_db.py     # Seeds PostgreSQL recon_data DB with realistic data
└── register_superset.py   # Registers DB + datasets + charts in Superset
```

---

## Phase 5 — FastAPI Backend + Superset Client (15 min) ⏱ 0:55 → 1:10

**Delivers:** Backend running, authenticated to Superset, health check passing.

**Actions:**
- Create backend project:
  ```
  pip install fastapi uvicorn httpx pydantic pydantic-settings python-dotenv
  ```
- Create `app/main.py`:
  - FastAPI app with CORS middleware (allow localhost:5173)
  - Lifespan: creates shared `httpx.AsyncClient`, stores on `app.state`
  - Health endpoint: `GET /health`
- Create `app/config.py`:
  - `Settings(BaseSettings)`: SUPERSET_URL, SUPERSET_USERNAME, SUPERSET_PASSWORD, REDIS_URL
  - Reads from `.env`
- Create `app/services/superset_client.py`:
  - `SupersetClient` class with async methods:
    - `authenticate()` → POST /api/v1/security/login, store JWT
    - `ensure_authenticated()` → check token, refresh if expired
    - `get_chart_data(chart_id, filters)` → POST /api/v1/chart/data
    - `list_charts()` → GET /api/v1/chart/
    - `list_datasets()` → GET /api/v1/dataset/
    - `get_dataset(id)` → GET /api/v1/dataset/{id}
    - `execute_sql(database_id, sql, limit)` → POST /api/v1/sqllab/execute/
    - `list_dashboards()` → GET /api/v1/dashboard/
    - `get_dashboard(id)` → GET /api/v1/dashboard/{id}
    - `list_databases()` → GET /api/v1/database/
  - Auto-retry on 401 (re-authenticate)
- Create `app/core/dependencies.py`:
  - `get_superset_client()` → returns `SupersetClient | None` (None if Superset unavailable)
- Create `app/models/base.py`:
  - `CamelModel(BaseModel)` with `alias_generator=to_camel, populate_by_name=True`

**Verify:**
```bash
uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/health  # Returns OK
curl http://localhost:8000/api/test-superset  # Returns Superset connection status
```

---

## Phase 6 — All Backend API Endpoints (20 min) ⏱ 1:10 → 1:30

**Delivers:** Complete API surface — every endpoint the frontend will call, with Superset proxy + mock fallback.

**Actions:**
- Create Pydantic models (all extending CamelModel):
  - `models/filters.py` — GlobalFilters, CrossFilterRule, DrillLevel
  - `models/chart_data.py` — ChartConfig, ChartDataResponse, KpiData
  - `models/dashboard.py` — DashboardConfig, DashboardLayoutItem
  - `models/dataset.py` — DatasetInfo, ColumnInfo, SchemaTree
  - `models/export.py` — ExportRequest, ExportStatus
  - `models/views.py` — SavedView
- Create `app/mock_data.py` — Rich mock data matching seed data shapes (fallback when Superset is down)
- Create route modules:
  - **`api/dashboards.py`**:
    - `GET /api/dashboards` — list dashboards (with chart configs, filter configs, cross-filter rules)
    - `GET /api/dashboards/{id}` — full dashboard config including layout + chart definitions
  - **`api/charts.py`**:
    - `GET /api/charts` — list available charts
    - `POST /api/charts/{id}/data` — fetch chart data with filters (proxy to Superset chart/data)
    - `GET /api/charts/{id}` — chart definition/config
  - **`api/datasets.py`**:
    - `GET /api/datasets` — list datasets
    - `GET /api/datasets/{id}` — dataset details + column info (for schema browser)
    - `POST /api/datasets/{id}/data` — paginated data with filters + sorting
  - **`api/sql.py`**:
    - `POST /api/sql/execute` — execute ad-hoc SQL via Superset SQL Lab
    - `GET /api/sql/history` — query history (stored in memory/file for now)
    - `GET /api/sql/databases` — list available database connections
  - **`api/search.py`**:
    - `POST /api/search` — full-text search across dashboards, datasets, charts
  - **`api/custom.py`**:
    - `POST /api/custom/aggregations` — sidecar custom aggregations
    - `POST /api/custom/kpi` — KPI summary calculations (Total Breaks, Resolution %, Avg Age, SLA Breaches)
  - **`api/export.py`**:
    - `POST /api/export/pdf` — PDF generation (stub: returns job ID)
    - `POST /api/export/excel` — Excel generation (stub: returns job ID)
    - `GET /api/export/{job_id}/status` — check export job status
  - **`api/views.py`**:
    - `GET /api/views` — list saved views/bookmarks
    - `POST /api/views` — save current filter state + layout
    - `DELETE /api/views/{id}` — delete saved view
  - **`api/router.py`** — Aggregate all routers under `/api`
- Every endpoint: `if superset: try proxy → except: mock` pattern

**Verify:**
```bash
curl http://localhost:8000/api/dashboards
curl -X POST http://localhost:8000/api/charts/break-trend/data
curl http://localhost:8000/api/datasets
curl http://localhost:8000/api/sql/databases
curl http://localhost:8000/api/custom/kpi
curl http://localhost:8000/api/views
```
All return well-shaped JSON.

---

## Phase 7 — Frontend: Types + API Client + TanStack Query (15 min) ⏱ 1:30 → 1:45

**Delivers:** Type system as the contract. API client. All data-fetching hooks. This is the glue between frontend and backend.

**Actions:**
- Create TypeScript types (these define the contract — backend MUST match):
  - `types/dashboard.ts` — DashboardConfig, DashboardLayoutItem
  - `types/chart.ts` — ChartConfig, ChartType, ChartDataResponse, ChartClickEvent, ChartWrapperProps
  - `types/filter.ts` — GlobalFilters, CrossFilter, CrossFilterRule, DrillState, DrillLevel
  - `types/dataset.ts` — DatasetInfo, ColumnInfo, SchemaTree
  - `types/api.ts` — ApiResponse, PaginatedResponse, KpiData
  - `types/views.ts` — SavedView
- Create `lib/api-client.ts`:
  - `fetch`-based, generic `get<T>()` / `post<T>()` / `delete<T>()`
  - Base URL from `VITE_API_BASE_URL`
  - Envelope extraction: `{ dashboards: [...] }` → `[...]`
  - Throws on non-2xx, error includes status + body
- Create `lib/query-client.ts`:
  - QueryClient: staleTime 5min, gcTime 30min
- Wrap App in `<QueryClientProvider>` + `<ReactQueryDevtools>`
- Create ALL hooks:
  - `hooks/use-dashboards.ts` — `useQuery(['dashboards'])`
  - `hooks/use-dashboard.ts` — `useQuery(['dashboard', id])`
  - `hooks/use-chart-data.ts` — `useQuery(['chart-data', chartId, globalFilters])`
  - `hooks/use-kpi-data.ts` — `useQuery(['kpi', globalFilters])`
  - `hooks/use-datasets.ts` — `useQuery(['datasets'])`
  - `hooks/use-dataset.ts` — `useQuery(['dataset', id])`
  - `hooks/use-sql-execute.ts` — `useMutation`
  - `hooks/use-sql-history.ts` — `useQuery(['sql-history'])`
  - `hooks/use-search.ts` — `useMutation` for search
  - `hooks/use-saved-views.ts` — `useQuery` + `useMutation`
  - `hooks/use-cross-filter.ts` — reads crossFilters from Zustand, returns filtered data via useMemo
  - `hooks/use-drill-down.ts` — manages drill state, fires backend call for detail level
  - `hooks/use-prefetch.ts` — prefetches filter combos in background

**Verify:** React Query Devtools shows up. Import a hook in a test component — no TS errors.

---

## Phase 8 — TanStack Router + All Page Shells (10 min) ⏱ 1:45 → 1:55

**Delivers:** All routes wired. Clicking nav goes to correct page. File-based routing working.

**Actions:**
- Configure `@tanstack/router-plugin` in Vite config
- Create route files:
  ```
  src/routes/
  ├── __root.tsx            # Root layout wrapper
  ├── index.tsx              # Redirect → /dashboards
  ├── dashboards/
  │   ├── index.tsx          # Dashboard list
  │   └── $dashboardId.tsx   # Dashboard detail
  ├── explorer/
  │   └── index.tsx          # SQL explorer
  ├── reports/
  │   ├── index.tsx          # Report list
  │   └── $reportId.tsx      # Individual report
  └── settings/
      └── index.tsx          # User settings
  ```
- Each page: placeholder `<div className="p-6"><h1>Page Name</h1></div>`
- Root layout: just renders `<Outlet />` for now (shell comes next phase)

**Verify:** Navigate between /dashboards, /explorer, /reports, /settings — URL updates, page text changes, no 404s.

---

## Phase 9 — App Shell: Sidebar + Topbar + Theme (25 min) ⏱ 1:55 → 2:20

**Delivers:** The app LOOKS like a real product. Premium sidebar, sticky header, dark mode, mobile responsive sidebar.

**Adapts from `_references/shadcn-ui-kit-dashboard/`:**
- `app-sidebar.tsx` → sidebar structure, `collapsible="icon"` mode, header/footer layout
- `nav-main.tsx` → collapsible nav groups, active link highlighting, dropdown in icon mode
- `nav-user.tsx` → user avatar + dropdown menu in sidebar footer
- `search.tsx` → Cmd+K input in header that opens CommandDialog
- `theme-switch.tsx` → sun/moon toggle button

All adapted: `usePathname` → `useLocation`, `next/link` → TanStack Router `Link`, `useRouter().push` → `useNavigate()`, remove `"use client"` directives.

**Actions:**
- Create `components/layout/theme-provider.tsx`:
  - Context with `theme: 'light' | 'dark' | 'system'`
  - Sets `class` on `<html>` element
  - Persists to localStorage
  - System preference detection via `matchMedia`
- Create `stores/theme-store.ts`:
  - Zustand: theme mode + density (comfortable/compact)
- Create `components/layout/app-sidebar.tsx` (adapted from reference):
  - Shadcn Sidebar `variant="inset"`
  - Header: RecViz logo/brand + version badge (dropdown project switcher pattern from ref)
  - Nav groups via `nav-main.tsx` pattern: collapsible sub-items, dropdown in icon-collapsed mode
  - Nav items with icons (Lucide):
    - Dashboards (LayoutDashboard)
    - Data Explorer (Database)
    - Reports (FileBarChart)
    - Settings (Settings)
  - Active link highlighting based on current route (`useLocation().pathname`)
  - Footer: `nav-user.tsx` pattern — user avatar + name + role + dropdown menu
  - Collapsible with smooth spring animation
  - Auto-collapse on tablet (reference `useIsTablet` pattern)
- Create `components/layout/header.tsx` (adapted from reference):
  - Sticky `top-0` with `h-(--header-height)`
  - SidebarTrigger (hamburger icon)
  - Dynamic breadcrumbs from route (e.g., "Dashboards > Recon Overview")
  - Search input (reference `search.tsx` pattern): input field that opens CommandDialog on focus, shows `<Kbd>⌘K</Kbd>` badge
  - Theme toggle (reference `theme-switch.tsx` pattern: sun/moon icon button)
  - Notification bell (placeholder)
- Wire into `__root.tsx`:
  ```tsx
  <ThemeProvider>
    <QueryClientProvider>
      <SidebarProvider style={{
        '--sidebar-width': 'calc(var(--spacing) * 64)',
        '--header-height': 'calc(var(--spacing) * 14)',
      }}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <Header />
          <div className="flex flex-1 flex-col overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
      <ReactQueryDevtools />
    </QueryClientProvider>
  </ThemeProvider>
  ```
- **CRITICAL:** Layout wrapper is `flex flex-1 flex-col` only. NO padding. Pages own their padding.
- Mobile: sidebar auto-closes on route change

**Verify:** Visual in browser —
1. Sidebar renders with nav items, collapses/expands smoothly
2. Click nav items → route changes, active item highlights
3. Dark mode toggle works — entire app switches, no unstyled elements
4. Topbar breadcrumbs update with route
5. NO content clipping or double padding

---

## Phase 10 — Zustand Stores + Command Palette (15 min) ⏱ 2:20 → 2:35

**Delivers:** All client state management + Cmd+K global search.

**Actions:**
- Create `stores/filter-store.ts`:
  ```typescript
  interface FilterStore {
    globalFilters: {
      dateRange: { from: Date; to: Date }
      entities: string[]
      statuses: string[]
      desks: string[]
    }
    crossFilters: Record<string, { chartId: string; field: string; value: string | string[] }>
    setGlobalFilter: (key: string, value: unknown) => void
    setGlobalFilters: (filters: Partial<GlobalFilters>) => void
    applyFilters: () => void
    resetFilters: () => void
    setCrossFilter: (chartId: string, field: string, value: unknown) => void
    clearCrossFilter: (chartId: string) => void
    clearAllCrossFilters: () => void
  }
  ```
- Create `stores/drill-store.ts`:
  ```typescript
  interface DrillStore {
    drillState: Record<string, {
      currentLevel: number
      levels: DrillLevel[]
    }>
    drillDown: (chartId: string, label: string, filters: Record<string, unknown>, granularity: string) => void
    drillUp: (chartId: string) => void
    drillToLevel: (chartId: string, level: number) => void
    resetDrill: (chartId: string) => void
  }
  ```
- Create `stores/sidebar-store.ts` (if not using Shadcn's built-in state)
- Create `components/layout/command-palette.tsx`:
  - Shadcn Command component
  - Triggered by Cmd+K (keyboard listener)
  - Search groups: Dashboards, Datasets, Pages, Actions
  - Fetches search results from `POST /api/search` as user types (debounced)
  - Arrow key navigation, Enter to select → navigate
  - Recent searches section

**Verify:**
1. Cmd+K opens palette, Esc closes
2. Type "recon" → see dashboard result → Enter → navigates
3. Set a filter in devtools → store updates

---

## Phase 11 — Dashboard List Page (12 min) ⏱ 2:35 → 2:47

**Delivers:** First data-driven page. Cards fetched from API, navigation to detail.

**Actions:**
- `pages/dashboards/index.tsx`:
  - Page header: "Dashboards" title + "Create Dashboard" button (placeholder)
  - `useDashboards()` hook fetches from backend
  - Grid of Shadcn Cards (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
  - Each card:
    - Title + description
    - Chart count badge
    - Last updated timestamp (date-fns `formatDistanceToNow`)
    - Colored status dot (active/draft)
    - Hover: subtle lift effect (shadow + translate)
    - Click → `navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: id } })`
  - Loading state: 6 skeleton cards (Shadcn Skeleton)
  - Empty state: illustration + "No dashboards configured" message + CTA
  - Page padding: `p-6`

**Verify:** Visual — cards render from API data. Click navigates. Skeleton shows on initial load.

---

## Phase 12 — Dashboard Detail: KPI Cards + Filter Bar (20 min) ⏱ 2:47 → 3:07

**Delivers:** Top section of dashboard — summary metrics and global filters.

**Actions:**
- Use `components/shared/count-animation.tsx` (adapted from reference `count-animation.tsx`):
  - Uses `motion/react` — `useMotionValue` + `useTransform` + `animate`
  - Animates number from 0 → target over ~1s
  - Extend to support: currency formatting, percentage suffix, decimal places
  - Re-triggers animation when `number` prop changes
- Create `components/dashboard/kpi-card.tsx`:
  - Shadcn Card: icon + title (muted) + large number (animated) + trend badge
  - Trend: green ▲ / red ▼ + percentage + "vs last period" caption
  - Skeleton variant (for loading)
  - Compact variant (for density toggle)
- Create `components/dashboard/kpi-row.tsx`:
  - 4 KPI cards in a responsive row (`grid-cols-2 lg:grid-cols-4`)
  - Fetches from `useKpiData(globalFilters)` or derives from chart data
  - Cards: Total Breaks, Resolution Rate (%), Avg Aging (days), SLA Breaches
- Create `components/dashboard/filter-bar.tsx`:
  - Horizontal bar at top of dashboard (Shadcn Card, muted background)
  - Date range picker: Shadcn Calendar inside Popover, "from" and "to"
  - Entity selector: Shadcn Combobox with search (fetched from API)
  - Status multi-select: checkboxes for Open/Resolved/Investigating/Escalated
  - Desk selector: Shadcn Select (Operations/Treasury/Settlements/FX/Equity)
  - Apply button (primary) + Reset button (outline)
  - Active filter chips below the bar (dismissible)
  - On Apply: `filterStore.setGlobalFilters(...)` → all query keys invalidate → refetch
  - On Reset: `filterStore.resetFilters()` → refetch with empty filters
- Wire into `pages/dashboards/$dashboardId.tsx`:
  - `useDashboard(dashboardId)` for config
  - `<FilterBar />` → `<KpiRow />` → (charts will go below in next phases)

**Verify:**
1. Visual — 4 KPI cards with animated numbers and trends
2. Filter bar renders with all filter controls
3. Change a filter → Apply → KPIs update with new data
4. Reset → original data returns

---

## Phase 13 — Chart Wrappers + Chart Theme (18 min) ⏱ 3:07 → 3:25

**Delivers:** Reusable AG Charts and ECharts wrapper components that match the app theme.

**Actions:**
- Create `lib/chart-themes.ts`:
  - Function that reads Shadcn CSS variables from DOM and builds:
    - AG Charts theme object: colors, fonts, padding, axis styles
    - ECharts theme object: same color palette, fonts, grid settings
  - Light + dark variants (reads from current CSS variable values)
  - Palette: primary, secondary, muted, accent, destructive (from Shadcn vars)
- Create `components/charts/ag-chart-wrapper.tsx`:
  - Props: `ChartWrapperProps { data, config, crossFilter?, onNodeClick?, loading?, error? }`
  - Builds `AgChartOptions` from `config` object (type, series keys, etc.)
  - Applies theme from `chart-themes.ts`
  - Loading: shows Skeleton
  - Error: shows retry button
  - `onNodeClick` handler extracts field + value, fires callback for cross-filtering
  - Handles chart types: line, bar, area, pie, donut, scatter, histogram, waterfall, stacked bar, combo
  - Uses `as const` for discriminated union types (AG Charts v11+ requirement)
- Create `components/charts/echart-wrapper.tsx`:
  - Same `ChartWrapperProps` interface
  - Handles: sankey, radar, sunburst, gauge, funnel, graph, parallel
  - Same theme alignment
  - `onNodeClick` via ECharts event system
- Create `components/charts/chart-factory.tsx`:
  - Simple function: checks `config.library` → returns `<AgChartWrapper>` or `<EChartWrapper>`
  - No over-abstraction — just a switch
- Create `components/dashboard/chart-panel.tsx`:
  - Shadcn Card container for any chart
  - Header: title + subtitle
  - Toolbar: refresh button, fullscreen toggle, export menu (PNG/CSV/clipboard)
  - Body: chart wrapper component
  - Footer: "Last updated" timestamp + data source name
  - Skeleton variant for loading

**Verify:** Render a test bar chart and a test donut chart in a scratch page. Both themed correctly. Toggle dark mode → chart colors update.

---

## Phase 14 — Dashboard Detail: Chart Grid (22 min) ⏱ 3:25 → 3:47

**Delivers:** 4 live charts on the dashboard, fetching real data from Superset via FastAPI.

**Actions:**
- Create `components/dashboard/chart-grid.tsx`:
  - CSS Grid: `grid-cols-1 lg:grid-cols-2` with gap
  - Accepts dashboard config's chart list
  - Renders a `<ChartPanel>` for each chart
  - Each panel uses `useChartData(chartId, globalFilters)` to fetch
  - Responsive: 2x2 on desktop, stacked on small screens
- Backend `POST /api/charts/{id}/data` must:
  - Accept `globalFilters` in request body
  - Convert to Superset `extra_filters` format
  - Call Superset `POST /api/v1/chart/data` with query_context
  - Return data array + metadata
- Wire dashboard detail page:
  ```
  <FilterBar />
  <KpiRow />
  <ChartGrid charts={dashboard.charts} />
  (grid comes next phase)
  ```
- 4 charts rendering:
  1. **Break Trend** — AG Charts area chart
     - X: trade_date (time series), Y: break count
     - Stacked by status (Open/Resolved)
  2. **Breaks by Type** — AG Charts grouped bar
     - X: break_type, Y: count
     - Color per type
  3. **Breaks by Desk** — AG Charts donut
     - Category: desk, Angle: count
     - Labels with percentages
  4. **Aging Distribution** — AG Charts stacked bar
     - X: aging_bucket, Y: count
     - Stacked by status

**Verify:**
1. All 4 charts render with data from Superset (check Network tab — calls go to localhost:8000 → Superset)
2. Charts are themed correctly
3. Dark mode: charts update colors
4. Skeleton shows while loading

---

## Phase 15 — AG Grid Detail Table (18 min) ⏱ 3:47 → 4:05

**Delivers:** Enterprise data grid at the bottom of the dashboard with full features.

**Actions:**
- Create `components/grid/data-grid.tsx`:
  - AG Grid Enterprise with Quartz theme customized to Shadcn CSS vars:
    ```
    --ag-foreground-color, --ag-background-color, --ag-header-background-color,
    --ag-border-color, --ag-row-hover-color, --ag-selected-row-background-color,
    --ag-font-family: Inter/Geist, --ag-font-size: 13px
    ```
  - Column definitions for break_records:
    - ID (text), Trade Date (date formatted), Settlement Date, Counterparty,
      Desk, Break Type, Amount (currency formatted, right-aligned),
      Currency, Status (badge cell renderer), Aging Days (number),
      SLA Breach (icon: ✓/✗), Notes (tooltip on hover)
  - Features enabled: sorting, column filtering, pagination (50 rows/page),
    row selection, column resizing, column reordering
  - Quick filter search box
  - Row count in status bar
- Create `components/grid/grid-toolbar.tsx`:
  - Quick filter input
  - Row count display ("Showing 50 of 1,247")
  - Export CSV button
  - Column chooser toggle (show/hide columns)
  - Pivot mode toggle (future — enable if time)
  - Density toggle
- Create custom cell renderers:
  - `components/grid/cell-renderers/status-cell.tsx` — colored badge (green=Resolved, red=Escalated, yellow=Open, blue=Investigating)
  - `components/grid/cell-renderers/amount-cell.tsx` — currency formatted, red for negative
  - `components/grid/cell-renderers/sla-cell.tsx` — icon indicator
- Wire into dashboard detail below chart grid

**Verify:**
1. Grid renders 500+ rows from the dataset
2. Sort by Amount → works
3. Filter by Desk → works
4. Quick filter: type "treasury" → grid filters
5. Scrolling is smooth
6. Theme matches app (light + dark)

---

## Phase 16 — Cross-Filtering (18 min) ⏱ 4:05 → 4:23

**Delivers:** Click a chart element → all other charts + KPIs + grid filter instantly. Zero network calls.

**Actions:**
- Dashboard config includes `crossFilterRules`:
  ```typescript
  [
    { sourceChartId: 'breaks-by-desk', sourceField: 'desk', targetChartIds: ['*'], targetField: 'desk' },
    { sourceChartId: 'breaks-by-type', sourceField: 'break_type', targetChartIds: ['*'], targetField: 'break_type' },
    { sourceChartId: 'aging-distribution', sourceField: 'aging_bucket', targetChartIds: ['*'], targetField: 'aging_bucket' },
  ]
  ```
- Wire `onNodeClick` on each chart:
  - Fires `filterStore.setCrossFilter(chartId, field, value)`
- Each consuming component reads crossFilters:
  - Charts: `useMemo(() => data.filter(applyCrossFilters(crossFilters)), [data, crossFilters])`
  - AG Grid: `isExternalFilterPresent()` returns true when crossFilters exist, `doesExternalFilterPass(node)` checks node data against crossFilters
  - KPI cards: recalculate from filtered data
- Visual feedback:
  - Active cross-filter shown as dismissible chip/badge above chart grid
  - Source chart: selected segment highlighted (different opacity/stroke)
  - Click same segment again → clears that cross-filter (toggle behavior)
  - "Clear all filters" button appears when any cross-filter is active
- Performance: all filtering is client-side via `useMemo` / AG Grid filter API. No network calls.

**Verify:**
1. Click "Operations" slice in desk donut → all charts show only Operations data
2. KPI numbers recalculate (animated transition)
3. Grid shows only Operations rows
4. Filter chip appears: "Desk: Operations ✕"
5. Click chip ✕ → filter clears, all data returns
6. Click same slice → toggle off
7. Open Network tab → **zero requests during cross-filter interaction**
8. Total re-render time < 16ms (check React profiler)

---

## Phase 17 — Drill-Down + Breadcrumbs (18 min) ⏱ 4:23 → 4:41

**Delivers:** 4-level drill-down navigation with breadcrumb trail. Client-side for aggregated levels, backend call for detail level.

**Actions:**
- Create `components/dashboard/drill-breadcrumb.tsx`:
  - Shadcn Breadcrumb component
  - Shows: "All Data > [Month] > [Day] > [Category]"
  - Each segment is clickable → navigates back to that level
  - Current level is non-clickable, bold
  - Animated with `motion/react` (slide + fade new segments)
- Implement drill logic in `hooks/use-drill-down.ts`:
  - `drillDown(chartId, label, filters, granularity)`:
    - Level 0→1: "All" → click month → show daily data for that month
      - Client-side: re-aggregate cached data by day (useMemo)
      - Chart switches from monthly to daily granularity
    - Level 1→2: Click day → show breakdown by category
      - Client-side: filter cached data to that day, group by break_type/desk
    - Level 2→3: Click category → show individual break records
      - **Backend call**: `POST /api/charts/{id}/data` with drill filters
      - Chart grid hides, AG Grid shows full detail for that slice
    - Push level onto drill-store breadcrumb stack
  - `drillUp(chartId)`: pop last level, revert to previous view
  - `drillToLevel(chartId, level)`: jump to specific breadcrumb level
  - `resetDrill(chartId)`: back to level 0
- Wire into chart panels:
  - Double-click or dedicated "drill" click on chart data point → triggers drillDown
  - Breadcrumb component above chart grid (visible when drill level > 0)
  - Back button (← icon) next to breadcrumb for quick drill-up
- Backend changes:
  - `/api/charts/{id}/data` accepts optional `drill_filters` parameter
  - When drill_filters present, add them as extra WHERE clauses to Superset query
  - Return granularity-appropriate data

**Verify:**
1. Click on "January 2026" in Break Trend chart → breadcrumb shows "All > January 2026"
2. Chart updates to show daily data for January
3. Click on "Jan 15" → breadcrumb: "All > January 2026 > Jan 15" → shows category breakdown
4. Click on "Cash" → breadcrumb: "All > January 2026 > Jan 15 > Cash" → grid shows individual Cash break records (backend call fired)
5. Click "January 2026" in breadcrumb → jumps back to level 1
6. Click "All" → resets to overview

---

## Phase 18 — Data Explorer Page (28 min) ⏱ 4:41 → 5:09

**Delivers:** Full SQL workbench — editor, schema browser, query results, history, "Chart It" functionality.

**Actions:**
- Create `components/explorer/sql-editor.tsx`:
  - Monaco Editor configured for SQL
  - Theme: `vs-dark` in dark mode, light theme in light mode
  - Keyboard shortcuts: Cmd+Enter → run, Cmd+Shift+F → format
  - Auto-resize height (min 200px, max 50vh)
  - SQL syntax highlighting
  - Placeholder text: "-- Write your SQL query here\n-- Cmd+Enter to execute"
- Create `components/explorer/schema-browser.tsx`:
  - Collapsible tree view (Shadcn Collapsible + ScrollArea)
  - Hierarchy: Database → Table → Columns (with type badges)
  - Fetched from `GET /api/datasets` + `GET /api/datasets/{id}` for columns
  - Click table name → inserts into editor
  - Click column → inserts column name
  - Search/filter box at top
  - Icons: Database (server), Table (table2), Column (columns) from Lucide
- Create `components/explorer/query-results.tsx`:
  - AG Grid with dynamic columns (built from response column metadata)
  - Status bar: row count, query execution time, rows returned
  - "Chart It" button → opens chart builder dialog:
    - Select chart type (bar, line, pie, etc.)
    - Map columns to x-axis, y-axis, series
    - Preview chart
    - (Stretch: save chart to dashboard)
  - "Export CSV" button
  - "Copy" button (copy results to clipboard as TSV)
- Create `components/explorer/query-history.tsx`:
  - List below results or in a collapsible panel
  - Each entry: SQL preview (truncated), execution time, row count, timestamp
  - Click → loads SQL into editor
  - Stored in localStorage (array of query records)
  - Clear history button
- Wire `pages/explorer/index.tsx`:
  - Layout: **`ResizablePanelGroup`** (from reference `resizable.tsx` / `react-resizable-panels`)
    - Left panel: Schema browser (250px default, resizable, collapsible)
    - Right panel (vertical split):
      - Top: SQL editor
      - Bottom: Results grid + history tabs (use **`Timeline`** component from reference for history list)
  - Run button: calls `useSqlExecute()` mutation
  - Loading state: spinner on Run button, skeleton on results
  - Error state: red error banner with SQL error message

**Verify:**
1. Open /explorer → see schema browser with databases + tables
2. Click table → table name appears in editor
3. Type `SELECT * FROM break_records WHERE desk = 'Operations' LIMIT 20`
4. Cmd+Enter → results grid shows 20 rows with correct columns
5. See query in history panel
6. Click "Chart It" → select bar chart → see visualization of results

---

## Phase 19 — Reports + Settings + Saved Views (20 min) ⏱ 5:09 → 5:29

**Delivers:** Remaining pages — report listing, settings, saved views management.

**Actions:**
- Create `pages/reports/index.tsx`:
  - Page header: "Reports" + "Schedule Report" button
  - List of report cards:
    - Report name, type (PDF/Excel), schedule (daily/weekly/monthly), last generated
    - Status badge: Active, Paused, Failed
    - Actions: Download, Edit Schedule, Delete
  - Data from mock (export service is stubbed)
  - "Generate Now" button → calls `POST /api/export/pdf` → shows toast "Report queued"
  - Empty state with illustration when no reports
- Create `pages/reports/$reportId.tsx`:
  - Report detail view: parameters, history of generations, preview
  - Download button → (stub: shows toast)
- Create `pages/settings/index.tsx`:
  - Sections (using Shadcn Tabs):
    - **Appearance**: Theme toggle (light/dark/system), density (comfortable/compact), font size
    - **Defaults**: Default filter values, default dashboard on login
    - **Saved Views**: List of saved filter+layout combos with load/delete actions
    - **Data Sources**: Read-only list of configured databases (from Superset)
  - Saved views:
    - Each view: name, filters summary, created date
    - "Load" → applies filters + navigates to dashboard
    - "Delete" → removes with confirmation
    - "Save Current View" button in the filter bar → dialog: enter name → POST /api/views
  - Persist settings to localStorage + backend API where applicable
- Add "Save View" button to the dashboard filter bar:
  - Opens dialog: enter view name → saves current globalFilters + dashboard ID
  - Saved views also appear in command palette

**Verify:**
1. /reports → see report cards with status badges
2. Click "Generate Now" → toast appears
3. /settings → theme toggle works, density toggle adjusts spacing
4. Saved Views tab → list views → load one → navigate to dashboard with those filters
5. On dashboard: apply filters → "Save View" → enter name → view appears in settings

---

## Phase 20 — Polish + Animations + Demo Prep (31 min) ⏱ 5:29 → 6:00

**Delivers:** Premium feel. Smooth transitions. Skeleton everything. Error boundaries. Full demo walkthrough verified.

**Actions (Polish):**
- `motion/react` page transitions (NOT `framer-motion` — same library, newer import path):
  - Wrap route outlet: fade + slide-up (200ms, ease-out)
  - Chart panels: fade-in + scale (0.97 → 1.0) on data load
  - KPI cards: stagger animation (each card slides in 50ms after previous)
  - Sidebar: spring animation on collapse/expand
  - Filter chips: slide-in on add, slide-out on remove
- Skeleton loaders for EVERY data component:
  - Dashboard list: grid of skeleton cards
  - Dashboard detail: skeleton KPI row + skeleton chart grid (empty chart-shaped boxes) + skeleton table rows
  - Explorer: skeleton tree + skeleton editor + skeleton results
  - Reports: skeleton list items
- Create `components/shared/error-boundary.tsx`:
  - Catches render errors
  - Shows: error icon + "Something went wrong" + error message + "Try Again" button
  - Per-section error boundaries (one chart failing doesn't kill the whole page)
- Use `components/ui/empty.tsx` (already copied from reference in Phase 2):
  - Composable: `<Empty>` + `<EmptyMedia>` + `<EmptyTitle>` + `<EmptyDescription>` + `<EmptyContent>`
  - Used in: empty dashboard list, no query results, no saved views, no reports
  - Add Lucide icon compositions inside `<EmptyMedia variant="icon">`
- Dark mode verification:
  - Check every component in dark mode
  - AG Grid Quartz dark theme
  - AG Charts dark theme
  - Monaco editor dark theme
  - All Shadcn components (should work via CSS vars)
- Micro-interactions:
  - Button hover: subtle scale (1.02)
  - Card hover: shadow elevation + translateY(-2px)
  - Toast notifications: slide-in from bottom-right
  - Tooltip delays: 300ms
- Progressive loading on dashboard:
  - KPI cards load first (small payload)
  - Charts load in parallel (show skeletons → replace one by one)
  - Grid loads last (largest payload)

**Actions (Demo Prep):**
- Full end-to-end walkthrough. Fix any visual bugs found.
- Demo script (3-5 min walkthrough):
  1. Open RecViz → dashboard list → "Recon Overview" card
  2. Dashboard loads: KPIs animate in → charts fade in → grid loads
  3. Point out: "Real Superset data — no mocks" (show Network tab briefly)
  4. Filter: select desk "Operations" → Apply → everything updates
  5. Cross-filter: click "Cash" bar in type chart → instant filter everywhere → "Zero latency — all client-side"
  6. Drill-down: click a month → see daily data → click a day → see categories → click category → see individual records with breadcrumb trail
  7. Clear drill → back to overview
  8. Navigate to Data Explorer → show schema browser
  9. Type SQL: `SELECT desk, COUNT(*), AVG(amount) FROM break_records GROUP BY desk` → Run → see results
  10. Toggle dark mode → everything switches beautifully
  11. Cmd+K → search "treasury" → navigate
  12. Show Reports page → "Generate Now" → "Queued"
  13. Close with: "This is day 1. Auth, real-time updates, Oracle connectivity, and scheduled exports are next."
- Run through demo flow 3 times without errors

**Verify:** Complete demo flow works end-to-end. No visual bugs. No console errors. Smooth and premium.

---

## Timing Summary

| Phase | Deliverable | Duration | Cumulative |
|-------|------------|----------|------------|
| 1 | Frontend scaffold | 10 min | 0:10 |
| 2 | Shadcn + all deps | 10 min | 0:20 |
| 3 | Superset + Redis local | 20 min | 0:40 |
| 4 | Seed data + registration | 15 min | 0:55 |
| 5 | FastAPI + Superset client | 15 min | 1:10 |
| 6 | All backend endpoints | 20 min | 1:30 |
| 7 | Types + API client + hooks | 15 min | 1:45 |
| 8 | TanStack Router + pages | 10 min | 1:55 |
| 9 | Shell: sidebar + topbar + theme | 25 min | 2:20 |
| 10 | Zustand stores + command palette | 15 min | 2:35 |
| 11 | Dashboard list page | 12 min | 2:47 |
| 12 | KPI cards + filter bar | 20 min | 3:07 |
| 13 | Chart wrappers + theme | 18 min | 3:25 |
| 14 | Dashboard chart grid (4 live charts) | 22 min | 3:47 |
| 15 | AG Grid detail table | 18 min | 4:05 |
| 16 | Cross-filtering | 18 min | 4:23 |
| 17 | Drill-down + breadcrumbs | 18 min | 4:41 |
| 18 | Data Explorer (full) | 28 min | 5:09 |
| 19 | Reports + Settings + Saved Views | 20 min | 5:29 |
| 20 | Polish + Animations + Demo Prep | 31 min | 6:00 |

**Total: 360 minutes = 6 hours**

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Superset pip install has dependency conflicts | Use a dedicated venv. Pin superset version. If stuck > 10 min, skip Superset init and use mock-only backend — reconfigure after demo. |
| AG Charts/Grid Enterprise license | Trial mode works without key (watermark only). For demo, watermark is fine — mention "license will be applied in production." |
| Cross-filtering performance with 500+ rows | 500 rows is trivial for client-side filtering. If we scale to 10K+, AG Grid's built-in filtering handles it natively. |
| Drill-down backend call is slow | Superset Redis cache handles repeat queries. First drill to detail may take 1-2s — show skeleton during load. |
| Phase runs over time | Borrow from Phase 20 (polish). Core features (phases 1-18) > polish (19-20). Never borrow from earlier phases. |
| Monaco editor bundle size is large | It's loaded async (React.lazy). Won't affect dashboard page load. |

---

## Architecture Proof Points (Demo Talking Points)

1. **"Superset is headless — no Superset UI exposed"** — Show FastAPI logs: frontend → FastAPI → Superset REST API → PostgreSQL (standing in for Oracle).
2. **"Any database Superset supports works"** — "In production this points to Oracle/Hive/ES. The architecture is identical."
3. **"Cross-filtering is zero-latency"** — Click chart, point at Network tab — zero requests. "This is all client-side on cached data."
4. **"Drill-down is intelligent"** — "Aggregated levels are instant (client-side). Detail rows fetch from the database on demand."
5. **"SQL Explorer connects to real databases"** — Run a live query, show results. "Analysts can write any SQL."
6. **"Production-ready caching"** — Show TanStack Query devtools: "Second time you apply this filter? Instant. It's cached."
7. **"Metadata is portable"** — "SQLite today, Oracle tomorrow — one config change."

---

## What Ships After Demo (Future Phases)

- Authentication (SSO/SAML/OIDC) + RBAC + Row-Level Security
- Real Oracle/Hive/ES database connections
- Direct Elasticsearch integration (complex nested aggs via sidecar)
- Celery task queue for async exports
- WeasyPrint PDF generation + openpyxl Excel generation
- Scheduled report delivery
- WebSocket layer for real-time dashboard updates
- Dashboard builder UI (drag-and-drop layout)
- Chart creation wizard (full CRUD via Superset API)
- AG Grid advanced: pivot mode, row grouping, master/detail, server-side row model
- Nginx reverse proxy
- Full Docker Compose (containerize Superset + backend + frontend for deployment)
- CI/CD pipeline
- Monitoring & observability
