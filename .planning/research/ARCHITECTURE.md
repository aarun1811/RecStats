# Architecture Research: Dashboard Builder for RecViz

**Domain:** Internal BI platform with dashboard builder -- brownfield evolution from config-driven rendering to UI-based builder
**Researched:** 2026-04-04
**Confidence:** HIGH (existing codebase thoroughly documented, industry patterns well-established)

---

## System Overview

The dashboard builder adds a **design-time layer** on top of the existing **runtime layer**. The existing system already handles rendering dashboards from JSON config. The builder gives business users a UI to produce those configs instead of requiring developers to hand-write JSON files.

```
                          DESIGN-TIME (new)                    RUNTIME (existing, evolved)
                     ========================             ===========================

                     +---------------------+
                     |   Dataset Manager   |  (dev team)
                     |   - SQL editor      |
                     |   - Column metadata  |
                     |   - Filter mappings  |
                     +----------+----------+
                                |
                         dataset registry
                                |
                     +----------v----------+
                     |  Dashboard Builder  |  (business users)
                     |  - Layout editor    |
                     |  - Chart builder    |
                     |  - Filter config    |
                     |  - KPI config       |
                     +----------+----------+
                                |
                        saves DashboardConfig
                                |
              +-----------------v-----------------+
              |        Config Persistence         |
              |  (DB-backed, replaces JSON files) |
              +-----------------+-----------------+
                                |
                     reads DashboardConfig
                                |
              +-----------------v-----------------+
              |       Dashboard Renderer          |  (existing, minimal changes)
              |  FilterBar > KPIs > Charts > Grid |
              +-----------------+-----------------+
                                |
                          API calls
                                |
              +-----------------v-----------------+
              |          FastAPI Backend           |
              |  - Query Engine (existing)         |
              |  - Config CRUD (new)               |
              |  - Dataset Metadata (new)           |
              +-----------------+-----------------+
                                |
              +-----------------v-----------------+
              |     Superset (headless engine)     |
              |  - SQL execution                   |
              |  - DB connectivity                 |
              |  - Query caching (Redis)           |
              +-----------------+-----------------+
                                |
              +-----------------v-----------------+
              |         Data Sources               |
              |  Oracle | Hive | Elasticsearch     |
              +-----------------------------------+
```

### Key Architectural Insight

The existing config-driven system already separates **"what to render"** (DashboardConfig JSON) from **"how to render"** (DashboardRenderer + components). The dashboard builder is a **config authoring UI** -- it produces the same DashboardConfig structure that the renderer already consumes. This is the single most important architectural decision: **do not create a parallel rendering path for the builder.** Both builder preview and production view use the same renderer.

---

## Component Boundaries

### 1. Dataset Manager (Dev-Team Tool)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Create, edit, validate, and publish datasets that business users consume |
| **Users** | Dev team only (SQL expertise required) |
| **Communicates with** | FastAPI backend (dataset CRUD), Superset (table metadata, SQL validation) |
| **Output** | DatasetConfig objects stored in DB (evolved from JSON files) |

**What a Dataset contains:**
- Unique ID and human-readable name
- Database routing (static or dynamic)
- SQL template with `{{filter}}` placeholders
- Column definitions (name, type, label, description, aggregation hints)
- Filter mappings (which filter IDs map to which SQL expressions)
- Allowed distinct columns (for populating filter dropdowns)
- Validation status (tested/untested)

**Why this is separate from the dashboard builder:** Business users should never see SQL. They pick from a catalog of named datasets with documented columns. The dev team owns the data layer; business users own the presentation layer.

### 2. Dashboard Builder (Business User Tool)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Visual dashboard authoring: layout, widget placement, chart configuration, filter setup |
| **Users** | Business users (recon analysts, team leads) |
| **Communicates with** | Dataset registry (metadata only), FastAPI backend (save/load configs), Dashboard Renderer (live preview) |
| **Output** | DashboardConfig objects stored in DB |

**Sub-components:**

| Sub-component | Responsibility |
|---------------|----------------|
| **Layout Editor** | Drag-and-drop grid for positioning widgets; resize handles; snap-to-grid |
| **Widget Palette** | Catalog of addable widgets: KPI card, chart, data grid, text/heading |
| **Chart Configurator** | Side panel: pick dataset, map columns to axes/metrics, select chart type, preview |
| **Filter Configurator** | Define global filters: pick dataset column, filter type, cascading dependencies |
| **KPI Configurator** | Define KPI cards: pick dataset + metric column, aggregation, trend reference |
| **Properties Panel** | Per-widget settings: title, colors, conditional visibility, cross-filter participation |

