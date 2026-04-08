# Phase 6: Chart Library - Research

**Researched:** 2026-04-06
**Domain:** Chart builder UI, chart persistence (PostgreSQL), chart library CRUD, AG Charts + ECharts rendering integration
**Confidence:** HIGH

## Summary

Phase 6 builds a reusable chart library where users create charts via an accordion-stepper builder (dataset selection, chart type, column mapping, appearance, save), persist them to PostgreSQL, and browse/search/preview them from a library page. This is architecturally a CRUD layer (like Phase 5 datasets) plus a multi-step builder UI with live chart preview. The backend is simpler than Phase 5 because charts are PostgreSQL-only -- no Superset sync needed.

The codebase already has all the building blocks: `buildSeries()` in ag-chart-wrapper.tsx handles AG Charts config-driven rendering, `buildEChartsOption()` in echart-wrapper.tsx handles exotic types, `ChartFactory` routes to the correct wrapper, the dataset CRUD pattern (SQLAlchemy model, Pydantic schemas, FastAPI endpoints, TanStack Query hooks) can be cloned nearly verbatim, and the dataset list page pattern (card/row toggle, search, toolbar) provides the library list template.

**Primary recommendation:** Clone the dataset CRUD infrastructure for charts (model, schemas, endpoints, hooks), install Shadcn Accordion, build the five-step builder with `react-resizable-panels` for the left accordion / right preview split, and reuse `ChartFactory` for live preview rendering.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Accordion stepper on the left with live chart preview always visible on the right. Each step expands inline when active, collapses with a summary line when completed. No separate sidebar column wasted -- the accordion IS the left panel.
- **D-02:** Completed steps are clickable to re-expand for editing. Changes to earlier steps (e.g., switching dataset) reset downstream steps. Future steps are locked until their prerequisites are done.
- **D-03:** Step order: 1. Dataset -> 2. Chart Type -> 3. Column Mapping -> 4. Appearance -> 5. Save.
- **D-04:** Dedicated `/charts/new` page for creating charts and `/charts/:id/edit` for editing. "Charts" nav item in sidebar (same level as Dashboards, Datasets, Explorer). Chart library list page with "+ New Chart" button. Same pattern as datasets.
- **D-05:** Searchable combobox listing datasets by name with database type badge. Selecting a dataset shows its column metadata (name, type, role) in the right preview area.
- **D-06:** "Preview Data" button in the preview area fetches a sample of rows from the dataset on demand (via existing SQL Lab execute endpoint). Columns shown immediately from saved metadata; data fetch is optional.
- **D-07:** Icon grid showing all chart types with visual thumbnails/icons. Grouped into "Standard" (AG Charts) and "Exotic" (ECharts).
- **D-08:** Incompatible types are dimmed with tooltip explaining why. Compatibility determined by dataset column roles.
- **D-09:** Chart type is selected BEFORE column mapping. The chart type determines which mapping fields appear in Step 3.
- **D-10:** Role-aware dropdowns. X-Axis/Category dropdown shows only dimension and time columns. Metrics dropdown shows only measure columns. User can override if needed.
- **D-11:** Multiple metrics supported for chart types that allow it (bar, line, area, combo). Single metric for pie/donut. Add/remove metric tags with [+ Add metric] button.
- **D-12:** Default aggregation pre-filled from dataset column metadata. User can override per-chart via dropdown.
- **D-13:** Essentials only for appearance. Title, legend show/hide, legend position, axis label toggles. Colors from Shadcn theme automatically.
- **D-14:** Name (required) and description (optional). No tags. Duplicate names allowed.
- **D-15:** Charts stored in RecViz PostgreSQL only. New `recviz_charts` table. No Superset sync.
- **D-16:** Chart references dataset by ID. Stores: dataset_id (FK), chart_type, config (JSONB with column mapping + appearance). Does NOT copy data.
- **D-17:** Adding a chart to a dashboard creates a reference (not a copy). One chart definition, many dashboard placements.
- **D-18:** Immediate propagation on save. No draft/published workflow.
- **D-19:** All charts are library charts. No "inline-only" dashboard charts.
- **D-20:** Block deletion if chart is referenced by dashboards. UI shows which dashboards reference it.
- **D-21:** Card grid with chart type icon, chart name, dataset name, and a small static thumbnail. Card/row toggle.
- **D-22:** Search by name, filter by chart type, filter by dataset. Toolbar above the grid.
- **D-23:** Click a chart card to open a detail view/side panel with a full live render, metadata, "Used in" dashboards list, Edit button.
- **D-24:** Right-side preview area is context-sensitive per step.

