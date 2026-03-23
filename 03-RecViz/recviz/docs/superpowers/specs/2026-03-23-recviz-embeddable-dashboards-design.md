# RecViz Embeddable Config-Driven Dashboards

**Date:** 2026-03-23
**Status:** Draft
**Scope:** Make RecViz render config-driven dashboards embeddable via iframe in external apps. Primary use case: TLM Statistics dashboard currently rendered by a custom Angular modal in autosys-job-explorer.

---

## 1. Problem Statement

The autosys-job-explorer app has a custom-built TLM Statistics modal (Angular + Spring Boot sidecar) that shows reconciliation KPIs, charts, and data tables when users click set_id/recon/tlm_instance in a search results grid. This modal is tightly coupled, not reusable, and its Spring Boot sidecar duplicates data access patterns that RecViz is designed to handle generically.

RecViz exists to be a generic visualization platform backed by Superset as a headless query engine. However, RecViz today has hardcoded dashboard layouts, filter fields, chart configs, and KPI definitions that prevent it from rendering arbitrary dashboards.

**Goal:** Refactor RecViz to be fully config-driven and embeddable, then replace the TLM Statistics modal with a RecViz iframe embed. Retire the Spring Boot sidecar (`rectrace-tlm-stats`).

## 2. Architecture Overview

```
autosys-job-explorer (Angular)
  └── MatDialog with iframe
        └── RecViz embed URL (/embed/dashboards/:id?filter.X=Y&lock=X,Y&theme=dark)

RecViz Frontend (React SPA)
  └── DashboardRenderer (reads config, renders filter bar + KPIs + charts + grids)

RecViz Backend (FastAPI)
  └── config_store (reads dashboard + data source configs from Oracle/mock)
  └── query_engine (builds SQL, resolves dynamic DB routing, calls Superset)
  └── merge_engine (cross-source data merging)

Superset (headless query engine)
  └── Registered Oracle database connections
  └── SQL Lab API for query execution

Oracle DBs
  ├── TLM instance DBs (TCOSPRD, TFINPRD, etc.) — recon transaction data
  ├── Reconmgmt DB — manual match stats, filter metadata
  └── RecViz config DB — dashboard and data source configurations
```

## 3. Three-Layer Config Model

### Layer 1: Dashboard Config (what to show)

Stored in Oracle. Defines the UI: which filters, KPIs, charts, and grids appear on a dashboard, their layout, and their behavior.