### 3. Dashboard Renderer (Existing, Evolved)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Render a DashboardConfig into interactive UI with filters, charts, grids |
| **Users** | All users (view mode) + Builder (preview mode) |
| **Communicates with** | FastAPI backend (data queries), Zustand stores (filter/cross-filter/drill state) |
| **Input** | DashboardConfig (from DB or from builder's in-memory draft) |

**Evolution needed:**
- Accept config from DB-backed API (currently: static JSON)
- Support cross-filtering (currently: only in legacy components)
- Support drill-down (currently: only in legacy components)
- Support chart panel features (export, fullscreen) -- currently missing in config-driven system
- Accept a `mode` prop: `'view'` (normal) vs `'preview'` (inside builder, no editing)

### 4. Config Persistence Layer (New)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | CRUD for DashboardConfig and DatasetConfig; versioning; draft/published states |
| **Communicates with** | PostgreSQL (or Oracle in prod) via SQLAlchemy |
| **Replaces** | JSON files in `backend/app/config/` |

### 5. FastAPI Backend (Existing, Extended)

| Aspect | Detail |
|--------|--------|
| **New routes** | Dashboard CRUD, Dataset CRUD, dataset metadata queries, column introspection |
| **Extended routes** | Dashboard rendering now reads from DB instead of JSON files |
| **Unchanged** | Query engine, Superset proxy, SQL executor, merge engine |

### 6. Superset Engine (Unchanged)

No changes needed. Continues to serve as headless SQL execution engine.

---

## Data Flow

### Flow 1: Dataset Creation (Dev Team)

```
Dev opens Dataset Manager
  |
  +--> Selects target database connection
  |      (from Superset-registered databases)
  |
  +--> Writes SQL query in Monaco editor
  |      SELECT agent_code, stmt_date, COUNT(*) AS breaks
  |      FROM bank b JOIN item i ON ...
  |      WHERE {{filters}}
  |      GROUP BY agent_code, stmt_date
  |
  +--> "Validate" button executes SQL via Superset
  |      with sample filter values
  |      Returns column names + types
  |
  +--> System auto-detects column metadata:
  |      - name: from SQL result columns
  |      - type: string/number/date (from DB types)
  |      - label: default = titleCase(name), editable
  |      - description: empty, editable
  |      - aggregatable: true for number columns
  |      - groupable: true for string/date columns
  |
  +--> Dev configures filter mappings:
  |      filter_id: "recon" --> sql_expr: "b.agent_code IN ({{values}})"
  |      filter_id: "date_range" --> sql_expr: "i.stmt_date {{date_range_clause}}"
  |
  +--> Dev sets database routing:
  |      Static: always "superset_db_reconmgmt"
  |      Dynamic: route by filter "tlm_instance" with mapping
  |
  +--> Saves DatasetConfig to DB
  |      Status: "published" (available to dashboard builder)
  |
  +--> Dataset appears in builder's dataset catalog
```

### Flow 2: Dashboard Building (Business User)

```
User opens Dashboard Builder
  |
  +--> Starts from blank canvas or template
  |      Template = pre-populated DashboardConfig (e.g., "KPI + Charts + Grid")
  |
  +--> LAYOUT PHASE: Arranges widgets on grid
  |    +-- Drags "KPI Card" widget from palette --> grid position (0,0) size 3x1
  |    +-- Drags "Chart" widget from palette --> grid position (0,1) size 6x2
  |    +-- Drags "Data Grid" widget --> grid position (0,3) size 12x3
  |    +-- Resizes, repositions via drag handles
  |    +-- Layout auto-saved as array of {widgetId, x, y, w, h}
  |
  +--> CONFIGURE PHASE: Configures each widget
  |    |
  |    +-- Clicks KPI card widget:
  |    |   Properties panel opens on right
  |    |   - Select dataset: "TLM Break Statistics"
  |    |   - Select metric column: "breaks_count"
  |    |   - Aggregation: SUM
  |    |   - Label: "Total Breaks"
  |    |   - Trend: percentage_of "total_items"
  |    |   Preview updates live
  |    |
  |    +-- Clicks Chart widget:
  |    |   Chart configurator panel opens
  |    |   Step 1: Select dataset --> columns list loads
  |    |   Step 2: Chart type picker (bar, line, pie, donut...)
  |    |   Step 3: Map columns:
  |    |     - Category axis (X): "agent_code" (string column)
  |    |     - Value axis (Y): "breaks_count" (number column, AGG: SUM)
  |    |     - Optional: Series/Group by: "stmt_date"
  |    |   Step 4: Appearance (colors, legend position)
  |    |   Preview chart renders with real data (sampled)
  |    |
  |    +-- Clicks Data Grid widget:
  |        - Select dataset(s) (single or merge)
  |        - Choose visible columns, ordering, default sort
  |        - Conditional visibility (show when KPI > threshold)
  |
  +--> FILTER PHASE: Defines global filters
  |    +-- Add filter:
  |    |   - Pick dataset for options source
  |    |   - Pick column for values
  |    |   - Filter type: single-select / multi-select / date-range / preset-range
  |    |   - Set cascading dependencies (filter B depends on filter A's selection)
  |    |   - Default value
  |    +-- Filter order (drag to reorder)
  |
  +--> INTERACTION PHASE: Configure cross-filtering
  |    +-- Toggle cross-filtering ON for dashboard
  |    +-- For each chart: opt-in/opt-out of cross-filtering
  |    +-- Define field mappings (which field in source chart maps to target charts)
  |    +-- Auto-mapped when datasets share column names
  |
  +--> SAVE: Produces DashboardConfig
       - Draft: saved but not visible to other users
       - Publish: visible to all users
       - Version: previous version preserved
```

### Flow 3: Dataset Metadata to Chart Configuration UI

This is the critical data flow that makes the builder usable. When a business user configures a chart, they need to understand what data is available without seeing SQL.

```
User clicks "Select Dataset" in chart configurator
  |
  +--> Frontend fetches: GET /api/datasets/catalog
  |    Returns: [{id, name, description, columnCount, lastValidated}]
  |    Displayed as searchable list with descriptions
  |
  +--> User selects "TLM Break Statistics"
  |
  +--> Frontend fetches: GET /api/datasets/{id}/metadata
  |    Returns:
  |    {
  |      id: "tlm_breaks",
  |      name: "TLM Break Statistics",
  |      description: "Break counts by agent, set, date",
  |      columns: [
  |        {name: "agent_code", type: "string", label: "Agent Code",
  |         description: "Recon agent identifier",
  |         roles: ["dimension", "groupable", "filterable"]},
  |        {name: "stmt_date", type: "date", label: "Statement Date",
  |         roles: ["dimension", "groupable", "filterable", "temporal"]},
  |        {name: "breaks_count", type: "number", label: "Breaks",
  |         roles: ["measure", "aggregatable"],
  |         defaultAggregation: "sum"}
  |      ],
  |      availableFilters: ["recon", "set_id", "date_range"],
  |      sampleRowCount: 5000
  |    }
  |
  +--> Chart type picker filters options by column availability:
  |    - Line/Area: requires >= 1 temporal + >= 1 measure --> enabled
  |    - Bar: requires >= 1 dimension + >= 1 measure --> enabled
  |    - Pie/Donut: requires >= 1 dimension + exactly 1 measure --> enabled
  |    - Scatter: requires >= 2 measures --> disabled (only 1 measure column)
  |    - Sankey: requires >= 2 dimensions + 1 measure --> disabled
  |
  +--> Column mapping dropdowns filtered by role:
       - X-axis: shows only columns with "dimension" or "temporal" role
       - Y-axis: shows only columns with "measure" role
       - Group by: shows only columns with "groupable" role
       - Aggregation dropdown: SUM, COUNT, AVG, MIN, MAX (for measure columns)
```

### Flow 4: Cross-Filtering (Client-Side, Zero Network Calls)

```
All charts on dashboard share a data cache (TanStack Query)
  |
  +--> User clicks "Operations" bar in "Breaks by Desk" chart
  |
  +--> AG Charts onClick callback fires
  |    event: {field: "desk", value: "Operations", chartId: "breaks-by-desk"}
  |
  +--> Cross-filter middleware checks DashboardConfig.crossFilterRules:
  |    Rule: {source: "breaks-by-desk", sourceField: "desk",
  |           targets: ["*"], targetField: "desk"}
  |
  +--> Zustand filter store: addCrossFilter({chartId, field, value})
  |    Toggle behavior: clicking same value removes the filter
  |
  +--> All subscribed chart components re-render:
  |    |
  |    +-- Each chart's hook calls: applyCrossFilters(cachedData, crossFilters, myChartId)
  |    |   - Filters rows where data[targetField] === crossFilterValue
  |    |   - Excludes self (source chart doesn't filter itself)
  |    |   - Returns filtered array
  |    |
  |    +-- Source chart: dims non-selected items via makeItemStyler()
  |    |   (opacity: 0.3 for unselected, 1.0 for selected)
  |    |
  |    +-- KPI cards: recompute aggregations from filtered data
  |    |
  |    +-- Data grid: applies AG Grid external filter model
  |    |   isExternalFilterPresent() + doesExternalFilterPass()
  |
  +--> CrossFilterBar component renders active filter badges
       Each badge: "Desk: Operations [x]"
       Click [x] to remove that cross-filter

  Total latency: < 16ms (single frame, no network)
```

### Flow 5: Drill-Down (Hybrid Client + Server)

```
Dashboard chart shows monthly aggregation (Level 0)
  |
  +--> User clicks "January 2026" bar
  |
  +--> Drill-down handler checks DashboardConfig.drillDown config:
  |    levels: [
  |      {name: "monthly", groupBy: "month(stmt_date)", aggregation: "sum"},
  |      {name: "daily", groupBy: "stmt_date", aggregation: "sum"},
  |      {name: "detail", groupBy: null, aggregation: null}  // raw rows
  |    ]
  |
  +--> Level 0 -> Level 1 transition:
  |    drillStore.drillDown({column: "month", value: "2026-01"})
  |    Breadcrumb: [All] > January 2026
  |
  |    Strategy: CLIENT-SIDE if data granularity allows
  |    - Daily data already in cache from the monthly query
  |    - reaggregateByField(cachedData, "stmt_date", "sum")
  |    - Filter to month === "2026-01"
  |    - Re-render chart with daily breakdown
  |
  +--> User clicks "Jan 15" bar
  |
  +--> Level 1 -> Level 2 transition:
  |    drillStore.drillDown({column: "stmt_date", value: "2026-01-15"})
  |    Breadcrumb: [All] > January 2026 > Jan 15
  |
  |    Strategy: SERVER-SIDE (detail rows need a new query)
  |    - New query: SELECT * FROM ... WHERE stmt_date = '2026-01-15' {{filters}}
  |    - TanStack Query fires with drill-specific query key
  |    - AG Grid renders individual break records
  |
  +--> Breadcrumb navigation:
       Click "January 2026" to go back to Level 1
       Click "All" to reset to Level 0
       Each level restores the chart/grid appropriate for that depth
```

---

## Recommended Project Structure (New/Modified Files)

```
frontend/src/
  |
  +-- components/
  |   +-- builder/                          # NEW: Dashboard builder UI
  |   |   +-- dashboard-builder.tsx         # Main builder layout (canvas + panels)
  |   |   +-- builder-toolbar.tsx           # Top toolbar (save, publish, preview, undo/redo)
  |   |   +-- builder-canvas.tsx            # react-grid-layout wrapper for widget placement
  |   |   +-- widget-palette.tsx            # Left sidebar: draggable widget types
  |   |   +-- properties-panel.tsx          # Right sidebar: selected widget configuration
  |   |   +-- chart-configurator.tsx        # Chart-specific config (dataset, columns, type)
  |   |   +-- kpi-configurator.tsx          # KPI card config (dataset, metric, trend)
  |   |   +-- grid-configurator.tsx         # Data grid config (dataset, columns, merge)
  |   |   +-- filter-configurator.tsx       # Filter bar config (datasets, cascading)
  |   |   +-- cross-filter-configurator.tsx # Cross-filter rules editor
  |   |   +-- drill-configurator.tsx        # Drill-down levels editor
  |   |   +-- dataset-picker.tsx            # Reusable dataset selection component
  |   |   +-- column-mapper.tsx             # Column-to-axis mapping UI
  |   |   +-- template-picker.tsx           # Start from template dialog
  |   |
  |   +-- dataset/                          # NEW: Dataset management UI (dev team)
  |   |   +-- dataset-manager.tsx           # Dataset list + CRUD
  |   |   +-- dataset-editor.tsx            # SQL editor + column config + validation
  |   |   +-- column-editor.tsx             # Column metadata editing (labels, types, roles)
  |   |   +-- filter-mapping-editor.tsx     # Filter-to-SQL mapping editor
  |   |   +-- dataset-validator.tsx         # Test execution + preview results
  |   |
  |   +-- dashboard/                        # EXISTING: evolved
  |   |   +-- dashboard-renderer.tsx        # Add mode prop, cross-filter, drill-down
  |   |   +-- config-filter-bar.tsx         # Unchanged
  |   |   +-- config-kpi-row.tsx            # Add cross-filter awareness
  |   |   +-- config-chart-grid.tsx         # Add ChartPanel wrapper, cross-filter, drill
  |   |   +-- config-data-grid.tsx          # Add cross-filter external filter
  |   |   +-- cross-filter-bar.tsx          # MIGRATE from legacy, integrate with config system
  |   |   +-- drill-breadcrumb.tsx          # MIGRATE from legacy, integrate with config system
  |   |   +-- chart-panel.tsx               # MIGRATE from legacy (export, fullscreen, refresh)
  |
  +-- stores/
  |   +-- filter-store.ts                   # EXISTING: add cross-filter toggle behavior
  |   +-- drill-store.ts                    # EXISTING: unchanged
  |   +-- builder-store.ts                  # NEW: builder state (selected widget, draft config,
  |                                         #   undo/redo stack, dirty flag)
  |
  +-- hooks/
  |   +-- use-dashboard-config.ts           # EXISTING: point to DB-backed API
  |   +-- use-dataset-catalog.ts            # NEW: fetch dataset list for builder
  |   +-- use-dataset-metadata.ts           # NEW: fetch column metadata for chart config
  |   +-- use-dashboard-crud.ts             # NEW: save/publish/delete dashboards
  |   +-- use-dataset-crud.ts               # NEW: dataset CRUD for dataset manager
  |   +-- use-cross-filter.ts               # EXISTING: integrate with config-driven system
  |   +-- use-drill-down.ts                 # EXISTING: integrate with config-driven system
  |
  +-- types/
      +-- dashboard-config.ts               # EXISTING: extend with cross-filter rules,
      |                                     #   drill-down config, widget IDs
      +-- dataset-metadata.ts               # NEW: column roles, aggregation hints
      +-- builder.ts                        # NEW: builder-specific types (draft state, etc.)

backend/app/
  |
  +-- api/
  |   +-- dashboards.py                     # EXISTING: add CRUD (create, update, delete, publish)
  |   +-- datasets_v2.py                    # NEW: dataset CRUD for builder + metadata endpoint
  |   +-- data_sources.py                   # EXISTING: unchanged (query execution)
  |
  +-- services/
  |   +-- config_store.py                   # REPLACE: DB-backed instead of JSON files
  |   +-- query_engine.py                   # EXISTING: unchanged
  |   +-- dataset_service.py               # NEW: dataset validation, column introspection
  |
  +-- models/
  |   +-- dashboard_config.py               # EXISTING: add version, status, created_by, timestamps
  |   +-- data_source_config.py             # EXISTING: add column roles, descriptions
  |   +-- persistence.py                    # NEW: SQLAlchemy ORM models for config storage
  |
  +-- migrations/                           # NEW: Alembic migrations for config tables
      +-- versions/
          +-- 001_dashboard_configs.py
          +-- 002_dataset_configs.py
```

---

## Architectural Patterns

### Pattern 1: Config-as-Contract (Most Important)

**What:** The DashboardConfig JSON schema is the contract between builder (producer) and renderer (consumer). The builder produces valid configs; the renderer consumes them. Neither knows about the other's internals.

**When to use:** Always. This is the foundational pattern for the entire system.

**Trade-offs:**
- Pro: Builder and renderer can evolve independently. Builder can be completely rewritten without touching rendering code.
- Pro: Configs are serializable, versionable, diffable, exportable/importable.
- Pro: Existing JSON configs continue to work -- zero migration needed for the renderer.
- Con: Schema evolution requires coordination. Adding a new widget type means updating both producer and consumer.

**Example -- the evolved DashboardConfig schema:**
```typescript
interface DashboardConfig {
  // Identity
  id: string
  name: string
  description: string
  version: number
  status: 'draft' | 'published'

  // Layout (evolved from fixed sections to grid-based)
  layout: {
    type: 'grid'                    // react-grid-layout based
    columns: 12                     // 12-column grid
    rowHeight: 80                   // pixels per row unit
    widgets: WidgetLayout[]         // position + size for each widget
  }

  // Widgets (replaces separate filters/kpis/charts/grids arrays)
  widgets: {
    [widgetId: string]: WidgetConfig  // union type of all widget kinds
  }

  // Interactions
  crossFilterRules: CrossFilterRule[]
  drillDownConfig: DrillDownConfig | null

  // Features
  features: {
    crossFilter: boolean
    drillDown: boolean
    autoRefresh: { enabled: boolean; intervalMs: number }
  }
}

interface WidgetLayout {
  widgetId: string
  x: number        // grid column (0-11)
  y: number        // grid row
  w: number        // width in columns
  h: number        // height in row units
  minW?: number
  minH?: number
}

type WidgetConfig =
  | KpiWidgetConfig
  | ChartWidgetConfig
  | GridWidgetConfig
  | FilterBarWidgetConfig
  | TextWidgetConfig

interface ChartWidgetConfig {
  kind: 'chart'
  id: string
  title: string
  datasetId: string
  vizType: VizType
  mapping: {
    categoryKey: string        // X-axis column
    valueKeys: string[]        // Y-axis column(s)
    seriesKey?: string         // Group-by column
    aggregation: AggregationType
  }
  appearance: {
    colors?: string[]
    legendPosition?: 'top' | 'bottom' | 'right' | 'none'
    showLabels?: boolean
  }
  crossFilter: {
    enabled: boolean
    sourceField?: string       // field emitted on click
  }
  drillDown: {
    enabled: boolean
    hierarchy?: string[]       // column sequence for drill levels
  }
}
```

### Pattern 2: Widget Registry

**What:** A registry mapping widget `kind` strings to their React components, configurator panels, and default configs. New widget types are added by registering, not by modifying switch statements.

**When to use:** When the system supports multiple widget types that share common lifecycle (render, configure, serialize).

**Trade-offs:**
- Pro: Adding new widget types is modular -- register and go.
- Pro: Clean separation of concerns per widget type.
- Con: Slight indirection. Debugging requires looking up registry entries.

**Example:**
```typescript
interface WidgetRegistryEntry<T extends WidgetConfig> {
  kind: string
  displayName: string
  icon: LucideIcon
  defaultConfig: () => T
  renderer: React.ComponentType<{ config: T; data: unknown }>
  configurator: React.ComponentType<{ config: T; onChange: (c: T) => void }>
  validateConfig: (config: T) => ValidationResult
  getDataRequirements: (config: T) => DataRequirement[]
}

const WIDGET_REGISTRY: Record<string, WidgetRegistryEntry<any>> = {
  chart: { kind: 'chart', displayName: 'Chart', icon: BarChart3, ... },
  kpi: { kind: 'kpi', displayName: 'KPI Card', icon: TrendingUp, ... },
  grid: { kind: 'grid', displayName: 'Data Grid', icon: Table, ... },
  text: { kind: 'text', displayName: 'Text', icon: Type, ... },
  filterBar: { kind: 'filterBar', displayName: 'Filter Bar', icon: Filter, ... },
}
```

### Pattern 3: Draft/Preview/Publish Lifecycle

**What:** Dashboard configs go through a lifecycle: draft (editing) -> preview (testing) -> published (live). Only one published version is active. Drafts are auto-saved.

**When to use:** Any multi-user system where changes should not immediately affect viewers.

**Trade-offs:**
- Pro: Business users can experiment without breaking live dashboards.
- Pro: Enables "undo publish" by reverting to previous published version.
- Con: Slightly more complex persistence (need to track version + status).

**State transitions:**
```
[new] --save--> [draft v1] --publish--> [published v1]
                                             |
                                        --edit-->
                                             |
                [draft v2] <--(auto-save)--- |
                     |
                 --publish-->
                     |
                [published v2]  (v1 archived)
```

### Pattern 4: Column Role Classification

**What:** Dataset columns are classified into roles (dimension, measure, temporal) rather than just types (string, number, date). The chart configurator uses roles to determine what columns can be placed where.

**When to use:** Always in chart builders. This is what makes the "pick columns for axes" UX work.

**Trade-offs:**
- Pro: Prevents invalid chart configurations (e.g., SUM of a string column).
- Pro: Enables smart defaults (temporal column auto-suggested for X-axis in line charts).
- Con: Requires dev team to review auto-detected roles during dataset creation.

**Role taxonomy:**
```typescript
type ColumnRole =
  | 'dimension'       // categorical (string) -- usable as X-axis, group-by, filter
  | 'measure'         // numeric -- usable as Y-axis, aggregatable
  | 'temporal'        // date/timestamp -- usable as X-axis for time series
  | 'identifier'      // unique row ID -- not useful for charts, but needed for drill-down

// Auto-detection heuristic:
// - type: "date" --> roles: ['temporal', 'dimension']
// - type: "number" --> roles: ['measure']
// - type: "string" + low cardinality --> roles: ['dimension']
// - type: "string" + high cardinality --> roles: ['identifier']
```

### Pattern 5: Optimistic UI with Auto-Save

**What:** The builder saves draft state to the backend frequently (debounced, every 5-10 seconds after changes). The UI is optimistic -- it does not wait for save confirmation before allowing the next edit.

**When to use:** Any builder/editor where data loss is unacceptable.

**Trade-offs:**
- Pro: Users never lose work.
- Pro: "Save" button is only for explicit save points, not for persistence.
- Con: Backend needs to handle high-frequency writes efficiently (consider diffing).

---

## Layout Engine: react-grid-layout

**Recommendation: Use react-grid-layout v2** as the layout engine for the dashboard builder.

**Why react-grid-layout:**
- Purpose-built for dashboard builders (drag + resize + snap-to-grid)
- 1.8M weekly npm downloads, actively maintained, v2 rewritten in TypeScript
- Used by Grafana, ilert, and many production dashboard products
- Serialization-ready: layout is a simple array of `{i, x, y, w, h}` objects -- maps directly to our WidgetLayout schema
- 12-column grid matches RecViz's existing CSS grid approach
- Responsive breakpoints built-in (not critical for desktop-only, but future-proof)

**Why NOT dnd-kit:**
- dnd-kit is a general DnD library, not a dashboard layout engine
- No built-in resize handles -- would need to build them
- No grid snapping or auto-packing -- would need to build them
- Better for list reordering, kanban boards, not grid dashboards

**Why NOT gridstack.js:**
- jQuery heritage, less idiomatic React integration
- Smaller React community compared to react-grid-layout

**Integration pattern:**
```typescript
// builder-canvas.tsx
import { Responsive, WidthProvider } from 'react-grid-layout'

const ResponsiveGrid = WidthProvider(Responsive)

function BuilderCanvas({ widgets, layout, onLayoutChange }: BuilderCanvasProps) {
  return (
    <ResponsiveGrid
      layouts={{ lg: layout }}
      cols={{ lg: 12 }}
      rowHeight={80}
      onLayoutChange={(newLayout) => onLayoutChange(newLayout)}
      isDraggable={true}
      isResizable={true}
      compactType="vertical"
      draggableHandle=".widget-drag-handle"
    >
      {Object.entries(widgets).map(([id, config]) => (
        <div key={id}>
          <WidgetRenderer
            config={config}
            mode="builder"
            onSelect={() => selectWidget(id)}
          />
        </div>
      ))}
    </ResponsiveGrid>
  )
}
```

---

## Schema Evolution: Existing Config to Builder Config

The current `DashboardConfig` schema needs targeted extensions, not a rewrite. The builder produces the same structure with additional optional fields.

### Current Schema (keep as-is for backward compatibility)

```
DashboardConfig
  +-- id, name, description
  +-- features: {crossFilter: boolean, drillDown: boolean}
  +-- filters: FilterConfig[]
  +-- kpis: KpiConfig[]
  +-- charts: DashboardChartConfig[]
  +-- grids: GridConfig[]
  +-- layout: {type: "flow", sections: ["filters","kpis","charts","grids"]}
```

### Evolved Schema (backward-compatible extension)

```
DashboardConfig
  +-- id, name, description
  +-- version: number                     // NEW
  +-- status: "draft" | "published"       // NEW
  +-- createdBy: string                   // NEW
  +-- updatedAt: ISO timestamp            // NEW
  +-- features: {crossFilter, drillDown, autoRefresh}
  +-- layout:
  |   +-- type: "flow" | "grid"           // "flow" = legacy, "grid" = builder
  |   +-- columns?: 12                    // for grid type
  |   +-- rowHeight?: 80                  // for grid type
  |   +-- widgets?: WidgetLayout[]        // for grid type
  |   +-- sections?: string[]             // for flow type (backward compat)
  +-- widgets?: Record<string, WidgetConfig>  // NEW: for grid layout type
  +-- filters: FilterConfig[]             // kept for flow layout type
  +-- kpis: KpiConfig[]                   // kept for flow layout type
  +-- charts: DashboardChartConfig[]      // kept for flow layout type
  +-- grids: GridConfig[]                 // kept for flow layout type
  +-- crossFilterRules?: CrossFilterRule[]   // NEW
  +-- drillDownConfig?: DrillDownConfig      // NEW
```

The renderer checks `layout.type`:
- `"flow"`: renders using existing section-based approach (filters, kpis, charts, grids arrays)
- `"grid"`: renders using react-grid-layout with `widgets` map

This means **existing JSON dashboards continue to work unchanged** while new builder-created dashboards use the grid layout.

---

## Cross-Filtering Architecture (Detailed)

### Config Model

```typescript
interface CrossFilterRule {
  id: string
  sourceWidgetId: string       // Widget that emits the filter
  sourceField: string          // Column in source widget's dataset
  targetWidgetIds: string[]    // Widgets that receive the filter ("*" = all)
  targetField: string          // Column to filter on in targets
}
```

### Auto-Detection Logic

When cross-filtering is enabled, the system can auto-generate rules:
1. Find all chart/grid widgets that share the same dataset
2. For each shared column across widgets, create a bidirectional rule
3. User can then customize: remove rules, change targets, add custom rules

### Runtime Implementation

Cross-filtering is **entirely client-side**. The implementation lives in:

1. **Filter store**: `crossFilters: CrossFilter[]` array in Zustand
2. **applyCrossFilters utility**: Pure function that filters a data array by active cross-filters
3. **Chart wrapper**: Each chart's `useMemo` calls `applyCrossFilters(data, crossFilters, myWidgetId)`
4. **Grid external filter**: AG Grid's `isExternalFilterPresent` + `doesExternalFilterPass`

The key performance characteristic: cross-filtering never triggers network calls. It operates on TanStack Query's cached data. This means the data must be fetched at sufficient granularity for client-side filtering to work.

### When Client-Side Cross-Filtering Breaks

If a chart shows pre-aggregated data (e.g., monthly totals), clicking a bar cannot filter another chart that shows daily detail -- the daily data isn't in cache. Solutions:

1. **Fetch at finest granularity, aggregate in client**: Query returns daily data; chart displays monthly aggregation via `useMemo`. Cross-filter operates on daily data. Works for moderate datasets (< 50K rows).

2. **Server-side cross-filter for large datasets**: Cross-filter click triggers new backend query with filter applied. Slower but handles millions of rows. Use when client-side data exceeds 50K rows.

3. **Hybrid**: Use client-side for charts sharing the same dataset at same granularity. Fall back to server-side when datasets differ.

**Recommendation for RecViz:** Start with client-side (Pattern 1). Most recon dashboards show < 10K aggregated rows. Add server-side fallback in a later phase only if needed.

---

## Drill-Down Architecture (Detailed)

### Config Model

```typescript
interface DrillDownConfig {
  enabled: boolean
  levels: DrillLevel[]
}

interface DrillLevel {
  name: string                   // "monthly" | "daily" | "detail"
  groupBy: string | null         // Column to group by at this level (null = raw rows)
  aggregation: AggregationType | null  // How to aggregate measures
  vizType?: VizType              // Override chart type at this level
  serverSide: boolean            // Whether this level requires a backend call
}
```

### Decision: Client-Side vs Server-Side Per Level

| Level | Data Availability | Strategy |
|-------|-------------------|----------|
| Level 0 -> 1 (e.g., month -> day) | Often in cache if queried at day granularity | Client-side: reaggregate cached data |
| Level 1 -> 2 (e.g., day -> category) | Depends on original query's GROUP BY | Client-side if data present, server-side if not |
| Level N -> Detail (raw rows) | Never in cache (too many rows) | Always server-side |

### Breadcrumb State

```typescript
// Zustand drill store (existing, enhanced)
interface DrillState {
  activeWidget: string | null    // Which widget is currently drilled
  levels: {
    label: string                // Display text: "January 2026"
    column: string               // "month"
    value: string | number       // "2026-01"
    filters: Record<string, unknown>  // Accumulated filters at this level
  }[]
}
```

### Dashboard-Wide vs Per-Widget Drill-Down

Two approaches exist in the industry:

1. **Dashboard-wide** (Grafana model): Drilling in one chart applies filters to ALL charts. Effectively a "scoped global filter."
2. **Per-widget** (Tableau model): Drilling in one chart only affects that chart. Other charts remain at their current level.

**Recommendation for RecViz:** Start with **per-widget** drill-down (simpler, less surprising). Optionally add "drill affects dashboard" as a toggle in cross-filter rules.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 10 dashboards, 50 widgets | Current approach is fine. JSON-to-DB migration, in-memory builder state. |
| 100 dashboards, 500 widgets | Add dashboard search/categorization. Consider lazy-loading widget configs. DB indexing on dashboard status + owner. |
| 100+ dashboards, millions of rows per query | Server-side cross-filtering for large datasets. Superset query caching critical. Consider pre-aggregated materialized views in Oracle for common queries. |

### First bottleneck: Query execution time

At scale, the bottleneck is **Superset query execution against Oracle**, not the builder UI. Mitigation:
- Aggressive Redis caching (already in place)
- TanStack Query client-side caching with 5-min stale time
- Pre-aggregated views for common dashboard patterns
- Pagination for detail grids (already in place)

### Second bottleneck: Dashboard list/search

With 100+ dashboards, the flat list becomes unusable. Mitigation:
- Add categories/folders for dashboards
- Full-text search across dashboard names/descriptions
- "Favorites" and "Recently viewed" shortcuts
- Existing command palette (Cmd+K) already supports search

---

## Anti-Patterns

### Anti-Pattern 1: Separate Rendering Paths for Builder and Viewer

**What people do:** Build one component tree for the builder preview and a separate one for the production view.
**Why it's wrong:** Divergence is inevitable. Builder preview shows one thing, production view shows another. Bugs are doubled. Maintenance cost doubles.
**Do this instead:** Single DashboardRenderer used in both contexts. The builder wraps it with selection/editing overlay. The renderer accepts a `mode` prop to suppress interactive features during editing (e.g., disable cross-filter clicks while configuring).

### Anti-Pattern 2: Storing Widget State in the Builder Store

**What people do:** Put fetched data, loading states, and error states in the builder's Zustand store.
**Why it's wrong:** TanStack Query already manages server state with caching, deduplication, background refetch, and error handling. Duplicating this in Zustand creates stale data bugs and cache invalidation nightmares.
**Do this instead:** Builder store holds ONLY builder-specific state: selected widget, draft config, undo/redo stack, panel open/closed. All data flows through TanStack Query as it already does.

### Anti-Pattern 3: Building Chart Config from Scratch Instead of Evolving Existing Schema

**What people do:** Design a completely new chart config schema for the builder, then write translation layers to convert to the renderer's format.
**Why it's wrong:** Translation layers are bugs waiting to happen. Schema drift between builder and renderer format means subtle rendering differences.
**Do this instead:** The builder produces the EXACT same `DashboardChartConfig` / `WidgetConfig` that the renderer consumes. No translation layer. One schema.

### Anti-Pattern 4: Eager-Loading All Widget Data in the Builder

**What people do:** When opening a dashboard in the builder, immediately fetch data for all widgets.
**Why it's wrong:** The builder is for layout and configuration. Most of the time, the user is dragging widgets around, not looking at live data. Fetching all data wastes network and creates unnecessary load.
**Do this instead:** Lazy-load widget data only when the widget is selected for configuration OR when "Preview" mode is activated. In layout mode, show skeleton placeholders.

### Anti-Pattern 5: Client-Side SQL Generation

**What people do:** Have the frontend build SQL queries based on chart configuration.
**Why it's wrong:** SQL injection risk. Frontend has no business knowing SQL. Couples frontend to database schema.
**Do this instead:** The existing pattern is correct: frontend sends structured filter objects; backend's QueryEngine builds SQL from templates. The builder configures dataset + column mappings; the backend handles SQL generation.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Superset | REST API via httpx (existing) | No changes needed. Query execution unchanged. |
| Oracle/Hive | Via Superset SQLAlchemy | No changes needed. Builder doesn't touch data sources directly. |
| Elasticsearch | Direct via elasticsearch-py (existing) | May need to add ES-backed datasets to the catalog. |
| Redis | Via Superset (query cache) + direct (future session) | No changes for builder. Consider Redis for auto-save if DB writes are too frequent. |
| PostgreSQL | New: config persistence via SQLAlchemy | Add Alembic migrations. Tables: dashboards, datasets, dashboard_versions. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Builder -> Renderer | DashboardConfig object (in-memory) | Builder passes draft config directly to renderer for preview. No serialization needed. |
| Builder -> Backend | REST API (JSON) | Save/load/publish configs. Dataset metadata queries. |
| Renderer -> Backend | REST API (JSON, existing) | Data queries unchanged. Config loading switches from JSON files to DB-backed API. |
| Backend Config Store -> DB | SQLAlchemy ORM | Replaces JSON file reads with DB queries. Same interface to callers. |
| Dataset Manager -> Superset | Via Backend REST API | Column introspection, SQL validation, database listing. |

---

## Suggested Build Order

The component dependencies dictate the build order. Each phase builds on the previous.

### Phase 1: Foundation (Config Persistence + Renderer Evolution)

**Build:**
1. DB-backed config persistence (replace JSON files with PostgreSQL tables)
2. Dashboard CRUD API (create, read, update, delete, list, publish)
3. Integrate cross-filtering into config-driven renderer (port from legacy)
4. Integrate drill-down into config-driven renderer (port from legacy)
5. Add ChartPanel wrapper to config-driven charts (export, fullscreen)

**Why first:** The renderer must support all features before the builder can configure them. Cross-filtering and drill-down are the biggest gaps. DB persistence is needed before the builder can save anything.

**Dependencies:** None (works with existing codebase).

### Phase 2: Dataset Management

**Build:**
1. Dataset CRUD API with validation endpoint
2. Column metadata with roles (dimension/measure/temporal)
3. Dataset Manager UI (dev-team tool)
4. Column introspection via Superset (auto-detect types)

**Why second:** The builder needs datasets with rich metadata before it can offer column-to-axis mapping. This is a dev-team tool, so it can be built and populated before the builder UI exists.

**Dependencies:** Phase 1 (DB persistence).

### Phase 3: Dashboard Builder Core

**Build:**
1. Builder layout with react-grid-layout (canvas + drag/resize)
2. Widget palette (KPI, chart, grid, filter bar)
3. Widget registry pattern
4. Properties panel (per-widget configurator)
5. Chart configurator (dataset picker -> column mapper -> type picker)
6. Builder store (selected widget, draft config, undo/redo)
7. Live preview mode (renders draft config through existing renderer)

**Why third:** The builder is the capstone. It depends on datasets (for column metadata) and the renderer (for preview).

**Dependencies:** Phase 1 (renderer features, persistence) + Phase 2 (dataset metadata).

### Phase 4: Advanced Builder Features

**Build:**
1. Cross-filter rule configurator UI
2. Drill-down level configurator UI
3. Dashboard templates (pre-built starting configs)
4. Auto-save + draft/publish lifecycle
5. Dashboard versioning
6. KPI configurator with trend/comparison

**Why last:** These are enhancements to the builder. The core loop (place widgets, configure, preview, save) must work first.

**Dependencies:** Phase 3 (builder core).

---

## How the Existing Config-Driven System Evolves

The evolution is incremental. At no point does the existing system break.

| Step | What Changes | What Stays |
|------|-------------|------------|
| 1. Add DB persistence | Config store reads from DB. JSON files imported as seed data on first run. | Renderer unchanged. API contract unchanged. |
| 2. Add CRUD API | New endpoints: POST/PUT/DELETE dashboards. GET returns same shape. | Existing GET endpoints return same format. Frontend dashboard list works unchanged. |
| 3. Port cross-filtering | ConfigChartGrid gets onChartClick + cross-filter integration. Filter store's crossFilter methods are already there. | Filter bar, KPI row unchanged. |
| 4. Port drill-down | ConfigChartGrid gets drill-down handler. DrillBreadcrumb added. Drill store already exists. | Other components unchanged. |
| 5. Add ChartPanel | ConfigChartGrid wraps charts in ChartPanel (export, fullscreen). | Chart rendering logic unchanged. |
| 6. Add builder route | New route: `/builder/:dashboardId?`. Opens builder UI. Produces same DashboardConfig. | All existing routes unchanged. |
| 7. Add grid layout type | Renderer checks `layout.type`: "flow" uses existing path, "grid" uses react-grid-layout. | Existing "flow" dashboards unchanged. |

The existing `tlm-stats.json` dashboard continues working throughout. New dashboards created via the builder use the "grid" layout type. Old dashboards can be "upgraded" to grid layout via the builder's import mechanism.

---

## Sources

- [react-grid-layout GitHub](https://github.com/react-grid-layout/react-grid-layout) -- v2.2.3, 1.8M weekly downloads, TypeScript rewrite
- [ilert: Why React-Grid-Layout Was Our Best Choice](https://www.ilert.com/blog/building-interactive-dashboards-why-react-grid-layout-was-our-best-choice) -- Production dashboard builder case study
- [Grafana Dashboard JSON Schema v2](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/schema-v2/) -- Layout system reference (GridLayout, AutoGridLayout, RowsLayout, TabsLayout)
- [Grafana Dashboard JSON Model](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/view-dashboard-json-model/) -- Panel structure, templating, variables
- [Metabase Dashboard Architecture](https://www.metabase.com/docs/latest/dashboards/introduction) -- Cards, questions, visualization override pattern
- [Metabase Dashboard Interactivity](https://www.metabase.com/docs/latest/dashboards/interactive) -- Cross-filtering, drill-down patterns
- [Apache Superset API Reference](https://superset.apache.org/developer-docs/api/) -- Dataset endpoints, column metadata, metrics
- [Superset Semantic Layer](https://preset.io/blog/understanding-superset-semantic-layer/) -- Dataset/metric/column architecture
- [Databricks AI/BI Cross-Filtering](https://www.databricks.com/blog/next-level-interactivity-aibi-dashboards) -- Client-side filter evaluation pattern
- [Looker Cross-Filtering](https://cloud.google.com/looker/docs/cross-filtering-dashboards) -- Shared dataset auto-filter pattern
- [Holistics Cross-Filtering](https://docs.holistics.io/docs/cross-filtering) -- Field mapping between widgets
- [Drill-Down Navigation Patterns](https://dev3lop.com/implementing-drill-down-navigation-in-hierarchical-visualizations/) -- Hierarchy depth, breadcrumb, aggregation
- [Bold BI Drill-Down Architecture](https://www.boldbi.com/blog/what-is-drill-down-and-drill-up-in-dashboards/) -- Dashboard-level vs widget-level drill
- [Puck: Top 5 DnD Libraries for React](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) -- react-grid-layout vs dnd-kit comparison
- [npm trends: react-grid-layout](https://npmtrends.com/react-grid-layout) -- Download statistics

---
*Architecture research for: RecViz Dashboard Builder*
*Researched: 2026-04-04*