### Claude's Discretion
- Accordion animation and transition details
- Chart type thumbnail/icon design (Lucide icons or custom SVGs)
- Preview area empty state before dataset is selected
- Column metadata table styling in preview area
- "Preview Data" row limit (e.g., 50 rows)
- Chart config JSONB schema structure
- Alembic migration for recviz_charts table
- Delete confirmation dialog design
- Card vs row component layout details
- How "Used in dashboards" list is fetched
- Edit mode vs create mode differences in the accordion

### Deferred Ideas (OUT OF SCOPE)
- Custom color palettes
- Chart templates
- Chart versioning
- Chart tags
- Inline chart type switching
- Advanced appearance controls
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHRT-01 | User can create a chart by selecting a dataset, mapping columns, choosing a chart type, and configuring appearance | Builder accordion (D-01 through D-13), ChartFactory for preview, SQLAlchemy model + FastAPI endpoints for persistence |
| CHRT-02 | Chart type selector with visual thumbnails showing available types -- highlight compatible types | Chart type icon grid (UI-SPEC icon mapping), compatibility rules from dataset column roles (D-08), Tooltip for incompatible explanations |
| CHRT-03 | Charts can be saved independently to chart library with name and description | RecvizChart model with JSONB config, POST/PUT endpoints (clone dataset pattern), save step (D-14) |
| CHRT-04 | Saved charts are reusable -- can be added to multiple dashboards; config change updates everywhere | Chart stored by ID, dashboards reference by chart_id (Phase 8 integration point), D-17 reference model |
| CHRT-05 | AG Charts covers standard types (line, bar, area, pie, donut, scatter, heatmap, treemap, waterfall, bullet, box plot, combo) | Existing `buildSeries()` in ag-chart-wrapper.tsx already handles all these types. Bullet and box plot need additions. |
| CHRT-06 | ECharts covers exotic types only (Sankey, sunburst, radar, graph/network, gauge, parallel coords, funnel) | Existing `buildEChartsOption()` in echart-wrapper.tsx already handles all these types |
| CHRT-07 | User can browse chart library, search by name, preview saved charts | Chart library list page (clone dataset-list.tsx pattern), Sheet side panel with live ChartFactory render |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Strict TypeScript.** No `any`. No `@ts-ignore`. Use `unknown` + type narrowing.
- **Named exports** for all components/hooks/stores. Page components use `default export` (TanStack Router).
- **Props interface** defined above the component, named `{ComponentName}Props`.
- **No barrel exports.** Import directly from the file.
- **One primary component per file.** Small helpers can colocate.
- **File naming:** kebab-case.tsx for components, use-{name}.ts for hooks, {name}.ts for types.
- **Shadcn CSS variable colors only.** Never hardcode hex/rgb/hsl.
- **motion/react** for animations. NOT framer-motion.
- **AG Charts** for standard chart types. **ECharts** for exotic types ONLY.
- **TanStack Query** for all server state. Never store fetched data in Zustand.
- **Zustand** selectors for client state to avoid unnecessary re-renders.
- **FastAPI async everywhere.** All endpoints `async def`. Pydantic v2 models. Service layer pattern.
- **CamelModel** base class for Pydantic (auto snake_case to camelCase alias generation).
- **api-client.ts** handles snake_to_camel transform, 204 handling, DATA_KEYS skip set.
- **Dark mode is first-class.** Every component must work in both themes.
- **Skeleton loading** on every data component.
- **Desktop-first.** Optimize for large screens.
- **Alembic** migrations use `recviz_alembic_version` table.

## Standard Stack

### Core (Already Installed)

| Library | Version (installed) | Latest | Purpose | Why Standard |
|---------|-------------------|--------|---------|--------------|
| ag-charts-enterprise | 13.0.1 | 13.2.0 | Standard chart rendering | Project-mandated for all standard chart types [VERIFIED: package.json + npm registry] |
| ag-charts-react | 13.0.1 | 13.2.0 | React wrapper for AG Charts | Required by ag-charts-enterprise [VERIFIED: package.json + npm registry] |
| echarts | 6.0.0 | 6.0.0 | Exotic chart rendering | Project-mandated for Sankey/sunburst/radar/graph/gauge/parallel/funnel [VERIFIED: package.json + npm registry] |
| echarts-for-react | 3.0.6 | 3.0.6 | React wrapper for ECharts | Used by existing echart-wrapper.tsx [VERIFIED: package.json] |
| @tanstack/react-query | 5.90.20 | ^5 | Server state, CRUD hooks | Project standard for all data fetching [VERIFIED: package.json] |
| @tanstack/react-router | 1.159.5 | ^1 | File-based routing | Project standard, new routes needed [VERIFIED: package.json] |
| lucide-react | 0.563.0 | ^0.563 | Chart type icons | 18 chart types need distinct icons [VERIFIED: package.json] |
| motion | 12.34.0 | ^12 | Page transitions, accordion animations | Project standard (import from motion/react) [VERIFIED: package.json] |
| sonner | 2.0.7 | ^2 | Toast notifications for save/delete | Already in use for dataset operations [VERIFIED: package.json] |
| react-resizable-panels | 4.6.2 | ^4 | Builder left/right split layout | Already installed, used for Data Explorer [VERIFIED: package.json] |