```json
{
  "id": "tlm-stats",
  "name": "TLM Statistics Dashboard",
  "description": "Reconciliation statistics for TLM instances",

  "features": {
    "cross_filter": false,
    "drill_down": false
  },

  "filters": [
    {
      "id": "tlm_instance",
      "label": "TLM Instance",
      "type": "single-select",
      "lockable": true,
      "options_source": {
        "data_source_id": "reconmgmt_recon_bank",
        "value_column": "recon_engine_env",
        "depends_on": {}
      }
    },
    {
      "id": "recon",
      "label": "Recon (Agent Code)",
      "type": "multi-select",
      "lockable": true,
      "options_source": {
        "data_source_id": "reconmgmt_recon_bank",
        "value_column": "agent_code",
        "depends_on": {
          "tlm_instance": "recon_engine_env"
        }
      }
    },
    {
      "id": "set_id",
      "label": "Set ID",
      "type": "multi-select",
      "lockable": true,
      "options_source": {
        "data_source_id": "reconmgmt_recon_bank",
        "value_column": "local_acc_no",
        "depends_on": {
          "tlm_instance": "recon_engine_env",
          "recon": "agent_code"
        }
      }
    },
    {
      "id": "date_range",
      "label": "Date Range",
      "type": "preset-range",
      "lockable": false,
      "options": [
        { "label": "Last 1 Day", "value": 1 },
        { "label": "Last 7 Days", "value": 7 },
        { "label": "Last 30 Days", "value": 30 }
      ],
      "default_value": 1
    }
  ],

  "kpis": [
    {
      "id": "total_items",
      "label": "Total Items",
      "format": "number",
      "sources": [
        { "data_source_id": "tlm_automatch", "metric": "total_items" },
        { "data_source_id": "reconmgmt_manual", "metric": "total_manual_match_count" }
      ],
      "aggregation": "sum"
    },
    {
      "id": "breaks",
      "label": "Breaks",
      "format": "number",
      "sources": [
        { "data_source_id": "tlm_breaks", "metric": "breaks_count" }
      ],
      "aggregation": "sum",
      "trend": { "type": "percentage_of", "reference_kpi": "total_items" }
    },
    {
      "id": "automatch",
      "label": "Automatch",
      "format": "number",
      "sources": [
        { "data_source_id": "tlm_automatch", "metric": "automatch_items" }
      ],
      "aggregation": "sum",
      "trend": { "type": "percentage_of", "reference_kpi": "total_items" }
    },
    {
      "id": "manual_match",
      "label": "Manual Match",
      "format": "number",
      "sources": [
        { "data_source_id": "reconmgmt_manual", "metric": "total_manual_match_count" }
      ],
      "aggregation": "sum",
      "trend": { "type": "percentage_of", "reference_kpi": "total_items" }
    }
  ],

  "charts": [
    {
      "id": "recon-distribution",
      "title": "Recon Distribution",
      "type": "donut",
      "source_type": "kpi_values",
      "kpi_segments": [
        { "kpi_id": "breaks", "label": "Breaks", "color": "var(--chart-warning)" },
        { "kpi_id": "automatch", "label": "Automatch", "color": "var(--chart-success)" },
        { "kpi_id": "manual_match", "label": "Manual Match", "color": "var(--chart-accent)" }
      ],
      "layout": { "col": 0, "row": 0, "width": 12, "height": 2 }
    }
  ],

  "grids": [
    {
      "id": "breaks-table",
      "title": "Break Statistics",
      "data_source_id": "tlm_breaks",
      "columns": [
        { "field": "agent_code", "header": "Agent Code", "type": "string" },
        { "field": "local_acc_no", "header": "Set ID", "type": "string" },
        { "field": "stmt_date", "header": "Statement Date", "type": "date" },
        { "field": "bran_code", "header": "Branch Code", "type": "string" },
        { "field": "breaks_count", "header": "Breaks", "type": "number" }
      ],
      "visible_when": { "kpi": "breaks", "condition": "gt", "value": 0 },
      "layout": { "col": 0, "row": 2, "width": 12, "height": 3 }
    },
    {
      "id": "recon-table",
      "title": "Reconciliation Statistics",
      "sources": [
        { "data_source_id": "tlm_automatch" },
        { "data_source_id": "reconmgmt_manual" }
      ],
      "merge_on": ["agent_code", "set_id", "stmt_date"],
      "merge_type": "outer_join",
      "columns": [
        { "field": "agent_code", "header": "Agent Code", "type": "string" },
        { "field": "set_id", "header": "Set ID", "type": "string" },
        { "field": "stmt_date", "header": "Statement Date", "type": "date" },
        { "field": "bran_code", "header": "Branch Code", "type": "string" },
        { "field": "corr_acc_no", "header": "Corr Account", "type": "string" },
        { "field": "total_items", "header": "Total Items", "type": "number" },
        { "field": "automatch_items", "header": "Automatch", "type": "number" },
        { "field": "total_manual_match_count", "header": "Manual Match", "type": "number" }
      ],
      "visible_when": { "kpi": "total_items", "condition": "gt", "value": 0 },
      "layout": { "col": 0, "row": 5, "width": 12, "height": 3 }
    }
  ],

  "layout": {
    "type": "flow",
    "sections": ["filters", "kpis", "charts", "grids"]
  }
}
```

### Layer 2: Data Source Config (how to get data)

Stored in Oracle alongside dashboard configs. Defines SQL, database routing, and filter-to-SQL mappings.

