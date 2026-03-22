# RecViz - Technical Design Document

## Visualization & Analytics Platform for Recon & Data Team

**Team:** Recon & Data, Citi
**Date:** February 2026
**Status:** Design Phase

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Data Sources](#4-data-sources)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [Superset Engine Layer](#7-superset-engine-layer)
8. [Charting Strategy](#8-charting-strategy)
9. [Filtering Architecture](#9-filtering-architecture)
10. [Cross-Filtering & Drill-Down](#10-cross-filtering--drill-down)
11. [Sidecar Capabilities](#11-sidecar-capabilities)
12. [Project Structure](#12-project-structure)
13. [UI/UX Design Principles](#13-uiux-design-principles)
14. [Page Layouts](#14-page-layouts)
15. [Data Flow](#15-data-flow)
16. [Caching Strategy](#16-caching-strategy)
17. [Deployment](#17-deployment)
18. [Development Workflow](#18-development-workflow)
19. [Phased Rollout](#19-phased-rollout)
20. [Open Questions & Future Considerations](#20-open-questions--future-considerations)

---

## 1. Overview

RecViz is a custom-built visualization and analytics platform designed for the Recon & Data team at Citi. It provides executive dashboards, interactive data exploration, and analyst workbench capabilities.

**Core principle:** Use Apache Superset as a headless BI engine (installed via `pip install apache-superset`) for its query engine, database connectivity, caching, and dataset management. Build a completely custom, ultra-premium frontend that communicates with Superset's REST API. A sidecar layer handles anything Superset's API cannot serve.

**What RecViz is NOT:** RecViz does not perform reconciliation. The actual recon process happens in a separate application. RecViz is purely for visualization and analytical purposes over recon data.

---

## 2. Architecture

### 2.1 High-Level Architecture

```
                        ┌──────────────────────────────┐
                        │         User Browser          │
                        │   RecViz Frontend (React SPA) │
                        └──────────────┬───────────────┘
                                       │
                                       │ HTTPS
                                       │
                        ┌──────────────▼───────────────┐
                        │      Reverse Proxy (Nginx)    │
                        │      TLS termination          │
                        └──────┬───────────────┬───────┘
                               │               │
                    /api/*     │               │  /superset-api/*
                               │               │
                ┌──────────────▼──┐    ┌───────▼──────────────┐
                │  RecViz Backend │    │   Apache Superset     │
                │  (FastAPI)      │    │   (pip install)       │
                │                 │    │                       │
                │  - Proxy to     │    │  - Query engine       │
                │    Superset API │    │  - Dataset management │
                │  - Sidecar      │    │  - Chart definitions  │
                │    endpoints    │    │  - SQL Lab execution  │
                │  - Custom aggs  │    │  - Result caching     │
                │  - Export/PDF   │    │  - RLS (future)       │
                │  - Direct ES    │    │  - REST API           │
                │    queries      │    │    /api/v1/*          │
                └────────┬────────┘    └──────┬───────────────┘
                         │                    │
                         │         ┌──────────▼──────────┐
                         │         │       Redis          │
                         │         │  - Query cache       │
                         │         │  - Session store     │
                         │         │  - Celery broker     │
                         │         └─────────────────────┘
                         │                    │
              ┌──────────▼────────────────────▼──────────┐
              │              Data Sources                  │
              │                                           │
              │   ┌──────────┐ ┌──────┐ ┌──────────────┐ │
              │   │  Oracle   │ │ Hive │ │Elasticsearch │ │
              │   │  (recon   │ │      │ │              │ │
              │   │   data)   │ │      │ │              │ │
              │   └──────────┘ └──────┘ └──────────────┘ │
              └───────────────────────────────────────────┘
```

### 2.2 Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     RecViz Frontend                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Shadcn/ui│  │ AG Grid  │  │ AG Charts│  │  ECharts   │ │
│  │ Shell &  │  │ Enterprise│  │Enterprise│  │ (exotic    │ │
│  │ Layout   │  │ Tables   │  │ Charts   │  │  charts)   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘ │
│       │              │              │               │        │
│  ┌────▼──────────────▼──────────────▼───────────────▼──────┐ │
│  │                  TanStack Query                          │ │
│  │            (data fetching, caching, sync)                │ │
│  └────────────────────────┬─────────────────────────────────┘ │
│                           │                                   │
│  ┌────────────────────────▼─────────────────────────────────┐ │
│  │                  Zustand Store                            │ │
│  │   { globalFilters, crossFilters, drillState, theme }     │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────┘
                              │
                    HTTP (JSON API)
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                     RecViz Backend (FastAPI)                  │
│                                                              │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Superset Proxy  │  │ Sidecar API  │  │  Export Service  │ │
│  │ /api/charts/*   │  │ /api/custom/*│  │  /api/export/*   │ │
│  │ /api/sql/*      │  │ Direct ES    │  │  PDF, Excel gen  │ │
│  │ /api/datasets/* │  │ Custom aggs  │  │                  │ │
│  └───────┬─────────┘  └──────┬───────┘  └─────────────────┘ │
│          │                   │                               │
└──────────┼───────────────────┼───────────────────────────────┘
           │                   │
           ▼                   ▼
    ┌──────────────┐    ┌──────────────┐
    │   Superset    │    │  Oracle /    │
    │   REST API    │    │  ES / Hive   │
    │   /api/v1/*   │    │  (direct)    │
    └──────────────┘    └──────────────┘
```

---

## 3. Technology Stack

### 3.1 Frontend

| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | React | 19.x | UI framework |
| **Build tool** | Vite | 6.x | Fast builds, HMR, ESM-native |
| **Language** | TypeScript | 5.x | Type safety |
| **UI components** | Shadcn/ui + Radix | Latest | Premium component system (owned, not dependency) |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS, dark mode |
| **Data grid** | AG Grid Enterprise | 33.x | Virtualized tables, pivot, grouping, Excel export |
| **Charts (primary)** | AG Charts Enterprise | 11.x | Dashboard visualizations, AG Grid integration |
| **Charts (exotic)** | Apache ECharts | 5.x | Sankey, sunburst, radar, network graphs |
| **Routing** | TanStack Router | 1.x | Type-safe, file-based routing, search params |
| **Data fetching** | TanStack Query | 5.x | Server state, caching, background refetch |
| **Client state** | Zustand | 5.x | Global filters, cross-filter state, theme |
| **Animations** | Framer Motion | 11.x | Page transitions, micro-interactions |
| **Icons** | Lucide React | Latest | Clean, consistent iconography |
| **Date handling** | date-fns | 4.x | Lightweight date manipulation |
| **Code editor** | Monaco Editor | Latest | SQL editor for data explorer |

### 3.2 Backend

| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | FastAPI | 0.115.x | Async API server |
| **Language** | Python | 3.12+ | Backend language |
| **ASGI server** | Uvicorn | Latest | Production ASGI server |
| **ORM** | SQLAlchemy | 2.x | Database abstraction (shared with Superset) |
| **Validation** | Pydantic | 2.x | Request/response models |
| **HTTP client** | httpx | Latest | Async calls to Superset API |
| **ES client** | elasticsearch-py | 8.x | Direct Elasticsearch queries |
| **Task queue** | Celery | 5.x | Async export jobs, scheduled tasks |
| **PDF generation** | WeasyPrint | Latest | PDF report generation |
| **Excel generation** | openpyxl | Latest | Excel report generation |

### 3.3 Superset Engine

| Component | Technology | Purpose |
|---|---|---|
| **Superset** | Apache Superset (pip install) | Headless BI engine |
| **Cache** | Redis 7.x | Query result caching, Celery broker |
| **Metadata DB** | PostgreSQL 16 | Superset metadata (dashboards, datasets, charts) |
| **Oracle driver** | python-oracledb | Oracle database connectivity |
| **Hive driver** | pyhive | Hive connectivity |
| **ES driver** | elasticsearch-dbapi | Elasticsearch SQL interface |

---

## 4. Data Sources

### 4.1 Oracle

- Primary source for reconciliation data
- Contains: break records, transaction details, counterparty data, historical reconciliation results
- Connected via SQLAlchemy + python-oracledb
- Superset registers this as a database connection
- Datasets defined as either physical tables or virtual (SQL) datasets

### 4.2 Elasticsearch

- Used for: full-text search, real-time aggregations, log data
- Two access patterns:
  - **Via Superset**: Using elasticsearch-dbapi for SQL-like queries through Superset's engine
  - **Via Sidecar (direct)**: Using elasticsearch-py for complex aggregations, nested queries, and real-time search that Superset's SQL translation can't handle

### 4.3 Hive

- Used for: large-scale historical data, batch analytics
- Connected via pyhive
- Typically slower queries - caching is critical here
- Superset handles query execution and result caching

---

## 5. Frontend Architecture

### 5.1 Component Hierarchy

```
<App>
├── <ThemeProvider>              # Shadcn/Tailwind dark/light mode
│   ├── <QueryClientProvider>    # TanStack Query
│   │   ├── <RouterProvider>     # TanStack Router
│   │   │   ├── <RootLayout>
│   │   │   │   ├── <Sidebar />               # Shadcn sidebar, collapsible
│   │   │   │   ├── <TopBar />                # Breadcrumbs, search, user menu
│   │   │   │   ├── <CommandPalette />         # Cmd+K search (Shadcn Command)
│   │   │   │   └── <Outlet />                # Page content
│   │   │   │       ├── <DashboardPage />
│   │   │   │       ├── <DataExplorerPage />
│   │   │   │       ├── <ReportsPage />
│   │   │   │       └── <SettingsPage />
│   │   │   └── <Toaster />                   # Shadcn toast notifications
│   │   └── <ReactQueryDevtools />
│   └── </ThemeProvider>
└── </App>
```

### 5.2 Dashboard Page Component Tree

```
<DashboardPage>
├── <FilterBar>                          # Global filters
│   ├── <DateRangePicker />              # Shadcn date picker
│   ├── <EntitySelector />               # Shadcn combobox with search
│   ├── <StatusFilter />                 # Shadcn multi-select
│   ├── <DeskFilter />                   # Shadcn select
│   └── <FilterActions />                # Apply, Reset, Save as default
│
├── <KPIRow>                             # Summary metrics
│   ├── <KPICard title="Total Breaks" /> # Shadcn card + animated counter
│   ├── <KPICard title="Resolution %" />
│   ├── <KPICard title="Avg Age" />
│   └── <KPICard title="SLA Breaches" />
│
├── <ChartGrid>                          # Responsive grid layout
│   ├── <ChartPanel title="Break Trend">
│   │   └── <AgChartWrapper />           # AG Charts area/line chart
│   ├── <ChartPanel title="By Type">
│   │   └── <AgChartWrapper />           # AG Charts bar chart
│   ├── <ChartPanel title="By Desk">
│   │   └── <AgChartWrapper />           # AG Charts donut chart
│   └── <ChartPanel title="Aging">
│   │   └── <AgChartWrapper />           # AG Charts stacked bar
│
└── <DetailGrid>                         # Bottom section
    └── <AgGridWrapper>                  # AG Grid Enterprise
        ├── Row Grouping
        ├── Column Filters
        ├── Pivot Mode Toggle
        ├── Excel Export Button
        └── Master/Detail (expand row → sub-grid)
```

### 5.3 State Management

```
// stores/filterStore.ts
interface FilterStore {
  // Tier 1: Global filters (trigger backend calls)
  globalFilters: {
    dateRange: { from: Date; to: Date }
    entities: string[]
    statuses: string[]
    desks: string[]
  }

  // Tier 2: Cross-filters (client-side only)
  crossFilters: Record<string, {
    chartId: string
    field: string
    value: string | string[]
  }>

  // Drill-down state
  drillState: Record<string, {
    level: number
    breadcrumb: { label: string; filters: Record<string, any> }[]
  }>

  // Actions
  setGlobalFilter: (key: string, value: any) => void
  setCrossFilter: (chartId: string, field: string, value: any) => void
  clearCrossFilters: () => void
  drillDown: (chartId: string, field: string, value: any) => void
  drillUp: (chartId: string) => void
  resetDrill: (chartId: string) => void
}
```

### 5.4 TanStack Query Integration

```
// hooks/useChartData.ts
// Query key includes global filters so cache is per-filter-combo
function useChartData(chartId: string) {
  const { globalFilters } = useFilterStore()

  return useQuery({
    queryKey: ['chart-data', chartId, globalFilters],
    queryFn: () => api.getChartData(chartId, globalFilters),
    staleTime: 5 * 60 * 1000,        // 5 min before considered stale
    gcTime: 30 * 60 * 1000,           // 30 min in cache
    placeholderData: keepPreviousData, // Show old data while fetching new
  })
}

// hooks/useGridData.ts
function useGridData(datasetId: string) {
  const { globalFilters } = useFilterStore()

  return useInfiniteQuery({
    queryKey: ['grid-data', datasetId, globalFilters],
    queryFn: ({ pageParam = 0 }) =>
      api.getGridData(datasetId, globalFilters, {
        offset: pageParam,
        limit: 500,
      }),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  })
}
```

---

## 6. Backend Architecture

### 6.1 FastAPI Application Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app, middleware, lifespan
│   ├── config.py                  # Settings via pydantic-settings
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py              # Main router aggregation
│   │   ├── charts.py              # /api/charts/* - proxy to Superset chart data
│   │   ├── datasets.py            # /api/datasets/* - proxy to Superset datasets
│   │   ├── sql.py                 # /api/sql/* - proxy to Superset SQL Lab
│   │   ├── dashboards.py          # /api/dashboards/* - dashboard definitions
│   │   ├── search.py              # /api/search/* - direct ES full-text search
│   │   ├── custom.py              # /api/custom/* - sidecar custom endpoints
│   │   └── export.py              # /api/export/* - PDF/Excel generation
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── superset_client.py     # Async HTTP client wrapping Superset API
│   │   ├── elasticsearch.py       # Direct ES query service
│   │   ├── export_service.py      # PDF/Excel report generation
│   │   └── cache.py               # Redis cache helpers
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── filters.py             # Filter request/response models
│   │   ├── chart_data.py          # Chart data models
│   │   └── export.py              # Export request models
│   │
│   └── core/
│       ├── __init__.py
│       ├── dependencies.py        # FastAPI dependencies (Superset client, ES client)
│       └── exceptions.py          # Custom exception handlers
│
├── tests/
│   ├── test_charts.py
│   ├── test_sql.py
│   └── test_export.py
│
├── pyproject.toml
├── Dockerfile
└── alembic/                       # DB migrations (if sidecar needs its own DB)
```

### 6.2 Superset Client Service

```python
# services/superset_client.py (conceptual)

class SupersetClient:
    """Async client wrapping Superset REST API."""

    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url)
        self._access_token: str | None = None

    async def authenticate(self) -> None:
        """POST /api/v1/security/login"""

    async def get_chart_data(
        self, chart_id: int, filters: list[dict]
    ) -> dict:
        """POST /api/v1/chart/data with query_context and extra filters."""

    async def execute_sql(
        self, database_id: int, sql: str, limit: int = 1000
    ) -> dict:
        """POST /api/v1/sqllab/execute/"""

    async def list_datasets(self) -> list[dict]:
        """GET /api/v1/dataset/"""

    async def get_dataset_data(
        self, dataset_id: int, filters: list[dict],
        order_by: list[dict], offset: int, limit: int
    ) -> dict:
        """Fetch paginated data from a dataset with filters."""

    async def list_charts(self) -> list[dict]:
        """GET /api/v1/chart/"""

    async def create_chart(self, chart_config: dict) -> dict:
        """POST /api/v1/chart/ - programmatic chart creation."""

    async def create_dashboard(self, dashboard_config: dict) -> dict:
        """POST /api/v1/dashboard/ - programmatic dashboard creation."""
```

### 6.3 Key API Endpoints

| Endpoint | Method | Purpose | Backend |
|---|---|---|---|
| `/api/charts/{id}/data` | POST | Fetch chart data with filters | Superset proxy |
| `/api/charts` | GET | List available charts | Superset proxy |
| `/api/datasets` | GET | List datasets | Superset proxy |
| `/api/datasets/{id}/data` | POST | Paginated dataset data with filters | Superset proxy |
| `/api/sql/execute` | POST | Execute ad-hoc SQL | Superset proxy |
| `/api/sql/history` | GET | Query history | Superset proxy |
| `/api/search` | POST | Full-text search across ES | Direct ES |
| `/api/custom/aggregations` | POST | Custom aggregations not suited for Superset | Direct DB/ES |
| `/api/export/pdf` | POST | Generate PDF report | Sidecar |
| `/api/export/excel` | POST | Generate Excel export | Sidecar |
| `/api/dashboards` | GET | List dashboard definitions | Superset proxy |
| `/api/dashboards/{id}` | GET | Dashboard layout + chart configs | Superset proxy |

---

## 7. Superset Engine Layer

### 7.1 Installation & Configuration

Superset is installed as a Python package, NOT run as a separate UI:

```bash
pip install apache-superset
```

### 7.2 Key Configuration (superset_config.py)

```python
# superset_config.py (conceptual structure)

# Metadata database (stores Superset's own data: dashboards, charts, datasets)
SQLALCHEMY_DATABASE_URI = "postgresql://recviz:password@localhost:5432/superset_meta"

# Redis for caching and Celery
CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "recviz_",
    "CACHE_REDIS_URL": "redis://localhost:6379/0",
}

# Data source cache (cache query results from Oracle/Hive/ES)
DATA_CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 600,
    "CACHE_KEY_PREFIX": "recviz_data_",
    "CACHE_REDIS_URL": "redis://localhost:6379/1",
}

# Feature flags
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,    # Jinja in SQL
    "ENABLE_EXPLORE_JSON_CSRF_PROTECTION": False,  # Simplify API calls
}

# Celery (for async queries on Hive - which can be slow)
class CeleryConfig:
    broker_url = "redis://localhost:6379/2"
    result_backend = "redis://localhost:6379/3"

CELERY_CONFIG = CeleryConfig

# Enable CORS for RecViz frontend
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["/api/*"],
    "origins": ["http://localhost:5173"],  # Vite dev server
}
```

### 7.3 Superset API Endpoints Used by RecViz

| Superset Endpoint | RecViz Usage |
|---|---|
| `POST /api/v1/security/login` | Backend authenticates to get JWT token |
| `POST /api/v1/chart/data` | Fetch data for a specific chart visualization |
| `POST /api/v1/sqllab/execute/` | Execute SQL from the data explorer |
| `GET /api/v1/dataset/` | List available datasets for the explorer |
| `GET /api/v1/dataset/{id}` | Get dataset schema (columns, types) |
| `GET /api/v1/chart/` | List saved chart definitions |
| `POST /api/v1/chart/` | Programmatically create charts |
| `GET /api/v1/database/` | List registered database connections |
| `POST /api/v1/dashboard/` | Programmatically create dashboards |

---

## 8. Charting Strategy

### 8.1 AG Charts (Primary - 90% of visualizations)

Used for all standard dashboard charts. Benefits:

- Premium look out of the box
- Tight integration with AG Grid (select rows → chart updates)
- Consistent design language across grid and charts
- Enterprise license already available

**Chart types covered by AG Charts:**
- Line, Bar, Area (stacked, grouped, normalized)
- Pie, Donut
- Scatter, Bubble
- Histogram
- Heatmap
- Treemap
- Waterfall
- Bullet
- Range Bar / Range Area
- Box Plot
- Candlestick (if needed)
- Combination charts (dual axis)

### 8.2 Apache ECharts (Secondary - exotic visualizations)

Used via `echarts-for-react` wrapper ONLY when AG Charts doesn't support the chart type:

- **Sankey diagrams** - data flow visualization (e.g., source system → recon process → outcome)
- **Sunburst** - hierarchical break-down views
- **Radar/Spider** - multi-dimensional comparison (e.g., data quality scores across dimensions)
- **Graph/Network** - entity relationship visualization
- **Gauge** - single metric display with thresholds
- **Parallel Coordinates** - multi-variable analysis
- **Funnel** - process flow analysis

### 8.3 Chart Wrapper Abstraction

To maintain a unified interface regardless of the underlying chart library:

```
<ChartPanel>
├── <ChartHeader title="Break Trend" />
├── <ChartToolbar>                      # Export, fullscreen, refresh
│   ├── <RefreshButton />
│   ├── <FullscreenToggle />
│   └── <ExportMenu />                  # PNG, CSV, clipboard
├── <ChartBody>
│   ├── <AgChartWrapper /> (or)         # For AG Charts
│   └── <EChartWrapper />               # For ECharts
└── <ChartFooter>                       # Last updated, data source
```

Both `<AgChartWrapper>` and `<EChartWrapper>` accept the same props interface:

```typescript
interface ChartWrapperProps {
  data: any[]
  config: ChartConfig         // Chart-specific configuration
  crossFilter?: CrossFilter   // Currently active cross-filter
  onNodeClick?: (event: ChartClickEvent) => void  // For cross-filtering
  loading?: boolean
  error?: Error
}
```

---

## 9. Filtering Architecture

### 9.1 Two-Tier Filtering Model

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  TIER 1: Global Filters (Filter Bar)                        │
│  ─────────────────────────────────                          │
│  Date Range | Entity | Status | Desk | Custom...            │
│                                                              │
│  Behavior:                                                   │
│  - Changing these triggers a BACKEND CALL                   │
│  - Superset API is called with new filter parameters        │
│  - Response is cached by TanStack Query                     │
│  - Cache key = ['chart-data', chartId, globalFilterHash]    │
│  - If same filter combo was seen before: INSTANT (cache hit)│
│  - If new combo: ~1-2s (backend query + cache store)        │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TIER 2: Cross-Filters (Chart Interactions)                 │
│  ──────────────────────────────────────                     │
│  Click bar in chart | Select rows in grid | Hover sync      │
│                                                              │
│  Behavior:                                                   │
│  - Operates on ALREADY-FETCHED DATA (client-side)           │
│  - Zustand store updates, all subscribed components react   │
│  - Zero network latency - INSTANT                           │
│  - Filtered data derived via useMemo from cached dataset    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TIER 3: Drill-Down (Depth Navigation)                      │
│  ─────────────────────────────────────                      │
│  Click month → see days | Click day → see individual rows   │
│                                                              │
│  Behavior:                                                   │
│  - Level 1→2 (aggregated → less aggregated): CLIENT-SIDE   │
│    if data granularity allows                               │
│  - Level 2→3 (aggregated → row detail): BACKEND CALL       │
│    (new query with drill filters)                           │
│  - Breadcrumb trail maintained in Zustand                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Filter Flow Diagram

```
User changes date range to "Jan 2026"
         │
         ▼
┌─────────────────────────┐
│  Zustand: setGlobalFilter│
│  dateRange: Jan 2026     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  TanStack Query: queryKey       │
│  changes for ALL chart queries  │
│  ['chart-data', *, {date: Jan}] │
└────────────┬────────────────────┘
             │
       ┌─────▼──────┐
       │ Cache hit?  │
       └──┬──────┬───┘
          │      │
       Yes│      │No
          │      │
          ▼      ▼
   ┌──────────┐  ┌──────────────────────────────────┐
   │ Return   │  │ POST /api/charts/{id}/data        │
   │ cached   │  │ body: { filters: [                │
   │ data     │  │   { col: "date",                  │
   │ INSTANT  │  │     op: "BETWEEN",                │
   │          │  │     val: ["2026-01-01","2026-01-31"]│
   └──────────┘  │   }                               │
                 │ ]}                                 │
                 └───────────────┬────────────────────┘
                                 │
                                 ▼
                 ┌──────────────────────────────────┐
                 │ FastAPI Backend                   │
                 │ → Superset Client                 │
                 │ → POST /api/v1/chart/data         │
                 │   with query_context + filters    │
                 └───────────────┬────────────────────┘
                                 │
                                 ▼
                 ┌──────────────────────────────────┐
                 │ Superset Engine                   │
                 │ → Generates SQL with WHERE clause │
                 │ → Checks Redis cache              │
                 │ → If miss: queries Oracle/Hive/ES │
                 │ → Stores result in Redis           │
                 │ → Returns data                     │
                 └───────────────┬────────────────────┘
                                 │
                                 ▼
                 ┌──────────────────────────────────┐
                 │ TanStack Query                    │
                 │ → Stores in client cache          │
                 │ → Triggers re-render              │
                 │ → Charts update with new data     │
                 └──────────────────────────────────┘
```

### 9.3 Cross-Filter Flow

```
User clicks "Operations" bar in "Breaks by Desk" chart
         │
         ▼
┌────────────────────────────────────┐
│  AG Charts onNodeClick callback    │
│  event: { field: 'desk',          │
│           value: 'Operations' }    │
└───────────────┬────────────────────┘
                │
                ▼
┌────────────────────────────────────┐
│  Zustand: setCrossFilter           │
│  crossFilters: {                   │
│    'desk-chart': {                 │
│      field: 'desk',               │
│      value: 'Operations'          │
│    }                               │
│  }                                 │
└───────────────┬────────────────────┘
                │
    ┌───────────┼───────────┬────────────────┐
    ▼           ▼           ▼                ▼
┌────────┐ ┌────────┐ ┌──────────┐  ┌────────────┐
│ Trend  │ │ By Type│ │ Aging    │  │ AG Grid    │
│ Chart  │ │ Chart  │ │ Chart    │  │ Detail     │
│        │ │        │ │          │  │            │
│ useMemo│ │ useMemo│ │ useMemo  │  │ grid API   │
│ filters│ │ filters│ │ filters  │  │ setFilter  │
│ data   │ │ data   │ │ data     │  │ Model()    │
│ client │ │ client │ │ client   │  │            │
│ side   │ │ side   │ │ side     │  │ client     │
│        │ │        │ │          │  │ side       │
│RE-RENDER│ │RE-RENDER│ │RE-RENDER│  │ RE-RENDER  │
└────────┘ └────────┘ └──────────┘  └────────────┘

Total time: < 16ms (single frame)
```

### 9.4 Smart Prefetching

```
// When dashboard loads with "All Desks" view,
// prefetch each individual desk in background

const desks = ['Operations', 'Treasury', 'Settlements', 'FX']
const { globalFilters } = useFilterStore()

useEffect(() => {
  desks.forEach(desk => {
    queryClient.prefetchQuery({
      queryKey: ['chart-data', chartId, { ...globalFilters, desk }],
      queryFn: () => api.getChartData(chartId, { ...globalFilters, desk }),
      staleTime: 5 * 60 * 1000,
    })
  })
}, [globalFilters])

// Now when user clicks a desk bar → even if it's a "new" filter,
// data is already in TanStack Query cache. Feels instant.
```

---

## 10. Cross-Filtering & Drill-Down

### 10.1 Cross-Filter Configuration

Each dashboard defines which charts participate in cross-filtering:

```typescript
interface DashboardConfig {
  id: string
  title: string
  charts: ChartConfig[]
  crossFilterRules: CrossFilterRule[]
}

interface CrossFilterRule {
  sourceChartId: string   // Chart that emits the filter
  sourceField: string     // Field clicked (e.g., "desk")
  targetChartIds: string[] // Charts that receive the filter ("*" for all)
  targetField: string     // Field to filter on in targets
}

// Example:
const rules: CrossFilterRule[] = [
  {
    sourceChartId: 'breaks-by-desk',
    sourceField: 'desk',
    targetChartIds: ['*'],   // Filters all other charts
    targetField: 'desk',
  },
  {
    sourceChartId: 'breaks-by-type',
    sourceField: 'break_type',
    targetChartIds: ['trend-chart', 'detail-grid'],
    targetField: 'break_type',
  },
]
```

### 10.2 Drill-Down Levels

```
Level 0 (Overview):   All data, aggregated by month
                      Charts: Monthly trend, summary KPIs
                      ───────────────────────────────
                              │ Click month
                              ▼
Level 1 (Month):      Single month, aggregated by day
                      Charts: Daily trend, daily breakdown
                      Grid: Daily summary rows
                      ───────────────────────────────
                              │ Click day
                              ▼
Level 2 (Day):        Single day, aggregated by category
                      Charts: Category breakdown
                      Grid: Summary by break type, desk
                      ───────────────────────────────
                              │ Click category
                              ▼
Level 3 (Detail):     Individual break records
                      Grid: Full AG Grid with all columns
                      Master/Detail: Expand for sub-records
                      ** This level requires a BACKEND CALL **
```

### 10.3 Drill-Down State Management

```typescript
// Breadcrumb: Monthly > January 2026 > Jan 15 > Settlement Breaks
interface DrillState {
  chartId: string
  levels: DrillLevel[]
  currentLevel: number
}

interface DrillLevel {
  label: string                    // Display in breadcrumb
  filters: Record<string, any>    // Filters applied at this level
  granularity: string             // "month" | "day" | "category" | "detail"
}
```

### 10.4 AG Grid Integration with Cross-Filters

AG Grid Enterprise's built-in features that support this:

- **Row Grouping**: Analyst can drag columns into group zone for ad-hoc grouping
- **Pivot Mode**: Turn row data into pivot table (rows × columns × values)
- **Integrated Charts**: Select rows → right-click → "Chart Selected" → AG Charts renders inline
- **Master/Detail**: Click expand icon → nested sub-grid appears with related records
- **Server-Side Row Model**: For very large datasets, AG Grid fetches pages from the backend on demand (virtual scrolling with backend pagination)
- **Quick Filter**: Type-ahead search across all visible columns (client-side)
- **External Filter**: Zustand cross-filter state applied as AG Grid external filter

---

## 11. Sidecar Capabilities

The sidecar handles everything that Superset's REST API cannot serve:

### 11.1 Direct Elasticsearch Queries

```
Use case: Real-time search across recon data, complex nested aggregations
Why sidecar: Superset's ES support uses elasticsearch-dbapi which translates
             SQL to ES query DSL. This works for simple queries but fails for:
             - Nested aggregations
             - Full-text search with relevance scoring
             - Complex bool queries with must/should/filter
             - Geo queries (if applicable)
             - Script-based aggregations

RecViz approach: FastAPI endpoint that accepts ES query DSL directly,
                 executes via elasticsearch-py, returns formatted results.
```

### 11.2 Custom Aggregations

```
Use case: Domain-specific calculations not expressible in standard SQL
Examples:
  - Weighted aging score (break amount × days outstanding)
  - Rolling reconciliation rate (matched / total over trailing N days)
  - Break velocity (rate of new breaks vs. resolved over time)
  - Counterparty risk scoring (composite of multiple factors)

RecViz approach: Python service that queries raw data, applies custom
                 business logic, returns pre-computed aggregations.
```

### 11.3 Export Service

```
Use case: Generate formatted PDF reports and Excel exports
Why sidecar: Superset has basic CSV export but no formatted reporting.

Capabilities:
  - PDF: WeasyPrint renders HTML templates to PDF
    - Branded headers/footers
    - Page numbers, table of contents
    - Charts rendered as SVG/PNG (AG Charts server-side rendering)
  - Excel: openpyxl generates formatted .xlsx
    - Multiple sheets (summary + detail)
    - Formatted headers, freeze panes
    - Conditional formatting (red for breaches, green for resolved)
    - Embedded charts (via openpyxl chart support)
  - Scheduling: Celery tasks for scheduled report generation and email delivery
```

### 11.4 Saved Views & Bookmarks

```
Use case: Users save their frequently used filter combinations and layouts
Why sidecar: Superset doesn't expose this for external frontends.

Features:
  - Save current filter state + layout as a named view
  - Share views via URL (filters encoded in URL search params)
  - Default view per user
  - Team-shared views
  - Stored in sidecar's own PostgreSQL database (or Redis)
```

---

## 12. Project Structure

```
recviz/
│
├── frontend/                          # React 19 + Vite 6
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── main.tsx                   # Entry point
│   │   ├── app.tsx                    # App shell, providers
│   │   ├── index.css                  # Tailwind imports, global styles
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                    # Shadcn/ui components (copy-pasted, owned)
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── command.tsx        # Cmd+K palette
│   │   │   │   ├── date-picker.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── popover.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── separator.tsx
│   │   │   │   ├── sheet.tsx          # Slide-over panel
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── skeleton.tsx       # Loading placeholders
│   │   │   │   ├── table.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   ├── toaster.tsx
│   │   │   │   └── tooltip.tsx
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── root-layout.tsx    # Sidebar + topbar + content area
│   │   │   │   ├── sidebar.tsx        # Collapsible navigation sidebar
│   │   │   │   ├── topbar.tsx         # Breadcrumbs, search, user menu
│   │   │   │   └── command-palette.tsx # Cmd+K global search
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── filter-bar.tsx     # Global filter bar component
│   │   │   │   ├── kpi-card.tsx       # KPI metric card with animation
│   │   │   │   ├── chart-panel.tsx    # Chart container with header/toolbar
│   │   │   │   ├── chart-grid.tsx     # Responsive chart layout grid
│   │   │   │   └── drill-breadcrumb.tsx # Drill-down breadcrumb nav
│   │   │   │
│   │   │   ├── charts/
│   │   │   │   ├── ag-chart-wrapper.tsx    # AG Charts React wrapper
│   │   │   │   ├── echart-wrapper.tsx      # ECharts React wrapper
│   │   │   │   ├── chart-factory.tsx       # Returns correct wrapper by type
│   │   │   │   └── chart-export.tsx        # Chart export (PNG, CSV)
│   │   │   │
│   │   │   ├── grid/
│   │   │   │   ├── data-grid.tsx           # AG Grid Enterprise wrapper
│   │   │   │   ├── grid-toolbar.tsx        # Pivot toggle, export, column chooser
│   │   │   │   ├── grid-status-bar.tsx     # Row count, selection info
│   │   │   │   └── cell-renderers/         # Custom AG Grid cell renderers
│   │   │   │       ├── status-cell.tsx
│   │   │   │       ├── amount-cell.tsx
│   │   │   │       ├── date-cell.tsx
│   │   │   │       └── sparkline-cell.tsx  # AG Grid sparklines
│   │   │   │
│   │   │   ├── explorer/
│   │   │   │   ├── sql-editor.tsx          # Monaco editor for SQL
│   │   │   │   ├── schema-browser.tsx      # Database/table/column tree
│   │   │   │   ├── query-results.tsx       # AG Grid for query results
│   │   │   │   └── query-history.tsx       # Past queries list
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── loading-skeleton.tsx    # Page-level skeleton loaders
│   │   │       ├── error-boundary.tsx      # Error fallback UI
│   │   │       ├── empty-state.tsx         # No data illustration
│   │   │       └── animated-counter.tsx    # Number animation for KPIs
│   │   │
│   │   ├── pages/
│   │   │   ├── dashboard/
│   │   │   │   ├── index.tsx              # Dashboard list / home
│   │   │   │   └── $dashboardId.tsx       # Individual dashboard view
│   │   │   ├── explorer/
│   │   │   │   └── index.tsx              # SQL explorer page
│   │   │   ├── reports/
│   │   │   │   ├── index.tsx              # Report list
│   │   │   │   └── $reportId.tsx          # Individual report
│   │   │   └── settings/
│   │   │       └── index.tsx              # User preferences, theme
│   │   │
│   │   ├── hooks/
│   │   │   ├── use-chart-data.ts          # TanStack Query hook for chart data
│   │   │   ├── use-grid-data.ts           # TanStack Query hook for grid data
│   │   │   ├── use-datasets.ts            # TanStack Query hook for dataset list
│   │   │   ├── use-sql-execute.ts         # TanStack mutation for SQL execution
│   │   │   ├── use-cross-filter.ts        # Hook to apply/read cross-filter state
│   │   │   ├── use-drill-down.ts          # Hook for drill-down navigation
│   │   │   └── use-prefetch.ts            # Smart prefetching hook
│   │   │
│   │   ├── stores/
│   │   │   ├── filter-store.ts            # Zustand: global + cross filters
│   │   │   ├── drill-store.ts             # Zustand: drill-down state
│   │   │   ├── theme-store.ts             # Zustand: dark/light mode, layout prefs
│   │   │   └── sidebar-store.ts           # Zustand: sidebar collapsed state
│   │   │
│   │   ├── lib/
│   │   │   ├── api-client.ts              # Axios/fetch wrapper for RecViz backend
│   │   │   ├── utils.ts                   # cn() helper, formatters
│   │   │   ├── constants.ts               # Chart colors, breakpoints, etc.
│   │   │   ├── ag-grid-config.ts          # Shared AG Grid configuration
│   │   │   ├── ag-chart-themes.ts         # AG Charts theme matching Shadcn
│   │   │   └── filter-utils.ts            # Filter serialization, URL encoding
│   │   │
│   │   └── types/
│   │       ├── chart.ts                   # Chart data types
│   │       ├── filter.ts                  # Filter types
│   │       ├── dataset.ts                 # Dataset metadata types
│   │       └── api.ts                     # API response types
│   │
│   ├── components.json                    # Shadcn/ui config
│   ├── tailwind.config.ts                 # Tailwind configuration
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── package.json
│   └── index.html
│
├── backend/                               # FastAPI
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                        # FastAPI app creation, middleware
│   │   ├── config.py                      # pydantic-settings configuration
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── router.py                  # Aggregate all routers
│   │   │   ├── charts.py                  # Chart data endpoints
│   │   │   ├── datasets.py                # Dataset endpoints
│   │   │   ├── sql.py                     # SQL execution endpoints
│   │   │   ├── dashboards.py              # Dashboard config endpoints
│   │   │   ├── search.py                  # ES search endpoints
│   │   │   ├── custom.py                  # Custom aggregation endpoints
│   │   │   ├── export.py                  # PDF/Excel export endpoints
│   │   │   └── views.py                   # Saved views/bookmarks endpoints
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── superset_client.py         # Async Superset API wrapper
│   │   │   ├── elasticsearch.py           # Direct ES query service
│   │   │   ├── export_service.py          # PDF/Excel generation
│   │   │   ├── aggregation_service.py     # Custom business logic aggregations
│   │   │   └── cache.py                   # Redis helpers
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── filters.py                 # Filter models
│   │   │   ├── chart_data.py              # Chart response models
│   │   │   ├── dataset.py                 # Dataset models
│   │   │   ├── export.py                  # Export request models
│   │   │   └── views.py                   # Saved view models
│   │   │
│   │   └── core/
│   │       ├── __init__.py
│   │       ├── dependencies.py            # FastAPI deps
│   │       └── exceptions.py              # Exception handlers
│   │
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_charts.py
│   │   ├── test_datasets.py
│   │   ├── test_sql.py
│   │   ├── test_export.py
│   │   └── test_custom.py
│   │
│   ├── alembic/                           # DB migrations (for sidecar DB)
│   │   ├── versions/
│   │   └── env.py
│   ├── alembic.ini
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── requirements.txt
│
├── superset/                              # Superset configuration
│   ├── superset_config.py                 # Main Superset config
│   ├── requirements-superset.txt          # Superset + driver dependencies
│   └── init_superset.sh                   # Bootstrap script (init DB, create admin, register databases)
│
├── infrastructure/
│   ├── docker-compose.yml                 # Local dev: all services
│   ├── docker-compose.prod.yml            # Production overrides
│   ├── nginx/
│   │   └── nginx.conf                     # Reverse proxy config
│   ├── redis/
│   │   └── redis.conf                     # Redis config
│   └── scripts/
│       ├── setup-dev.sh                   # One-command dev environment setup
│       └── seed-data.sh                   # Seed sample data for development
│
├── docs/
│   ├── api-reference.md                   # API documentation
│   └── dashboard-config-guide.md          # How to configure new dashboards
│
├── .gitignore
├── .env.example                           # Environment variable template
├── Makefile                               # Common commands (make dev, make build, etc.)
└── RECVIZ_PLAN.md                         # This document
```

---

## 13. UI/UX Design Principles

### 13.1 Ultra-Premium Feel

| Principle | Implementation |
|---|---|
| **Clean negative space** | Generous padding, no cramped layouts. Tailwind spacing scale. |
| **Subtle animations** | Framer Motion: page transitions (slide + fade), chart load animations, KPI counter roll-up, sidebar expand/collapse spring animation |
| **Skeleton loading** | Every data component shows Shadcn `<Skeleton>` shapes before data arrives. Never a blank screen. |
| **Micro-interactions** | Button hover states, tooltip fade-ins, filter chip animations, toast slide-ins |
| **Typography hierarchy** | Inter or Geist font. Clear size scale: page title (24px), section title (18px), body (14px), caption (12px) |
| **Color system** | Shadcn's CSS variable-based system. 2-3 accent colors max. Muted backgrounds. No harsh colors. |
| **Dark mode** | First-class support. Tailwind `dark:` variants. AG Grid Quartz dark theme. System preference detection + manual toggle. |
| **Consistent density** | "Comfortable" by default, "Compact" toggle for power users (reduces padding, smaller text) |

### 13.2 Performance-First UX

| Technique | Effect |
|---|---|
| **Stale-while-revalidate** | TanStack Query shows cached data instantly, refreshes in background |
| **Optimistic filter application** | Cross-filters apply visually before data finishes filtering |
| **Progressive loading** | KPI cards load first (small payload), then charts, then grid |
| **Virtualized grid** | AG Grid renders only visible rows - handles 100k+ rows at 60fps |
| **Route-based code splitting** | `React.lazy()` for page components - only load what's needed |
| **Prefetching** | Hover over nav link → prefetch that page's data. Hover over filter option → prefetch that filter combo. |
| **Image/asset optimization** | SVG icons (Lucide). No raster images except user avatars. |

### 13.3 AG Grid Theming

AG Grid's Quartz theme (their latest) will be customized to match Shadcn's design:

```
AG Grid Quartz Theme Customization:
  - --ag-foreground-color: matches Shadcn's foreground CSS variable
  - --ag-background-color: matches Shadcn's background CSS variable
  - --ag-header-background-color: matches Shadcn's muted
  - --ag-border-color: matches Shadcn's border
  - --ag-row-hover-color: matches Shadcn's accent
  - --ag-selected-row-background-color: matches Shadcn's primary with opacity
  - --ag-font-family: Inter / Geist (matching app font)
  - --ag-font-size: 13px (slightly smaller for data density)
  - Border radius on cells: 0 (clean, no rounded cells)
  - Custom header component with Shadcn-style sort indicators
```

---

## 14. Page Layouts

### 14.1 Dashboard Page

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌──────┐                                                         │
│ │      │  RecViz          Dashboards  Explorer  Reports          │
│ │ LOGO │                                          [Theme] [User]│
│ │      │                                                         │
│ ├──────┤  ─────────────────────────────────────────────────────  │
│ │      │                                                         │
│ │ NAV  │  ┌─ Filter Bar ─────────────────────────────────────┐  │
│ │      │  │ Date: [Jan 1 - Jan 31 ▼]  Entity: [All ▼]       │  │
│ │ Dash │  │ Status: [Open ▼]  Desk: [All ▼]  [Apply] [Reset]│  │
│ │ board│  └──────────────────────────────────────────────────┘  │
│ │      │                                                         │
│ │ Explo│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ rer  │  │ Total    │ │ Resolved │ │ Avg Age  │ │ SLA      │  │
│ │      │  │ Breaks   │ │ Rate     │ │          │ │ Breaches │  │
│ │ Repo │  │  1,247   │ │  94.2%   │ │  3.2d    │ │    12    │  │
│ │ rts  │  │ ▲ +5.3%  │ │ ▲ +1.1%  │ │ ▼ -0.5d  │ │ ▼ -3     │  │
│ │      │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│ │ Sett │                                                         │
│ │ ings │  ┌─────────────────────────┐ ┌────────────────────────┐│
│ │      │  │                         │ │                        ││
│ │      │  │   Break Trend           │ │   Breaks by Type       ││
│ │      │  │   (AG Charts - Area)    │ │   (AG Charts - Bar)    ││
│ │      │  │                         │ │                        ││
│ │      │  │   ~~~~/\~~~~            │ │   ████                 ││
│ │      │  │  /        \~~~          │ │   ██████               ││
│ │      │  │ /                       │ │   ████████             ││
│ │      │  │                         │ │   ██                   ││
│ │      │  └─────────────────────────┘ └────────────────────────┘│
│ │      │                                                         │
│ │      │  ┌─────────────────────────┐ ┌────────────────────────┐│
│ │      │  │                         │ │                        ││
│ │      │  │   Breaks by Desk        │ │   Aging Distribution   ││
│ │      │  │   (AG Charts - Donut)   │ │   (AG Charts - Stacked)││
│ │      │  │                         │ │                        ││
│ │      │  │      ┌───┐              │ │   ████ ████ ████       ││
│ │      │  │    ╱     ╲             │ │   ████ ████ ████       ││
│ │      │  │   │       │             │ │   ████ ████ ████ ████  ││
│ │      │  │    ╲     ╱             │ │   ████ ████ ████ ████  ││
│ │      │  │      └───┘              │ │                        ││
│ │      │  └─────────────────────────┘ └────────────────────────┘│
│ │      │                                                         │
│ │      │  ┌──────────────────────────────────────────────────┐  │
│ │      │  │  Break Details                   [Pivot] [Export] │  │
│ │      │  │  ┌──────┬───────┬────────┬───────┬──────┬──────┐ │  │
│ │      │  │  │ ID   │ Date  │ Type   │ Amount│ Desk │Status│ │  │
│ │      │  │  ├──────┼───────┼────────┼───────┼──────┼──────┤ │  │
│ │      │  │  │ 1001 │ Jan 2 │ Cash   │ 50.2K │ Ops  │ Open │ │  │
│ │      │  │  │ 1002 │ Jan 2 │ Settle │ 12.8K │ Trea │ Resol│ │  │
│ │      │  │  │ ...  │       │        │       │      │      │ │  │
│ │      │  │  └──────┴───────┴────────┴───────┴──────┴──────┘ │  │
│ │      │  │  Showing 1-50 of 1,247 rows                       │  │
│ └──────┘  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 14.2 Data Explorer Page

```
┌──────────────────────────────────────────────────────────────────┐
│ [Sidebar]  Data Explorer                                         │
│            ─────────────────────────────────────────────────────  │
│                                                                   │
│  ┌─ Schema Browser ──┐  ┌─ SQL Editor (Monaco) ──────────────┐  │
│  │                    │  │                                     │  │
│  │ ▼ Oracle - Recon   │  │  SELECT                            │  │
│  │   ▶ breaks         │  │    desk,                           │  │
│  │   ▶ transactions   │  │    COUNT(*) as break_count,        │  │
│  │   ▶ counterparties │  │    AVG(amount) as avg_amount       │  │
│  │                    │  │  FROM breaks                       │  │
│  │ ▶ Hive - Analytics │  │  WHERE date >= '2026-01-01'        │  │
│  │                    │  │  GROUP BY desk                     │  │
│  │ ▶ ES - Logs        │  │  ORDER BY break_count DESC         │  │
│  │                    │  │                                     │  │
│  │                    │  │              [▶ Run] [Save] [Format]│  │
│  └────────────────────┘  └─────────────────────────────────────┘  │
│                                                                   │
│  ┌─ Results ─────────────────────────────────────────────────┐  │
│  │  ┌──────┬──────────────┬────────────┐    Query time: 0.8s │  │
│  │  │ desk │ break_count  │ avg_amount │    Rows: 8          │  │
│  │  ├──────┼──────────────┼────────────┤                     │  │
│  │  │ Ops  │ 423          │ 45,230     │    [Chart It]       │  │
│  │  │ Trea │ 312          │ 67,100     │    [Export CSV]     │  │
│  │  │ FX   │ 198          │ 23,450     │    [Copy]           │  │
│  │  │ ...  │              │            │                     │  │
│  │  └──────┴──────────────┴────────────┘                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─ Query History ───────────────────────────────────────────┐  │
│  │  Jan 8, 14:23  SELECT desk, COUNT(*)...  0.8s  8 rows    │  │
│  │  Jan 8, 14:20  SELECT * FROM breaks...   1.2s  1247 rows │  │
│  │  Jan 8, 14:15  SELECT DISTINCT type...   0.3s  12 rows   │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 15. Data Flow

### 15.1 Dashboard Page Load Sequence

```
Browser                 RecViz Backend           Superset           Redis          Oracle/Hive/ES
  │                         │                       │                 │                │
  │  GET /dashboard/recon   │                       │                 │                │
  │ ───────────────────────>│                       │                 │                │
  │                         │                       │                 │                │
  │  Return React SPA       │                       │                 │                │
  │ <───────────────────────│                       │                 │                │
  │                         │                       │                 │                │
  │  GET /api/dashboards/1  │                       │                 │                │
  │ ───────────────────────>│  GET /api/v1/dash/1   │                 │                │
  │                         │ ─────────────────────>│                 │                │
  │                         │  Dashboard config     │                 │                │
  │  Dashboard layout       │ <─────────────────────│                 │                │
  │ <───────────────────────│                       │                 │                │
  │                         │                       │                 │                │
  │  POST /api/charts/*/data│                       │                 │                │
  │  (parallel for all      │  POST /api/v1/        │                 │                │
  │   charts on dashboard)  │  chart/data           │  Check cache    │                │
  │ ───────────────────────>│ ─────────────────────>│ ───────────────>│                │
  │                         │                       │                 │                │
  │                         │                       │  Cache MISS     │                │
  │                         │                       │ <───────────────│                │
  │                         │                       │                 │                │
  │                         │                       │  Execute SQL    │                │
  │                         │                       │ ───────────────────────────────> │
  │                         │                       │                 │                │
  │                         │                       │  Query results  │                │
  │                         │                       │ <─────────────────────────────── │
  │                         │                       │                 │                │
  │                         │                       │  Store in cache │                │
  │                         │                       │ ───────────────>│                │
  │                         │                       │                 │                │
  │                         │  Chart data           │                 │                │
  │  Chart data             │ <─────────────────────│                 │                │
  │ <───────────────────────│                       │                 │                │
  │                         │                       │                 │                │
  │  Render AG Charts +     │                       │                 │                │
  │  AG Grid                │                       │                 │                │
  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │                       │                 │                │
```

### 15.2 Cross-Filter Interaction (No Backend Call)

```
Browser (all in-memory)
  │
  │  User clicks "Operations" bar in Desk chart
  │
  │  1. AG Charts onNodeClick fires
  │  2. Zustand: setCrossFilter('desk-chart', 'desk', 'Operations')
  │  3. All subscribed components re-render:
  │     - Trend chart: useMemo filters cached data → re-renders
  │     - Type chart: useMemo filters cached data → re-renders
  │     - AG Grid: externalFilterPresent + doesExternalFilterPass → re-renders
  │     - KPI cards: useMemo recalculates from filtered data → animated update
  │
  │  Total time: < 16ms (single animation frame)
  │  Network calls: ZERO
```

---

## 16. Caching Strategy

### 16.1 Multi-Layer Cache

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: TanStack Query (Browser)                    │
│ ──────────────────────────────────                   │
│ What: Chart data, dataset data, dashboard configs    │
│ Key: ['chart-data', chartId, globalFilterHash]       │
│ Stale time: 5 minutes                               │
│ GC time: 30 minutes                                 │
│ Behavior: Show cached data instantly, refetch in     │
│           background if stale                        │
└──────────────────────┬──────────────────────────────┘
                       │ Cache MISS
                       ▼
┌─────────────────────────────────────────────────────┐
│ Layer 2: Superset Redis Cache (Server)               │
│ ──────────────────────────────────────               │
│ What: SQL query results from Oracle/Hive/ES          │
│ Key: hash(SQL + params)                              │
│ TTL: 10 minutes (configurable per dataset)           │
│ Behavior: Avoid re-querying slow data sources        │
│           Especially important for Hive queries      │
└──────────────────────┬──────────────────────────────┘
                       │ Cache MISS
                       ▼
┌─────────────────────────────────────────────────────┐
│ Layer 3: Data Source (Oracle / Hive / ES)             │
│ ──────────────────────────────────────               │
│ The actual query execution                           │
│ Oracle: typically 100ms - 2s                         │
│ Hive: typically 5s - 30s                             │
│ ES: typically 50ms - 500ms                           │
└─────────────────────────────────────────────────────┘
```

### 16.2 Cache Invalidation

| Trigger | Action |
|---|---|
| User clicks "Refresh" on a chart | TanStack Query `invalidateQueries` for that chart |
| User clicks "Refresh All" | TanStack Query `invalidateQueries` for all chart-data queries |
| Global filter changes | New query key → automatic fresh fetch (old cached data for old filters remains) |
| Scheduled (background) | Superset cache TTL expires → next request fetches fresh data |
| Manual purge | Admin action to clear Redis cache for specific datasets |

---

## 17. Deployment

### 17.1 Docker Compose (Development)

```yaml
# infrastructure/docker-compose.yml (conceptual)

services:
  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    volumes: ["./frontend/src:/app/src"]    # Hot reload

  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - SUPERSET_URL=http://superset:8088
      - REDIS_URL=redis://redis:6379
    depends_on: [superset, redis]

  superset:
    build: ./superset
    ports: ["8088:8088"]
    environment:
      - SUPERSET_CONFIG_PATH=/app/superset_config.py
    depends_on: [redis, postgres]

  superset-worker:
    build: ./superset
    command: celery -A superset.tasks.celery_app worker
    depends_on: [superset, redis]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      - POSTGRES_DB=superset_meta
      - POSTGRES_USER=recviz
      - POSTGRES_PASSWORD=recviz_dev
    volumes: ["pgdata:/var/lib/postgresql/data"]

  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes: ["./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf"]
    depends_on: [frontend, backend, superset]

volumes:
  pgdata:
```

### 17.2 Production Topology

```
                    ┌──────────────┐
                    │  Load        │
                    │  Balancer    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    Nginx     │
                    │  (reverse    │
                    │   proxy)     │
                    └──┬───────┬───┘
                       │       │
            ┌──────────▼──┐ ┌──▼──────────────┐
            │  RecViz      │ │  Superset        │
            │  Backend     │ │  (Gunicorn +     │
            │  (Uvicorn    │ │   Flask)         │
            │   x N pods)  │ │   x N pods       │
            └──────┬───────┘ └──┬───────────────┘
                   │            │
            ┌──────▼────────────▼──┐
            │       Redis          │
            │   (cache + broker)   │
            └──────────────────────┘
                   │
            ┌──────▼──────────────┐
            │     PostgreSQL       │
            │  (Superset metadata) │
            └─────────────────────┘
                   │
    ┌──────────────┼──────────────────┐
    │              │                  │
┌───▼──────┐ ┌────▼─────┐ ┌──────────▼───┐
│  Oracle   │ │   Hive   │ │Elasticsearch │
│  (recon   │ │          │ │              │
│   data)   │ │          │ │              │
└──────────┘ └──────────┘ └──────────────┘
```

---

## 18. Development Workflow

### 18.1 Local Setup

```bash
# One-command setup
make dev

# Under the hood:
# 1. docker compose up -d redis postgres
# 2. pip install apache-superset (in virtualenv)
# 3. superset db upgrade
# 4. superset fab create-admin (first time)
# 5. superset init
# 6. Register Oracle/ES/Hive connections via API
# 7. cd frontend && npm install && npm run dev
# 8. cd backend && uvicorn app.main:app --reload
```

### 18.2 Key Make Commands

```makefile
make dev          # Start full local environment
make frontend     # Start frontend only (Vite dev server)
make backend      # Start backend only (uvicorn with reload)
make superset     # Start Superset only
make test         # Run all tests
make test-fe      # Run frontend tests (Vitest)
make test-be      # Run backend tests (pytest)
make lint         # Lint frontend (ESLint) + backend (ruff)
make build        # Production build (frontend + backend Docker images)
make seed         # Seed sample data and dashboard configs
```

---

## 19. Phased Rollout

### Phase 1: Foundation (Weeks 1-6)

**Goal:** Working frontend shell + Superset integration + one dashboard

| Task | Details |
|---|---|
| Superset setup | pip install, configure Oracle/ES/Hive connections, create initial datasets |
| FastAPI backend | Superset client service, chart data proxy, dataset proxy |
| Frontend shell | React + Vite + Shadcn layout (sidebar, topbar, routing) |
| AG Grid integration | Basic grid with AG Grid Enterprise, column definitions, sorting/filtering |
| AG Charts integration | Theme matching Shadcn, basic chart wrapper component |
| First dashboard | "Recon Overview" dashboard with KPI cards, 4 charts, detail grid |
| Filter bar | Global filter bar with date range, entity, status, desk |
| Docker Compose | Full local dev environment |

### Phase 2: Interactivity (Weeks 7-10)

**Goal:** Cross-filtering, drill-down, data explorer

| Task | Details |
|---|---|
| Cross-filtering | Zustand-based cross-filter store, AG Charts onClick integration, AG Grid external filter |
| Drill-down | Breadcrumb navigation, multi-level drill from chart to grid |
| Data explorer | Monaco SQL editor, schema browser, query execution via Superset SQL Lab API |
| Query history | Store and display past queries |
| Smart caching | TanStack Query configuration, prefetching, stale-while-revalidate |
| Skeleton loaders | Loading states for every component |

### Phase 3: Polish & Sidecar (Weeks 11-14)

**Goal:** Premium UX, exports, sidecar features

| Task | Details |
|---|---|
| Animations | Framer Motion page transitions, KPI counter animations, chart load animations |
| Dark mode | Full dark mode support across all components including AG Grid |
| Command palette | Cmd+K search across dashboards, datasets, saved views |
| Export service | PDF report generation, Excel export with formatting |
| Direct ES queries | Sidecar endpoints for complex ES aggregations |
| Saved views | Save/load filter + layout combinations |
| Performance tuning | Bundle optimization, lazy loading, AG Grid performance audit |

### Phase 4: Advanced (Weeks 15-18)

**Goal:** Additional dashboards, advanced features

| Task | Details |
|---|---|
| Dashboard builder | Admin UI to configure dashboards (select charts, layout, filters) |
| Additional dashboards | 3-5 more dashboards based on team needs |
| AG Grid advanced | Pivot mode, row grouping, master/detail, sparklines |
| Custom visualizations | Domain-specific charts via ECharts (Sankey, radar, etc.) |
| Scheduled reports | Celery-based scheduled PDF/Excel generation and delivery |
| Security integration | SSO, RBAC, RLS (when ready) |

---

## 20. Open Questions & Future Considerations

### 20.1 Open Questions

| Question | Options | Decision Needed By |
|---|---|---|
| Hosting environment | On-prem K8s / Private cloud / Hybrid | Phase 1 |
| Oracle connectivity | Direct connect or via connection pool (e.g., Oracle Connection Manager)? | Phase 1 |
| Dashboard definitions | Stored in Superset (via API) or in sidecar DB (custom schema)? | Phase 1 |
| User preferences DB | PostgreSQL (with sidecar) or Redis? | Phase 2 |
| Monitoring/observability | DataDog / Grafana / ELK? | Phase 3 |
| CI/CD pipeline | Jenkins / GitHub Actions / GitLab CI? | Phase 1 |

### 20.2 Future Considerations

- **Security layer**: SSO integration (SAML/OIDC), Row-Level Security, RBAC
- **Real-time updates**: WebSocket layer for live-updating dashboards (break count changes in real-time)
- **AI/ML integration**: Natural language to SQL (LLM-powered query builder), anomaly detection on break patterns
- **Mobile responsiveness**: Responsive layouts for tablet viewing
- **Alerting**: Threshold-based alerts when break counts or aging exceed SLA
- **Data lineage**: Visual lineage from source system → recon → RecViz
- **Multi-tenant**: Support multiple recon teams with isolated views
- **Audit logging**: Track who viewed what, when, for compliance

---

## Appendix A: Superset REST API Quick Reference

```
Authentication:
  POST /api/v1/security/login
  → Returns: { access_token: "..." }

Chart Data:
  POST /api/v1/chart/data
  → Body: { query_context: { datasource: {...}, queries: [{filters, columns, metrics}] } }
  → Returns: { result: [{ data: [...] }] }

SQL Execution:
  POST /api/v1/sqllab/execute/
  → Body: { database_id, sql, schema, queryLimit }
  → Returns: { data: [...], columns: [...], query: {...} }

Datasets:
  GET  /api/v1/dataset/                    → List all datasets
  GET  /api/v1/dataset/{id}                → Dataset details + columns
  POST /api/v1/dataset/                    → Create new dataset

Charts:
  GET  /api/v1/chart/                      → List saved charts
  GET  /api/v1/chart/{id}                  → Chart definition
  POST /api/v1/chart/                      → Create chart
  PUT  /api/v1/chart/{id}                  → Update chart

Dashboards:
  GET  /api/v1/dashboard/                  → List dashboards
  GET  /api/v1/dashboard/{id}              → Dashboard + layout
  POST /api/v1/dashboard/                  → Create dashboard

Databases:
  GET  /api/v1/database/                   → List connected databases
  POST /api/v1/database/                   → Register new database
  POST /api/v1/database/test_connection    → Test connection
```

---

*This document is the source of truth for the RecViz project architecture and will be updated as decisions are made and the project evolves.*