### New Dependency to Install

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| @radix-ui/react-accordion | 1.2.12 | Accordion primitive for builder stepper | Shadcn Accordion component depends on it. Not currently installed. [VERIFIED: npm registry] |

**Installation:**
```bash
npx shadcn@latest add accordion
```
This installs `@radix-ui/react-accordion` and generates `frontend/src/components/ui/accordion.tsx`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Accordion stepper | Custom stepper component | Accordion is locked per D-01. Radix Accordion provides accessibility out of the box |
| react-resizable-panels for builder split | CSS flexbox fixed widths | Already installed, provides drag-to-resize, used elsewhere in project |
| Sheet for detail panel | Dialog or full page | Sheet is appropriate for side panel preview (D-23), already installed |

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
  components/charts/
    chart-library-list.tsx        # List page component (clone of dataset-list.tsx)
    chart-library-toolbar.tsx     # Search, filters, view toggle, + New Chart
    chart-library-card.tsx        # Card component for grid view
    chart-library-row.tsx         # Row component for list view
    chart-detail-panel.tsx        # Sheet side panel with live render
    chart-builder.tsx             # Accordion stepper orchestrator
    chart-builder-preview.tsx     # Right-side preview area (context-sensitive)
    chart-type-icon.tsx           # Lucide icon mapping for chart types
    delete-chart-dialog.tsx       # Delete confirmation with reference blocking
    builder/
      step-dataset.tsx            # Step 1: Dataset combobox + metadata display
      step-type.tsx               # Step 2: Chart type icon grid
      step-mapping.tsx            # Step 3: Column mapping with role-aware dropdowns
      step-appearance.tsx         # Step 4: Title, legend, axis labels
      step-save.tsx               # Step 5: Name + description + save button
  hooks/
    use-managed-charts.ts         # CRUD hooks (clone of use-managed-datasets.ts)
  types/
    managed-chart.ts              # TypeScript types for RecvizChart
  routes/_app/charts/
    index.tsx                     # Chart library list page
    new.tsx                       # Chart builder (create mode)
    $chartId.edit.tsx             # Chart builder (edit mode)

backend/app/
  db/models/chart.py              # RecvizChart SQLAlchemy model
  models/managed_chart.py         # Pydantic schemas (ChartCreate, ChartUpdate, ChartResponse)
  api/managed_charts.py           # CRUD endpoints (/api/charts/managed)
  migrations/versions/003_add_charts.py  # Alembic migration
```

### Pattern 1: Clone Dataset CRUD for Charts (Backend)

**What:** The chart backend is a simplified version of the dataset backend -- same CRUD pattern but without Superset sync.
**When to use:** For all chart persistence operations.

RecvizChart SQLAlchemy model:
```python
# Source: Clone of backend/app/db/models/dataset.py [VERIFIED: codebase]
class RecvizChart(Base):
    __tablename__ = "recviz_charts"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(String(1024), server_default="", default="")
    dataset_id: Mapped[str] = mapped_column(String(128), nullable=False)  # FK to recviz_datasets.id
    chart_type: Mapped[str] = mapped_column(String(64), nullable=False)   # e.g., "bar", "pie", "sankey"
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # column mapping + appearance
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), default=_utcnow
    )
```

Chart config JSONB schema (Claude's Discretion):
```python
# Recommended config JSONB structure [ASSUMED]
{
    "column_mapping": {
        "category_column": "region",        # dimension column for x-axis/category
        "metric_columns": ["amount", "count"],  # measure columns for y-axis/values
        "aggregations": {                    # per-metric aggregation overrides
            "amount": "SUM",
            "count": "COUNT"
        }
    },
    "appearance": {
        "title": "Revenue by Region",
        "show_legend": true,
        "legend_position": "bottom",       # top|bottom|left|right
        "show_x_label": true,
        "show_y_label": true
    }
}
```

### Pattern 2: Clone Dataset CRUD Hooks (Frontend)

**What:** TanStack Query hooks for chart CRUD following exact same pattern as use-managed-datasets.ts.
**When to use:** All chart data operations.

```typescript
// Source: Clone of frontend/src/hooks/use-managed-datasets.ts [VERIFIED: codebase]
export function useManagedCharts() {
  return useQuery({
    queryKey: ['managed-charts'],
    queryFn: () => api.get<RecvizChart[]>('/api/charts/managed'),
  })
}