```json
{
  "id": "tlm_breaks",
  "name": "TLM Break Statistics",

  "database_routing": {
    "type": "dynamic",
    "route_by_filter": "tlm_instance",
    "mapping": {
      "TLMP_CONSUMER": "superset_db_TCOSPRD",
      "TLMP_FINANCE": "superset_db_TFINPRD",
      "TLMP_WEALTH": "superset_db_TWMPRD"
    }
  },

  "query": "SELECT b.agent_code, b.local_acc_no, mf.bran_code, i.stmt_date, COUNT(*) AS breaks_count FROM bank b JOIN message_feed mf ON b.corr_acc_no = mf.corr_acc_no JOIN item i ON mf.corr_acc_no = i.corr_acc_no WHERE i.flag_2 = 0 {{filters}} GROUP BY b.agent_code, b.local_acc_no, mf.bran_code, i.stmt_date",

  "filter_mappings": [
    { "filter_id": "recon", "sql_expr": "b.agent_code IN ({{values}})" },
    { "filter_id": "set_id", "sql_expr": "b.local_acc_no IN ({{values}})" },
    { "filter_id": "date_range", "sql_expr": "i.stmt_date {{date_range_clause}}" }
  ],

  "columns": [
    { "name": "agent_code", "type": "string" },
    { "name": "local_acc_no", "type": "string" },
    { "name": "bran_code", "type": "string" },
    { "name": "stmt_date", "type": "date" },
    { "name": "breaks_count", "type": "number" }
  ]
}
```

**Static routing example** (reconmgmt — always the same DB):

```json
{
  "id": "reconmgmt_manual",
  "name": "Manual Match Statistics",

  "database_routing": {
    "type": "static",
    "database": "superset_db_reconmgmt"
  },

  "query": "SELECT agent_code, setid AS set_id, stmt_date, bran_code, corr_acc_no, total_items, automatch_items, total_manual_match_count FROM reconmgmt.mr_csum_man_match_stats_hist WHERE 1=1 {{filters}}",

  "filter_mappings": [
    { "filter_id": "tlm_instance", "sql_expr": "tlm_instance = '{{value}}'" },
    { "filter_id": "recon", "sql_expr": "agent_code IN ({{values}})" },
    { "filter_id": "set_id", "sql_expr": "setid IN ({{values}})" },
    { "filter_id": "date_range", "sql_expr": "stmt_date {{date_range_clause}}" }
  ],

  "columns": [
    { "name": "agent_code", "type": "string" },
    { "name": "set_id", "type": "string" },
    { "name": "stmt_date", "type": "date" },
    { "name": "bran_code", "type": "string" },
    { "name": "corr_acc_no", "type": "string" },
    { "name": "total_items", "type": "number" },
    { "name": "automatch_items", "type": "number" },
    { "name": "total_manual_match_count", "type": "number" }
  ]
}
```

**Automatch data source** (dynamic routing, same as breaks):

```json
{
  "id": "tlm_automatch",
  "name": "TLM Automatch Statistics",

  "database_routing": {
    "type": "dynamic",
    "route_by_filter": "tlm_instance",
    "mapping": {
      "TLMP_CONSUMER": "superset_db_TCOSPRD",
      "TLMP_FINANCE": "superset_db_TFINPRD",
      "TLMP_WEALTH": "superset_db_TWMPRD"
    }
  },

  "query": "SELECT b.agent_code, b.local_acc_no AS set_id, mf.bran_code, i.stmt_date, mf.corr_acc_no, COUNT(CASE WHEN i.flag_2 IN (0,1,11) THEN 1 END) AS total_items, COUNT(CASE WHEN th.last_action_owner IN ('SYSTEM','system','AUTONET') AND i.flag_2 = 1 THEN 1 END) AS automatch_items FROM bank b JOIN message_feed mf ON b.corr_acc_no = mf.corr_acc_no JOIN item i ON mf.corr_acc_no = i.corr_acc_no LEFT JOIN tlm_bdr_relationship_header th ON i.corr_acc_no = th.corr_acc_no WHERE 1=1 {{filters}} GROUP BY b.agent_code, b.local_acc_no, mf.bran_code, i.stmt_date, mf.corr_acc_no",

  "filter_mappings": [
    { "filter_id": "recon", "sql_expr": "b.agent_code IN ({{values}})" },
    { "filter_id": "set_id", "sql_expr": "b.local_acc_no IN ({{values}})" },
    { "filter_id": "date_range", "sql_expr": "i.stmt_date {{date_range_clause}}" }
  ],

  "columns": [
    { "name": "agent_code", "type": "string" },
    { "name": "set_id", "type": "string" },
    { "name": "bran_code", "type": "string" },
    { "name": "stmt_date", "type": "date" },
    { "name": "corr_acc_no", "type": "string" },
    { "name": "total_items", "type": "number" },
    { "name": "automatch_items", "type": "number" }
  ]
}
```