export function useManagedChart(id: string | null) {
  return useQuery({
    queryKey: ['managed-chart', id],
    queryFn: () => api.get<RecvizChart>(`/api/charts/managed/${id}`),
    enabled: id !== null,
  })
}

export function useCreateChart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ChartCreate) =>
      api.post<RecvizChart>('/api/charts/managed', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-charts'] })
    },
  })
}
// ... useUpdateChart, useDeleteChart, useChartReferences follow same pattern
```

### Pattern 3: Accordion Stepper State Management

**What:** The builder uses Radix Accordion in single-value mode with programmatic control for step locking/resetting.
**When to use:** Chart builder page.

```typescript
// Source: Radix Accordion API [ASSUMED based on Radix docs]
// Accordion with controlled value for programmatic step management
const [activeStep, setActiveStep] = useState<string>('dataset')
const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

// Step transitions: complete current step and unlock next
function completeStep(step: string, nextStep: string) {
  setCompletedSteps(prev => new Set([...prev, step]))
  setActiveStep(nextStep)
}

// Reset downstream steps when earlier step changes (D-02)
function resetFromStep(step: string) {
  const stepOrder = ['dataset', 'type', 'mapping', 'appearance', 'save']
  const idx = stepOrder.indexOf(step)
  setCompletedSteps(prev => {
    const next = new Set(prev)
    for (let i = idx; i < stepOrder.length; i++) next.delete(stepOrder[i])
    return next
  })
}

// Lock steps that haven't been reached yet
function isStepLocked(step: string): boolean {
  const stepOrder = ['dataset', 'type', 'mapping', 'appearance', 'save']
  const idx = stepOrder.indexOf(step)
  if (idx === 0) return false
  return !completedSteps.has(stepOrder[idx - 1])
}
```

### Pattern 4: Builder Layout with react-resizable-panels

**What:** The builder page uses a horizontal ResizablePanelGroup with the accordion on the left and preview on the right.
**When to use:** Chart builder page layout.

```typescript
// Source: react-resizable-panels, already installed [VERIFIED: package.json]
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

// Left panel: accordion stepper (fixed min-width 320px)
// Right panel: live preview (flex-1, min 50% per UI-SPEC)
<PanelGroup direction="horizontal">
  <Panel defaultSize={35} minSize={25} maxSize={45}>
    <ChartBuilder ... />
  </Panel>
  <PanelResizeHandle className="w-1.5 bg-border" />
  <Panel defaultSize={65} minSize={50}>
    <ChartBuilderPreview ... />
  </Panel>
</PanelGroup>
```

### Pattern 5: Live Preview with ChartFactory Reuse

**What:** The builder preview reuses existing ChartFactory to render live chart previews as the user configures.
**When to use:** Steps 3-5 of the builder.

```typescript
// Source: frontend/src/components/charts/chart-factory.tsx [VERIFIED: codebase]
// ChartFactory already accepts ChartWrapperProps with ChartConfig
// Build a ChartConfig from builder state:
const previewConfig: ChartConfig = {
  id: 'preview',
  name: builderState.title || 'Preview',
  vizType: builderState.chartType,
  datasourceId: 0, // not needed for preview
  metricColumns: builderState.metricColumns,
  categoryColumn: builderState.categoryColumn,
}

// Fetch data from dataset and pass to ChartFactory
<ChartFactory
  chartId="preview"
  config={previewConfig}
  data={previewData}
  isLoading={isLoadingPreview}
/>
```

### Pattern 6: API Route Naming (Avoiding Collision with Existing Charts Router)

**What:** The existing `backend/app/api/charts.py` serves Superset-proxied chart data at `/api/charts`. The new managed charts CRUD must use a different prefix.
**When to use:** Backend route registration.

```python
# CRITICAL: Existing charts router uses /api/charts
# New managed charts router MUST use /api/charts/managed (same pattern as datasets)
# Source: backend/app/api/router.py [VERIFIED: codebase]
router = APIRouter(prefix="/api/charts/managed", tags=["managed-charts"])
```

The route registration order in `router.py` should place managed_charts before charts (same as managed_datasets before datasets) to avoid path parameter collision. [VERIFIED: existing pattern in router.py line 20-21]

### Anti-Patterns to Avoid
- **Storing chart data in the chart record:** Charts reference datasets by ID and query data at render time. Never copy or cache query results in the chart JSONB. (D-16)
- **Creating a Superset chart for each RecViz chart:** Charts are a UI/config concept only. Superset only knows about datasets. (D-15)
- **Using framer-motion instead of motion/react:** Import from `motion/react`, NOT `framer-motion`. [VERIFIED: CLAUDE.md]
- **Hardcoding chart type compatibility in multiple places:** Define compatibility rules once in a shared utility, used by both the type selector and any validation logic.
- **Building inline-only dashboard charts:** All charts go through the library. No special "dashboard-only" charts. (D-19)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion stepper UI | Custom collapsible step panels | Shadcn Accordion (Radix primitive) | Accessibility, keyboard navigation, ARIA attributes all built-in [VERIFIED: Radix docs] |
| Chart rendering for preview | Custom canvas/SVG rendering | Existing ChartFactory + AG/EChart wrappers | Already handles all 18+ chart types with cross-filter support [VERIFIED: codebase] |
| Resizable panel layout | Custom drag handles | react-resizable-panels | Already installed, handles edge cases (min/max, persistence, accessibility) [VERIFIED: package.json] |
| Searchable dropdown (combobox) | Custom search + dropdown | Shadcn Popover + Command pattern | Already used elsewhere in project, handles keyboard, filtering, empty state [VERIFIED: codebase] |
| Snake-to-camel API transforms | Manual key mapping | api-client.ts `transformKeys()` | Already handles the transform with DATA_KEYS skip set [VERIFIED: codebase] |
| Toast notifications | Custom notification system | Sonner (via `toast()`) | Already used for dataset CRUD operations [VERIFIED: codebase] |

**Key insight:** This phase is 90% pattern cloning from Phase 5 (dataset CRUD) plus integration with existing chart rendering. The only genuinely new UI is the accordion stepper builder and the chart type selector grid.

## Common Pitfalls

### Pitfall 1: API Route Collision with Existing Charts Router
**What goes wrong:** New managed charts endpoints collide with existing `/api/charts` Superset proxy routes.
**Why it happens:** Both deal with "charts" but serve different purposes -- one proxies Superset, the other manages RecViz chart configs.
**How to avoid:** Use `/api/charts/managed` prefix (matches `/api/datasets/managed` pattern). Register `managed_charts_router` BEFORE `charts_router` in router.py.
**Warning signs:** 404 or wrong handler responses when hitting chart endpoints.

### Pitfall 2: Accordion State Reset on Dataset Change
**What goes wrong:** User changes dataset in Step 1 after completing Steps 2-4. Old column mappings reference columns that no longer exist in the new dataset.
**Why it happens:** Steps 2-5 depend on Step 1's dataset. Changing it invalidates downstream state.
**How to avoid:** Implement cascading reset per D-02. When dataset changes, clear chart type, column mapping, and appearance. Only keep the save step's name/description.
**Warning signs:** Column mapping dropdowns show stale columns, chart preview crashes on missing columns.

### Pitfall 3: Chart Type Compatibility vs Column Roles
**What goes wrong:** Compatibility check uses wrong column classification. A column marked as "none" role is neither dimension nor measure, causing all chart types to appear incompatible.
**Why it happens:** Dataset column metadata has `role: "none"` as a valid value (for columns not yet classified).
**How to avoid:** Count "none" role columns as neither dimension nor measure for compatibility. Show a warning when dataset has many "none" columns suggesting they configure column metadata first. Time columns count as dimensions per UI-SPEC.
**Warning signs:** All chart types dimmed despite dataset having appropriate columns.

### Pitfall 4: Preview Data Fetch Using Wrong Endpoint
**What goes wrong:** Attempting to fetch preview data through the chart data endpoint instead of the SQL Lab execute endpoint.
**Why it happens:** Multiple query endpoints exist with different purposes.
**How to avoid:** Use the SQL Lab execute endpoint (`/api/sql/execute`) for "Preview Data" in Step 1, which accepts raw SQL. For chart rendering preview in Steps 3-5, use the data source query endpoint (`/api/data-sources/{id}/query`) since the dataset has a Superset data source ID. [VERIFIED: backend/app/api/sql.py, backend/app/api/data_sources.py]
**Warning signs:** Preview shows "No data" or wrong data format.

### Pitfall 5: JSONB Config Column camelCase vs snake_case
**What goes wrong:** The JSONB config stores column names from the database (snake_case like `break_count`) but the API client transforms all keys to camelCase, corrupting the stored column names.
**Why it happens:** api-client.ts `transformKeys()` applies snake-to-camel transformation on all response keys except those in DATA_KEYS set.
**How to avoid:** The `config` field in the chart response will be transformed by `transformKeys()`. Column names stored inside `config.column_mapping` must be treated as data, not API keys. Either: (a) add "config" to the DATA_KEYS skip set in api-client.ts, OR (b) store column mapping keys using their original DB column names and accept camelCase transformation of the wrapper keys only. Recommendation: add "config" or "columnMapping" to DATA_KEYS. [VERIFIED: api-client.ts DATA_KEYS set]
**Warning signs:** Column names like `break_count` become `breakCount` in the config, then don't match actual data columns.

### Pitfall 6: Bullet and Box Plot Types Missing from buildSeries()
**What goes wrong:** CHRT-05 requires "bullet" and "box plot" types, but the existing `buildSeries()` in ag-chart-wrapper.tsx does not handle these types -- it returns null.
**Why it happens:** These chart types were not needed in earlier phases (dashboard renderer).
**How to avoid:** Add `bullet` and `box-plot` cases to `buildSeries()` and add them to the `SUPPORTED_AG_TYPES` set in chart-factory.tsx. AG Charts Enterprise supports both types. [VERIFIED: ag-chart-wrapper.tsx only handles bar, stacked-bar, line, area, pie, donut, scatter, heatmap, treemap, waterfall, combo, histogram]
**Warning signs:** Selecting "Bullet" or "Box Plot" in the chart type grid shows "Unsupported chart type" error in preview.

### Pitfall 7: Dataset Delete Reference Check Integration
**What goes wrong:** Phase 5's dataset delete endpoint has a placeholder for chart reference checking (`referencing_charts: list[dict] = []`). This must be wired up in Phase 6.
**Why it happens:** Phase 5 deferred chart reference checking to Phase 6.
**How to avoid:** When implementing chart CRUD, also update the dataset delete endpoint to query `recviz_charts` for rows with matching `dataset_id`. Update both the DELETE check and the GET references endpoint. [VERIFIED: managed_datasets.py lines 164-173, 184-196]
**Warning signs:** Deleting a dataset succeeds even when charts reference it, orphaning charts.

## Code Examples

### RecvizChart TypeScript Type
```typescript
// Source: Clone of frontend/src/types/managed-dataset.ts [VERIFIED: codebase]
export type ChartType =
  | 'bar' | 'stacked-bar' | 'line' | 'area'
  | 'pie' | 'donut' | 'scatter'
  | 'heatmap' | 'treemap' | 'waterfall'
  | 'bullet' | 'box-plot' | 'combo'
  | 'sankey' | 'sunburst' | 'radar'
  | 'gauge' | 'funnel' | 'graph' | 'parallel'