Note: `tlm_automatch` aliases `b.local_acc_no` as `set_id` to match the `merge_on` key used in the recon-table grid merge with `reconmgmt_manual`.

**Filter options data source** (for cascading dropdowns):

```json
{
  "id": "reconmgmt_recon_bank",
  "name": "Recon Bank Filter Source",

  "database_routing": {
    "type": "static",
    "database": "superset_db_reconmgmt"
  },

  "query": "SELECT DISTINCT {{column}} FROM recon_bank WHERE recon_engine = 'TLM' {{filters}}",

  "filter_mappings": [
    { "filter_id": "tlm_instance", "sql_expr": "recon_engine_env = '{{value}}'" },
    { "filter_id": "recon", "sql_expr": "agent_code = '{{value}}'" }
  ],

  "columns": [
    { "name": "recon_engine_env", "type": "string" },
    { "name": "agent_code", "type": "string" },
    { "name": "local_acc_no", "type": "string" }
  ]
}
```

### Template Variable: `{{date_range_clause}}`

The `date_range` filter type uses a special template variable `{{date_range_clause}}` that the query engine expands based on the numeric preset value and the target database dialect.

**Oracle (production):**
- `1` (Last 1 Day): `BETWEEN TRUNC(SYSDATE) - DECODE(TO_CHAR(SYSDATE,'D'), '1',2, '2',3, '7',1, 1) AND SYSDATE` (business-day aware, matches existing sidecar logic)
- `7` (Last 7 Days): `BETWEEN SYSDATE - 7 AND SYSDATE`
- `30` (Last 30 Days): `BETWEEN SYSDATE - 30 AND SYSDATE`

**PostgreSQL (dev mock):**
- `1`: `BETWEEN CURRENT_DATE - INTERVAL '1 day' AND CURRENT_DATE`
- `7`: `BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE`
- `30`: `BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE`

The query engine determines the dialect from the Superset database connection metadata (or from a `dialect` field on the data source config if needed).

### Layer 3: Superset (SQL execution engine)

Superset holds registered database connections only. Each Oracle DB is a separate Superset database. RecViz sends SQL via Superset's SQL Lab API and receives tabular results.

Registered databases:
- One per TLM instance Oracle DB (TCOSPRD, TFINPRD, TWMPRD, etc.)
- One for the Reconmgmt Oracle DB
- One for the RecViz config Oracle DB

## 4. Backend Design

### API Endpoints

```
Dashboard Config:
  GET  /api/dashboards                         → list all dashboards
  GET  /api/dashboards/:id                     → full dashboard config (filters, KPIs, charts, grids)

KPI Data:
  POST /api/dashboards/:id/kpis                → batched KPI computation
       Body: { filters: { tlm_instance: "X", recon: ["Y"], date_range: 1 } }
       Returns: { kpis: [{ id, value, percentage? }, ...] }

Data Source Execution:
  POST /api/data-sources/:id/query             → execute a data source with filters
       Body: { filters: {...} }
       Returns: { columns: [...], rows: [...], row_count: N }

  POST /api/data-sources/merge                 → execute + merge multiple data sources
       Body: { sources: ["id1", "id2"], merge_on: [...], merge_type: "outer_join", filters: {...} }
       Returns: { columns: [...], rows: [...], row_count: N }

Filter Options:
  GET  /api/data-sources/:id/distinct/:column  → distinct values for cascading filters
       Query params: filter.X=Y (parent filter values for cascading)
       Returns: { values: ["VAL1", "VAL2", ...] }
```

### Service Layer

```
app/
├── api/
│   ├── dashboards.py          → dashboard config endpoints
│   ├── data_sources.py        → query execution, merge, distinct values
│   └── router.py              → aggregates all routers
├── services/
│   ├── superset_client.py     → existing: talks to Superset REST API
│   ├── config_store.py        → NEW: reads dashboard + data source configs (Oracle or mock)
│   ├── query_engine.py        → NEW: builds SQL, resolves DB routing, calls Superset
│   └── merge_engine.py        → NEW: merges results from multiple data sources
├── models/
│   ├── dashboard_config.py    → NEW: Pydantic models for dashboard config schema
│   └── data_source_config.py  → NEW: Pydantic models for data source config schema
└── core/
    └── dependencies.py        → existing: FastAPI dependency injection
```

### Request Flow

```
1. Frontend: POST /api/dashboards/tlm-stats/kpis
   Body: { filters: { tlm_instance: "TLMP_CONSUMER", recon: ["AGENT_01"], date_range: 1 } }

2. dashboards.py:
   a. Load dashboard config from config_store
   b. For each KPI in config:
      - For each source in KPI.sources:
        - Load data source config
        - Call query_engine.execute(data_source, filters)
      - Aggregate results per KPI.aggregation
   c. Compute cross-KPI percentages (e.g., breaks % of total_items)
   d. Return computed KPIs

3. query_engine.execute(data_source="tlm_breaks", filters):
   a. Load data source config
   b. Resolve DB: route_by_filter="tlm_instance" → mapping["TLMP_CONSUMER"] → "superset_db_TCOSPRD"
   c. Build SQL: replace {{filters}} with filter_mappings applied to filter values
   d. Call superset_client.execute_sql(database_id="superset_db_TCOSPRD", sql=built_sql)
   e. Return rows

4. For merged grids:
   a. query_engine runs each source query independently
   b. merge_engine joins results on specified keys
   c. Return merged rows
```

### Mock Strategy

```python
# query_engine.py
class QueryEngine:
    async def execute(self, data_source_id: str, filters: dict) -> QueryResult:
        if self.superset_client:
            return await self._execute_via_superset(data_source_id, filters)
        else:
            return await self._execute_mock(data_source_id, filters)

    async def _execute_mock(self, data_source_id: str, filters: dict) -> QueryResult:
        # Returns mock data matching the exact response shape Superset would return.
        # Mock data is keyed by data_source_id.
        return MOCK_QUERY_RESULTS.get(data_source_id, QueryResult.empty())
```

Mock data mirrors Superset's response shape exactly. Switching from mock to real Superset is a config change (set `SUPERSET_URL` to a running instance). Frontend code is identical in both modes.

## 5. Frontend Design

### Core Concept: DashboardRenderer

One generic component that reads dashboard config and renders everything dynamically:

```
DashboardRenderer (receives dashboard config + mode)
  ├── ConfigDrivenFilterBar
  │     └── renders filters from config.filters[]
  │     └── each filter: SingleSelect | MultiSelect | PresetRange
  │     └── cascading: depends_on triggers re-fetch of options
  │     └── locked filters: lock icon, non-interactive
  │     └── Apply/Reset buttons (data fetches only on Apply)
  ├── KpiRow
  │     └── renders KPIs from config.kpis[]
  │     └── CountAnimation for values, percentage display for trends
  ├── ChartGrid
  │     └── renders charts from config.charts[]
  │     └── supports source_type: "kpi_values" (donut from KPI data)
  │     └── supports source_type: "query" (chart from data source query)
  │     └── layout from config (CSS Grid, 12-column)
  └── DataGridSection
        └── renders grids from config.grids[]
        └── single-source or multi-source (merged)
        └── conditional visibility via visible_when
        └── AG Grid with columns from config
```

### Routing

TanStack Router's current `__root.tsx` unconditionally renders `AppSidebar` + `Header`. The embed route must bypass this. Solution: restructure using TanStack Router's pathless layout routes.

```
routes/
  __root.tsx                   → minimal: just ThemeProvider + QueryClientProvider (no shell)
  _app.tsx                     → pathless layout: wraps children with SidebarProvider + AppSidebar + Header
  _app/
    dashboards/
      index.tsx                → dashboard list (existing)
      $dashboardId.tsx         → full app mode: DashboardRenderer inside app shell
    explorer/
      index.tsx                → SQL explorer (existing)
    reports/
      index.tsx                → reports (existing)
    settings/
      index.tsx                → settings (existing)
  embed/
    dashboards/
      $dashboardId.tsx         → embed mode: thin topbar + DashboardRenderer (no app shell)
```

`_app.tsx` is a pathless layout route — it doesn't add a URL segment but wraps all its children with the sidebar/header shell. The `embed/` route tree sits outside `_app/`, so it renders without any shell chrome.