export interface ChartColumnMapping {
  categoryColumn: string | null
  metricColumns: string[]
  aggregations: Record<string, string>  // column_name -> aggregation function
}

export interface ChartAppearance {
  title: string
  showLegend: boolean
  legendPosition: 'top' | 'bottom' | 'left' | 'right'
  showXLabel: boolean
  showYLabel: boolean
}

export interface ChartConfig {
  columnMapping: ChartColumnMapping
  appearance: ChartAppearance
}

export interface RecvizChart {
  id: string
  name: string
  description: string
  datasetId: string
  chartType: ChartType
  config: ChartConfig
  createdAt: string
  updatedAt: string
}

export interface ChartCreate {
  name: string
  description: string
  datasetId: string
  chartType: ChartType
  config: ChartConfig
}

export interface ChartUpdate {
  name?: string
  description?: string
  chartType?: ChartType
  config?: ChartConfig
}

export interface ChartDeleteCheck {
  canDelete: boolean
  referencingDashboards: { id: string; name: string }[]
}
```

### Chart Type Compatibility Utility
```typescript
// Source: UI-SPEC compatibility rules [VERIFIED: 06-UI-SPEC.md]
interface DatasetShape {
  dimensions: number  // columns with role 'dimension' or 'time'
  measures: number    // columns with role 'measure'
}

const CHART_REQUIREMENTS: Record<string, { minDim: number; maxDim?: number; minMeas: number; maxMeas?: number; tooltip: string }> = {
  'bar': { minDim: 1, minMeas: 1, tooltip: 'Requires at least 1 dimension and 1 measure' },
  'pie': { minDim: 1, minMeas: 1, maxMeas: 1, tooltip: 'Requires 1 dimension and exactly 1 measure' },
  'scatter': { minDim: 0, minMeas: 2, tooltip: 'Requires at least 2 measure columns' },
  'heatmap': { minDim: 2, maxDim: 2, minMeas: 1, maxMeas: 1, tooltip: 'Requires 2 dimensions and 1 measure' },
  // ... etc
}