Both use the same `DashboardRenderer`. The embed route:
- Has no sidebar or header
- Displays a thin topbar: dashboard title + "Open in RecViz" link
- Reads `&theme=dark|light` URL param
- Reads `&filter.X=Y` params to pre-set filters
- Reads `&lock=X,Y` param to lock filters

"Open in RecViz" constructs: `/dashboards/:id?filter.X=Y` (same params, full app route, new tab).

### Filter Store Refactor

```typescript
// Before: hardcoded shape
interface GlobalFilters {
  dateFrom: string
  dateTo: string
  entities: string[]
  counterparties: string[]
  statuses: string[]
  desk: string
}

// After: generic, keyed by filter ID from dashboard config
type FilterValue = string | string[] | number

interface FilterState {
  values: Record<string, FilterValue>       // current filter selections
  locked: Set<string>                       // filter IDs locked by URL params
  applied: Record<string, FilterValue>      // snapshot at last "Apply" click
}
```

Cross-filter and drill-down stores remain unchanged but only activate when `dashboard.features.cross_filter` or `dashboard.features.drill_down` is `true`.

### Hooks

```
use-dashboard-config.ts    → GET /api/dashboards/:id
                              Returns full dashboard config.
                              queryKey: ['dashboard-config', dashboardId]

use-dashboard-kpis.ts      → POST /api/dashboards/:id/kpis
                              Batched KPI computation. Server-side aggregation
                              and cross-KPI percentage computation.
                              queryKey: ['dashboard-kpis', dashboardId, appliedFilters]

use-data-source-query.ts   → POST /api/data-sources/:id/query
                              For charts and single-source grids.
                              queryKey: ['data-source', dataSourceId, appliedFilters]

use-data-source-merge.ts   → POST /api/data-sources/merge
                              For multi-source grids.
                              queryKey: ['data-source-merge', sourceIds, mergeConfig, appliedFilters]

use-filter-options.ts      → GET /api/data-sources/:id/distinct/:column
                              For cascading filter dropdowns.
                              queryKey: ['filter-options', dataSourceId, column, parentFilterValues]
```

### Component Changes Summary

| Component | Change |
|---|---|
| `filter-bar.tsx` | Refactor: reads `dashboard.filters[]`, renders controls by type, supports locking |
| `kpi-row.tsx` | Refactor: reads KPI data from `useDashboardKpis`, renders from config |
| `chart-grid.tsx` | Refactor: reads `dashboard.charts[]`, layout from config, supports `kpi_values` source |
| `data-grid.tsx` | Refactor: reads `dashboard.grids[]`, columns from config, supports multi-grid |
| `chart-panel.tsx` | Minor: title/description from config instead of hardcoded |
| `chart-factory.tsx` | No change (already generic) |
| `ag-chart-wrapper.tsx` | No change (already generic) |
| `echart-wrapper.tsx` | No change (already generic) |
| `count-animation.tsx` | No change (already generic) |
| `filter-store.ts` | Refactor: generic `Record<string, FilterValue>` instead of hardcoded type |
| `$dashboardId.tsx` | Refactor: uses `DashboardRenderer` |
| `embed/$dashboardId.tsx` | New: embed route with thin topbar |

### Progressive Loading

```
1. Dashboard config loads        → render filter bar skeleton + KPI skeletons
2. Filter options load           → filter dropdowns become interactive
3. KPIs load (POST /kpis)        → CountAnimation roll-up
4. Charts load (parallel)        → fade-in animation
5. Grids load (parallel)         → AG Grid populates
```

Steps 3-5 happen in parallel after the user clicks Apply (or on initial load with default/URL-provided filters).

## 6. Autosys-job-explorer Changes

### Modified Files

Three V2 cell renderers change their click handler:

- `set-id-v2-renderer.component.ts`
- `recon-v2-renderer.component.ts`
- `tlm-instance-v2-renderer.component.ts`

Each swaps `this.dialog.open(TlmStatsModalV2Component, ...)` with `this.dialog.open(RecvizEmbedDialogComponent, ...)`.

### New Component: RecvizEmbedDialogComponent

A minimal Angular component: MatDialog wrapper containing an iframe.

```typescript
@Component({
  template: `
    <div mat-dialog-content style="padding:0; height:100%; overflow:hidden;">
      <iframe [src]="safeUrl" width="100%" height="100%" frameBorder="0"></iframe>
    </div>
  `
})
export class RecvizEmbedDialogComponent {
  safeUrl: SafeResourceUrl;

  constructor(
    @Inject(MAT_DIALOG_DATA) data: { url: string },
    sanitizer: DomSanitizer
  ) {
    this.safeUrl = sanitizer.bypassSecurityTrustResourceUrl(data.url);
  }
}
```

### URL Construction

Each renderer builds the RecViz embed URL based on entry point:

| Entry Point | URL Params |
|---|---|
| `set_id` click | `filter.tlm_instance=X&filter.recon=Y&filter.set_id=Z&lock=tlm_instance,recon,set_id` |
| `recon` click | `filter.tlm_instance=X&filter.recon=Y&lock=tlm_instance,recon` |
| `tlm_instance` click | `filter.tlm_instance=X&lock=tlm_instance` |

All URLs include `&theme=dark` (matching the Angular app's dark theme).

### Environment Config

```typescript
// environment.ts
export const environment = {
  // ...existing config
  recvizUrl: 'http://localhost:5173'  // RecViz frontend URL
};
```

### Retirement Plan (future, not part of this scope)

Once RecViz embed is validated end-to-end:
- Remove `TlmStatsModalV2Component` and all child components
- Remove `TlmStatsV2Service` (Angular service)
- Decommission `rectrace-tlm-stats` Spring Boot sidecar

Both paths (old modal + new iframe) can coexist during development.

## 7. Mock Data Strategy

For local development without Oracle:

- Dashboard configs and data source configs: JSON files loaded by `config_store.py` when Oracle is unavailable
- Query results: `MOCK_QUERY_RESULTS` dict in `mock_data.py` keyed by data_source_id, returning data that matches the exact shape Superset would return
- Filter options: mock distinct values for each filter column

Switching to real Oracle + Superset:
1. Set `SUPERSET_URL` to running Superset instance
2. Register Oracle DBs in Superset
3. Insert dashboard + data source configs into Oracle config DB
4. Frontend code is identical — zero changes

## 8. Embed Mode Details

### URL Format

```
/embed/dashboards/:dashboardId?filter.X=val&filter.Y=val1,val2&lock=X,Y&theme=dark
```

- `filter.*` params pre-set filter values (comma-separated for multi-select)
- `lock` param specifies which filters are locked (non-interactive, shows lock icon)
- `theme` param controls light/dark mode

### Embed UI

- No sidebar, no header, no breadcrumbs, no command palette
- Thin topbar (~36px): dashboard title (left) + "Open in RecViz" button (right)
- "Open in RecViz" opens `/dashboards/:id?filter.X=Y` in a new tab (full app, same filters)
- Same `DashboardRenderer` as full app mode
- CORS/X-Frame-Options configured to allow embedding from same-server origins

## 9. Key Design Decisions

| Decision | Rationale |
|---|---|
| Three-layer config (dashboard / data source / Superset) | Separates "what to show" from "how to get data" from "where data lives" |
| Application-layer data merging | Industry standard (Tableau data blending, Power BI composite models). Superset can't cross-DB join. |
| Dynamic DB routing in data source config | Maps TLM instance filter values to Superset database IDs. Keeps routing declarative, not hardcoded in backend. |
| Batched KPI endpoint | Avoids N frontend queries + client-side percentage computation. Server handles aggregation. |
| Donut chart from KPI values | Prevents duplicate queries. Chart segments derive from already-computed KPI values. |
| Generic filter store | `Record<string, FilterValue>` instead of hardcoded type. Any dashboard config works. |
| Feature-first approach | Refactor existing components driven by TLM Stats requirements (YAGNI). |
| Config stored in Oracle | Per project requirement. Schema designed to be UI-friendly for future dashboard builder. |
| Seed script for initial config | Laser focus on rendering, not building a config editor. Schema supports future UI. |
| iframe embed now, microfrontend later | Simplest integration path. Same-server deployment avoids CORS complexity. |

## 10. Out of Scope

- Authentication / authorization
- Dashboard builder UI (config editor)
- Reports page, SQL Explorer, Settings fixes
- Existing `recon-overview` dashboard migration
- Celery task queue / async jobs
- Elasticsearch integration
- RecViz microfrontend / web component export (future phase)