export function isChartTypeCompatible(chartType: string, shape: DatasetShape): { compatible: boolean; tooltip: string } {
  const req = CHART_REQUIREMENTS[chartType]
  if (!req) return { compatible: false, tooltip: 'Unknown chart type' }
  const dimOk = shape.dimensions >= req.minDim && (!req.maxDim || shape.dimensions <= req.maxDim)
  const measOk = shape.measures >= req.minMeas && (!req.maxMeas || shape.measures <= req.maxMeas)
  return { compatible: dimOk && measOk, tooltip: req.tooltip }
}
```

### Alembic Migration for recviz_charts
```python
# Source: Clone of backend/app/migrations/versions/002_add_datasets.py [VERIFIED: codebase]
"""Add recviz_charts table

Revision ID: 003
Revises: 002
"""
def upgrade() -> None:
    op.create_table(
        "recviz_charts",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.String(1024), server_default=""),
        sa.Column("dataset_id", sa.String(128), nullable=False),
        sa.Column("chart_type", sa.String(64), nullable=False),
        sa.Column("config", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Index for listing charts by dataset (used by dataset delete reference check)
    op.create_index("ix_recviz_charts_dataset_id", "recviz_charts", ["dataset_id"])

def downgrade() -> None:
    op.drop_index("ix_recviz_charts_dataset_id")
    op.drop_table("recviz_charts")
```

### Sidebar Nav Update
```typescript
// Source: frontend/src/components/layout/nav-main.tsx [VERIFIED: codebase]
// Add Charts item between Datasets and Data Explorer:
import { BarChart3, Database, FileBarChart, LayoutDashboard, Settings, Table2, PieChart } from 'lucide-react'

// In navItems[0].items array, insert after Datasets:
{
  title: 'Charts',
  href: '/charts',
  icon: PieChart,  // or BarChart3 -- BarChart3 already used by RecViz logo
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded CHART_DATASOURCE_MAP | RecViz chart library with dynamic dataset references | Phase 6 (now) | Charts no longer hardcoded; users create them dynamically |
| Superset chart objects | RecViz-only PostgreSQL persistence | Phase 6 design decision (D-15) | Eliminates Superset sync complexity |
| Dataset delete ignores chart refs | Dataset delete checks recviz_charts FK | Phase 6 implementation | Prevents orphaned charts |

**Key insight:** AG Charts v13 (installed) supports all required standard types including bullet and box-plot via Enterprise license. ECharts v6 (installed) supports all required exotic types. No library upgrades needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Chart config JSONB stores column_mapping + appearance as recommended structure | Architecture Patterns (Pattern 1) | Low -- structure is Claude's discretion per CONTEXT.md, can adjust at implementation |
| A2 | Radix Accordion supports controlled single-value mode with programmatic step management | Architecture Patterns (Pattern 3) | Low -- Radix docs confirm controlled mode via `value`/`onValueChange` props |
| A3 | AG Charts Enterprise v13 supports bullet and box-plot chart types | Pitfall 6 | Medium -- if not supported, those types would need ECharts or deferral. CHRT-05 lists them. |
| A4 | 50 rows is an appropriate limit for "Preview Data" sample fetch | Claude's Discretion | Low -- purely a UX choice, can adjust |
| A5 | Adding "config" to DATA_KEYS in api-client.ts is the correct approach for preventing column name corruption | Pitfall 5 | Medium -- could alternatively structure the config differently to avoid the issue |

## Open Questions

1. **Bullet and Box Plot in AG Charts v13**
   - What we know: AG Charts Enterprise supports these types, and they are listed in CHRT-05 requirements
   - What's unclear: The exact AG Charts series type names for bullet and box-plot, and what configuration they need (e.g., bullet needs target/actual values, box-plot needs quartile data)
   - Recommendation: Verify during implementation by checking AG Charts docs. If not supported in v13, defer to a later phase or use ECharts fallback

2. **Preview Data Source for Builder**
   - What we know: Dataset has both a raw SQL query and a Superset datasource ID (after sync)
   - What's unclear: Should preview data be fetched via SQL Lab execute (raw SQL) or via data source query (Superset aggregation)?
   - Recommendation: Use data source query endpoint for chart preview rendering (Steps 3-5) since it produces aggregated data matching how the chart will look on a dashboard. Use SQL Lab execute for the "Preview Data" raw table in Step 1.

3. **Dashboard Reference Check for Chart Delete (D-20)**
   - What we know: Charts should block deletion when referenced by dashboards. But dashboards don't exist yet (Phase 8).
   - What's unclear: Without dashboard tables, there's nothing to check against.
   - Recommendation: Implement the reference check endpoint with a placeholder that always returns `canDelete: true` and `referencingDashboards: []`. Phase 8 will wire this up with real dashboard-chart references. Same pattern as Phase 5's chart reference placeholder.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend), pytest (backend) |
| Config file | frontend/vitest.config.ts, backend/pytest.ini (or pyproject.toml) |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` / `cd backend && python -m pytest -x` |
| Full suite command | `cd frontend && npx vitest run` / `cd backend && python -m pytest` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHRT-01 | Create chart via builder steps | integration / e2e | Playwright | Wave 0 |
| CHRT-02 | Chart type compatibility with data shape | unit | `npx vitest run src/lib/chart-compatibility.test.ts` | Wave 0 |
| CHRT-03 | Save chart to library (backend CRUD) | unit/integration | `python -m pytest tests/test_managed_charts.py -x` | Wave 0 |
| CHRT-04 | Chart reusability (reference model) | unit | `python -m pytest tests/test_managed_charts.py::test_chart_reference -x` | Wave 0 |
| CHRT-05 | AG Charts renders standard types | unit | `npx vitest run src/components/charts/ag-chart-wrapper.test.ts` | Existing (partial) |
| CHRT-06 | ECharts renders exotic types | unit | `npx vitest run src/components/charts/echart-wrapper.test.ts` | Existing (partial) |
| CHRT-07 | Browse/search chart library | e2e | Playwright | Wave 0 |

### Sampling Rate
- **Per task commit:** Quick vitest + pytest run
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green + Playwright visual verification before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/lib/chart-compatibility.test.ts` -- covers CHRT-02 compatibility logic
- [ ] `backend/tests/test_managed_charts.py` -- covers CHRT-03/CHRT-04 backend CRUD
- [ ] `frontend/src/hooks/use-managed-charts.test.ts` -- covers frontend CRUD hooks

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in v1 (deferred to SECU-01) |
| V3 Session Management | no | No sessions in v1 |
| V4 Access Control | no | No RBAC in v1 (deferred to SECU-03) |
| V5 Input Validation | yes | Pydantic v2 models with Field constraints (min_length, max_length) |
| V6 Cryptography | no | No crypto needed for chart configs |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via chart config | Tampering | Charts don't contain SQL -- they reference datasets by ID. Queries go through Superset. |
| JSONB injection | Tampering | Pydantic v2 validates config structure before storage |
| Resource exhaustion (large config) | DoS | Pydantic Field(max_length=...) on string fields, reasonable JSONB depth limits |

## Sources

### Primary (HIGH confidence)
- Codebase files: `backend/app/db/models/dataset.py`, `backend/app/api/managed_datasets.py`, `backend/app/models/managed_dataset.py` -- dataset CRUD pattern to clone
- Codebase files: `frontend/src/components/charts/ag-chart-wrapper.tsx`, `frontend/src/components/charts/echart-wrapper.tsx`, `frontend/src/components/charts/chart-factory.tsx` -- chart rendering infrastructure
- Codebase files: `frontend/src/hooks/use-managed-datasets.ts`, `frontend/src/types/managed-dataset.ts` -- TanStack Query CRUD hook pattern
- Codebase files: `frontend/src/components/datasets/dataset-list.tsx`, `frontend/src/components/datasets/dataset-card.tsx` -- list page pattern to clone
- Codebase file: `frontend/src/components/layout/nav-main.tsx` -- sidebar navigation to modify
- Codebase file: `frontend/src/lib/api-client.ts` -- API client with DATA_KEYS skip set
- Codebase file: `backend/app/api/router.py` -- route registration order matters
- npm registry: ag-charts-enterprise@13.2.0, echarts@6.0.0, @radix-ui/react-accordion@1.2.12 -- verified versions
- Phase 6 CONTEXT.md: D-01 through D-24 -- locked user decisions
- Phase 6 UI-SPEC: Component inventory, interaction contract, chart type compatibility rules

### Secondary (MEDIUM confidence)
- Radix UI Accordion API documentation -- controlled mode with value/onValueChange

### Tertiary (LOW confidence)
- AG Charts Enterprise bullet and box-plot type support -- needs verification during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in package.json / pip requirements
- Architecture: HIGH -- 90% pattern cloning from Phase 5, chart rendering reuses existing infrastructure
- Pitfalls: HIGH -- identified from actual codebase analysis (route collision, camelCase transform, missing types, placeholder wiring)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- libraries are pinned, patterns are established)
