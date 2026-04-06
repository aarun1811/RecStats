# Phase 8: Dashboard Builder - Research

**Researched:** 2026-04-07
**Domain:** Dashboard builder (drag-and-drop grid layout, CRUD persistence, filter/cross-filter/drill config, view/edit mode)
**Confidence:** HIGH

## Summary

Phase 8 builds a visual dashboard builder -- the core product of RecViz. Business users create, edit, and manage dashboards through a WYSIWYG editor with drag-and-drop layout (react-grid-layout v2), chart/KPI/grid panel placement, filter configuration, and save/publish workflow. The builder produces the same `DashboardConfig` JSON that the existing renderer already consumes. The existing ConfigStore (read-only) must be extended with full CRUD operations, and the dashboard list page must be upgraded to match the chart/KPI library pattern.

The three research-flagged items (filter value population across datasets, cross-filter builder config, drill-down builder config) all have clear solutions based on the existing codebase patterns. react-grid-layout v2.2.3 is production-ready with built-in TypeScript types and React 19 compatibility. Undo/redo is best implemented as a simple Zustand layout history store (no library needed) given the narrow scope (layout snapshots only).

**Primary recommendation:** Use react-grid-layout v2 (native API, not legacy wrapper) with `useContainerWidth` hook, extend ConfigStore with CRUD matching the managed_charts/managed_kpis pattern, and implement undo/redo as a dedicated Zustand store with layout JSON snapshots capped at 50 entries.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use react-grid-layout for drag-and-drop grid canvas. 12-column grid with snap-to-grid, collision detection, layout serialization. Maps 1:1 to existing ChartLayout type.
- **D-02:** Type-based minimum sizes: Charts min 3x3, KPI cards min 2x2, Data grids min 6x4, Filter bar 12x1 (fixed, not a grid item).
- **D-03:** Title bar drag + corner resize. Grip icon on panel header initiates drag. Bottom-right corner handle for resize. Edit and remove buttons on header. Chart content stays interactive during edit mode.
- **D-04:** Vertical compaction ON. Items always float up to fill vertical gaps.
- **D-05:** No overlap, push others. react-grid-layout default collision detection.
- **D-06:** Fixed 80px row height. Grid gap 16px (Tailwind gap-4). KPI card (2 rows) = 160px, standard chart (4 rows) = 320px, data grid (6 rows) = 480px.
- **D-07:** Undo/redo for layout changes. Ctrl+Z / Ctrl+Shift+Z. Zustand store with layout JSON snapshots, capped at ~50 entries, reset on Save. Client-only.
- **D-08:** In-place WYSIWYG editing. Edit page IS the dashboard at full width. Edit toolbar at top, dashed grid lines on canvas, panels get drag handles + edit/remove buttons, blue outline on hover. Real data renders inside charts while editing.
- **D-09:** Route pattern: /dashboards (list), /dashboards/new (create), /dashboards/:id (view), /dashboards/:id/edit (edit).
- **D-10:** Full-page canvas with top toolbar. No side panel. Toolbar contains: [+ Add], [Undo], [Redo], [Save], [Save As], [Cancel/Exit].
- **D-11:** Single [+ Add] button with type picker dropdown: Chart, KPI, Data Grid, Filter.
- **D-12:** Library dialog picker for charts and KPIs. Browse existing library items with search. [+ Create New] navigates to chart/KPI builder. No inline builder.
- **D-13:** Panel edit button opens config popover with panel-specific settings: title override, cross-filter toggle, drill hierarchy config, per-chart refresh interval. [Edit Chart] link navigates to full chart/KPI builder.
- **D-14:** Centered empty state for new dashboards.
- **D-15:** WYSIWYG is sufficient, no separate preview mode.
- **D-16:** Extend existing ConfigStore with full CRUD. Same DashboardConfig JSON shape. Backward-compatible.
- **D-17:** Save As = deep copy with new UUID.
- **D-18:** Dashboard list page upgraded to match chart/KPI library pattern.
- **D-19:** Simple delete confirmation dialog.
- **D-20:** Dataset column picker for filters. Auto-detect filter type from column metadata.
- **D-21:** Auto-match + manual override per chart for filter column mapping.
- **D-22:** Cascading filters supported via existing dependsOn field.
- **D-23:** Drag to reorder filters in edit mode.
- **D-24:** Filter bar fixed at top, outside grid.
- **D-25:** Data grid: pick dataset, auto-populate columns. Config popover for column visibility, sort, row limit.
- **D-26:** Research: cross-filter participation and column mapping per chart in builder (addressed below).
- **D-27:** Research: drill hierarchy visual configuration per chart (addressed below).
- **D-28:** Research: filter value population across multiple datasets (addressed below).
- **D-29:** Claude's discretion: unsaved changes handling.
- **D-30:** Clean rewrite. No obligation to reuse existing dashboard builder code.
- **D-31:** Many small plans across waves.

### Claude's Discretion
- Dashboard metadata editing UX (inline title + popover, settings dialog, etc.)
- Unsaved changes handling approach
- Edit toolbar layout and icon choices
- Panel config popover design details
- Library picker dialog card layout
- Empty state illustration/icon
- react-grid-layout configuration details (margin, container padding)
- Animation timings for drag/resize/mode transitions

### Deferred Ideas (OUT OF SCOPE)
- Dashboard templates (TMPL-01)
- Dashboard versioning (ADVN-03)
- User-configurable KPI thresholds
- Custom color palettes per dashboard
- Inline chart type switching (TMPL-03)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLDR-01 | User can create a new dashboard with title and description | ConfigStore CRUD extension, /dashboards/new route, backend POST endpoint |
| BLDR-02 | Grid-based layout editor -- drag, drop, resize chart panels, KPI cards, filter bars on 12-column grid | react-grid-layout v2.2.3 with useContainerWidth, LayoutItem mapping to ChartLayout |
| BLDR-03 | User can add charts by building new or picking from library | Library picker dialog reusing useManagedCharts hook, navigate-to-builder flow |
| BLDR-04 | User can add/remove/configure filters from available dataset columns | Dataset column picker, filter type auto-detection, auto-match + manual override column mapping |
| BLDR-05 | User can add KPI cards from KPI library | Library picker dialog reusing useManagedKpis hook |
| BLDR-06 | View mode vs edit mode toggle -- visually distinct, clean toggle | Separate routes /:id (view) vs /:id/edit (edit), DashboardRenderer for view, builder canvas for edit |
| BLDR-07 | Dashboards persist with save, save-as, delete | ConfigStore CRUD (create/update/delete), save-as = deep copy with new UUID |
| BLDR-08 | Dashboard list page with search, title, description, last modified, creator | Upgraded list page matching chart/KPI library pattern (card/row toggle, search, toolbar) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Strict TypeScript:** No `any`, no `@ts-ignore`. Use `unknown` + type narrowing.
- **Named exports** for all components, hooks, stores, utilities. Exception: page components use `default export` (TanStack Router file-based routing).
- **Props interface** named `{ComponentName}Props`, defined above component.
- **Hooks return objects**, not arrays.
- **No barrel exports.**
- **File naming:** kebab-case.tsx for components, use-{name}.ts for hooks, {name}-store.ts for stores.
- **Shadcn/ui rules:** Owned code in src/components/ui/. Extend via composition, don't modify base files.
- **Tailwind CSS:** Shadcn CSS variable colors only. Never hardcode hex/rgb/hsl. Dark mode via `dark:` variant.
- **State management:** Zustand for client state, TanStack Query for server state. Never store fetched data in Zustand.
- **Query key convention:** `['entity', identifier, filters]`.
- **API client:** Single api-client.ts with DATA_KEYS set (`rows`, `columns`, `data`, `config` skip camelCase transform).
- **Python/FastAPI:** async everywhere, Pydantic v2, service layer pattern, dependency injection.
- **Animations:** Import from `motion/react`, NOT `framer-motion`. Keep fast (200-300ms).
- **Dark mode:** Every component MUST work in both light and dark.
- **Desktop-first** application.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-grid-layout | 2.2.3 | Drag-and-drop grid canvas | Only maintained React grid layout library with collision detection, compaction, and serialization. v2 is TypeScript-native with hooks API. [VERIFIED: npm registry] |
| zustand | 5.0.11 | Undo/redo layout history store + builder state | Already in project. Layout snapshots are pure client state -- fits Zustand perfectly. [VERIFIED: package.json] |
| @tanstack/react-query | 5.90.20 | Dashboard CRUD mutations + chart/KPI library queries | Already in project. Handles server state, cache invalidation. [VERIFIED: package.json] |
| @tanstack/react-router | 1.159.5 | File-based routing for /dashboards/new and /:id/edit routes | Already in project. [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| motion | 12.34.0 | Page transitions, panel add/remove animations | Already in project. Import from `motion/react`. [VERIFIED: package.json] |
| lucide-react | 0.563.0 | Icons for toolbar, drag handles, panel actions | Already in project. [VERIFIED: package.json] |
| sonner | 2.0.7 | Toast notifications for save/delete/error | Already in project. [VERIFIED: package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-grid-layout | @dnd-kit/core + custom grid | Much more manual work: collision detection, compaction, snap-to-grid all hand-rolled. RGL has these built-in. |
| Custom undo/redo store | zundo (Zustand middleware) | zundo is generic undo/redo for entire store state. Our use case is narrower (layout snapshots only, ~50 cap, reset on save). A focused 30-line store is simpler and avoids an extra dependency. [ASSUMED] |
| Custom undo/redo store | zustand-travel | JSON Patch approach is overkill for layout arrays. Adds complexity for minimal benefit. |

**Installation:**
```bash
cd frontend && pnpm add react-grid-layout
```

**No @types/react-grid-layout needed** -- v2 ships built-in TypeScript types via `dist/index.d.ts`. [VERIFIED: npm view react-grid-layout types]

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
  components/
    builder/                   # All builder-specific components
      builder-canvas.tsx       # react-grid-layout canvas wrapper
      builder-toolbar.tsx      # Top toolbar ([+ Add], Undo, Redo, Save, etc.)
      builder-panel.tsx        # Individual panel wrapper (drag handle, edit/remove)
      panel-config-popover.tsx # Per-panel config popover (title, cross-filter, drill)
      add-content-dialog.tsx   # Type picker dialog (Chart, KPI, Data Grid, Filter)
      chart-picker-dialog.tsx  # Browse chart library dialog
      kpi-picker-dialog.tsx    # Browse KPI library dialog
      dataset-picker-dialog.tsx # Dataset picker for data grids
      filter-config-dialog.tsx # Dataset column picker for filters
      filter-column-mapper.tsx # Per-chart filter column mapping override
      drill-hierarchy-editor.tsx # Drill hierarchy ordered list editor
      dashboard-empty-state.tsx # Empty canvas state
      dashboard-metadata-editor.tsx # Inline title/description editing
      save-as-dialog.tsx       # Save As dialog (name + description)
      delete-dashboard-dialog.tsx # Delete confirmation
    dashboard/
      dashboard-list.tsx       # Upgraded list page (replaces inline code in route)
      dashboard-list-card.tsx  # Dashboard card for list
      dashboard-list-row.tsx   # Dashboard row for list view
      dashboard-list-toolbar.tsx # Search + view toggle toolbar
  hooks/
    use-managed-dashboards.ts  # CRUD hooks for dashboards
  stores/
    builder-store.ts           # Builder state (current config, dirty flag)
    layout-history-store.ts    # Undo/redo layout snapshots
  routes/_app/dashboards/
    index.tsx                  # Dashboard list (upgraded)
    new.tsx                    # Create new dashboard (builder in create mode)
    $dashboardId.tsx           # View dashboard (existing, enhanced)
    $dashboardId.edit.tsx      # Edit dashboard (builder in edit mode)
  types/
    builder.ts                 # Builder-specific types
```

### Pattern 1: react-grid-layout v2 Integration

**What:** Wrap react-grid-layout v2 with the `useContainerWidth` hook for responsive width measurement. Map between RGL's `LayoutItem` format and our `ChartLayout` type.

**When to use:** The builder canvas component.

**Example:**
```typescript
// Source: https://github.com/react-grid-layout/react-grid-layout [VERIFIED: GitHub README + npm]
import ReactGridLayout, { useContainerWidth } from 'react-grid-layout'
import type { LayoutItem, Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

// Map our ChartLayout to RGL LayoutItem
function toRglLayout(items: BuilderItem[]): Layout {
  return items.map((item) => ({
    i: item.id,
    x: item.layout.col,
    y: item.layout.row,
    w: item.layout.width,
    h: item.layout.height,
    minW: getMinWidth(item.type),  // Chart: 3, KPI: 2, Grid: 6
    minH: getMinHeight(item.type), // Chart: 3, KPI: 2, Grid: 4
  }))
}

// Map RGL LayoutItem back to our ChartLayout
function fromRglLayout(rglItem: LayoutItem): ChartLayout {
  return {
    col: rglItem.x,
    row: rglItem.y,
    width: rglItem.w,
    height: rglItem.h,
  }
}

function BuilderCanvas({ items, onLayoutChange }: BuilderCanvasProps) {
  const { width, containerRef, mounted } = useContainerWidth()

  return (
    <div ref={containerRef}>
      {mounted && (
        <ReactGridLayout
          layout={toRglLayout(items)}
          width={width}
          gridConfig={{ cols: 12, rowHeight: 80, margin: [16, 16] }}
          dragConfig={{ enabled: true, handle: '.drag-handle' }}
          resizeConfig={{ enabled: true }}
          onLayoutChange={(newLayout) => onLayoutChange(newLayout)}
        >
          {items.map((item) => (
            <div key={item.id}>
              <BuilderPanel item={item} />
            </div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  )
}
```

### Pattern 2: Undo/Redo Layout History Store

**What:** A dedicated Zustand store that tracks layout snapshots for undo/redo. Push a snapshot on every layout change, cap at 50 entries, reset on Save.

**When to use:** Builder canvas layout changes (drag, resize, add, remove).

**Example:**
```typescript
// Source: Project convention (Zustand stores) [VERIFIED: codebase pattern]
import { create } from 'zustand'
import type { Layout } from 'react-grid-layout'

interface LayoutHistoryStore {
  past: Layout[]
  future: Layout[]
  pushLayout: (layout: Layout) => void
  undo: () => Layout | null
  redo: () => Layout | null
  reset: () => void
  canUndo: boolean
  canRedo: boolean
}

const MAX_HISTORY = 50

export const useLayoutHistoryStore = create<LayoutHistoryStore>((set, get) => ({
  past: [],
  future: [],
  get canUndo() { return get().past.length > 0 },
  get canRedo() { return get().future.length > 0 },

  pushLayout: (layout) =>
    set((s) => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), layout],
      future: [], // Clear redo stack on new action
    })),

  undo: () => {
    const { past } = get()
    if (past.length === 0) return null
    const previous = past[past.length - 1]
    set((s) => ({
      past: s.past.slice(0, -1),
      future: [previous, ...s.future],  // Note: caller pushes current before undoing
    }))
    return previous
  },

  redo: () => {
    const { future } = get()
    if (future.length === 0) return null
    const next = future[0]
    set((s) => ({
      past: [...s.past, next],
      future: s.future.slice(1),
    }))
    return next
  },

  reset: () => set({ past: [], future: [] }),
}))
```

### Pattern 3: ConfigStore CRUD Extension

**What:** Extend the existing read-only ConfigStore with create, update, and delete operations. Follow the exact same pattern as managed_charts and managed_kpis endpoints.

**When to use:** Dashboard persistence (save, save-as, delete).

**Example (backend):**
```python
# Source: backend/app/api/managed_charts.py pattern [VERIFIED: codebase]
# In config_store.py -- add these methods to ConfigStore class:

async def create_dashboard(self, dashboard_id: str, name: str,
                           description: str, config: dict) -> RecvizDashboard:
    row = RecvizDashboard(
        id=dashboard_id,
        name=name,
        description=description,
        schema_version=1,
        config=config,
    )
    self._session.add(row)
    await self._session.flush()
    return row

async def update_dashboard(self, dashboard_id: str,
                           updates: dict) -> RecvizDashboard | None:
    row = await self._session.get(RecvizDashboard, dashboard_id)
    if not row:
        return None
    for key, value in updates.items():
        setattr(row, key, value)
    return row

async def delete_dashboard(self, dashboard_id: str) -> bool:
    row = await self._session.get(RecvizDashboard, dashboard_id)
    if not row:
        return False
    await self._session.delete(row)
    return True
```

**Example (frontend hooks):**
```typescript
// Source: frontend/src/hooks/use-managed-charts.ts pattern [VERIFIED: codebase]
export function useManagedDashboards() {
  return useQuery({
    queryKey: ['managed-dashboards'],
    queryFn: () => api.get<DashboardListItem[]>('/api/dashboards'),
  })
}

export function useCreateDashboard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: DashboardCreate) =>
      api.post<DashboardResponse>('/api/dashboards', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-dashboards'] })
    },
  })
}

export function useUpdateDashboard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DashboardUpdate }) =>
      api.put<DashboardResponse>(`/api/dashboards/${id}`, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['managed-dashboards'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-config', id] })
    },
  })
}
```

### Pattern 4: Builder State Store

**What:** Zustand store for the dashboard being edited. Holds the full `DashboardConfig` (charts, KPIs, grids, filters, layout) plus dirty flag. Does NOT hold server state -- that stays in TanStack Query.

**When to use:** Edit mode. Initialized from the fetched DashboardConfig, mutated by builder actions, serialized back on Save.

**Example:**
```typescript
// Source: Project pattern [VERIFIED: codebase convention]
import { create } from 'zustand'
import type { DashboardConfig } from '@/types/dashboard-config'

interface BuilderStore {
  config: DashboardConfig | null
  isDirty: boolean

  // Actions
  initFromConfig: (config: DashboardConfig) => void
  updateName: (name: string) => void
  updateDescription: (description: string) => void
  addChart: (chartRef: BuilderChartRef) => void
  removeChart: (chartId: string) => void
  addKpi: (kpiRef: BuilderKpiRef) => void
  removeKpi: (kpiId: string) => void
  addGrid: (gridRef: BuilderGridRef) => void
  removeGrid: (gridId: string) => void
  addFilter: (filter: FilterConfig) => void
  removeFilter: (filterId: string) => void
  updateFilter: (filterId: string, updates: Partial<FilterConfig>) => void
  reorderFilters: (filterIds: string[]) => void
  updateLayouts: (layouts: Record<string, ChartLayout>) => void
  updatePanelConfig: (itemId: string, updates: PanelConfigUpdate) => void
  markClean: () => void
  getSerializableConfig: () => DashboardConfig
}
```

### Anti-Patterns to Avoid

- **Storing react-grid-layout state in TanStack Query:** Layout is client state while editing. Only persisted on Save. Keep in Zustand.
- **Modifying DashboardConfig type for builder-only fields:** Create a separate `BuilderItem` type that wraps library references. Serialize to DashboardConfig on save.
- **Using legacy react-grid-layout wrapper:** The legacy wrapper exists for v1 migration. Use the v2 native API with hooks for better TypeScript support and tree-shaking.
- **Inline chart/KPI builders in the dashboard builder:** D-12 explicitly says "No inline builder." Navigate to the existing chart/KPI builder pages instead.
- **Putting undo/redo logic inside the builder store:** Keep it separate (layout-history-store) for single responsibility. The builder store tracks config, the history store tracks layout snapshots.

## Research Findings: Flagged Items

### Research Item 1: Filter Value Population Across Multiple Datasets (D-28)

**Problem:** When a filter maps to different columns in different datasets, which dataset(s) should be queried for DISTINCT values?

**Finding:** The existing `FilterConfig.optionsSource` already specifies a single `dataSourceId` and `valueColumn` for fetching distinct values. This is the correct approach.

**Recommendation:** Use the **first dataset that contains the filter column** as the options source. The auto-match logic (D-21) maps a filter to charts/datasets. When building the filter config:

1. The user picks a column name (e.g., `region`) from one dataset
2. That dataset becomes the `optionsSource.dataSourceId`
3. The column becomes `optionsSource.valueColumn`
4. For other datasets with differently-named columns (e.g., `country`), the manual column mapping (D-21) only maps the filter application -- it does NOT change where values come from

**Why this works:**
- DISTINCT values come from the primary dataset (the one the user chose the column from)
- The existing `/api/data-sources/{id}/distinct/{column}` endpoint already handles this
- Cascading filters already work via `dependsOn` in `FilterOptionsSource`
- If the column values differ across datasets (e.g., `region` has different values than `country`), filtering still works because cross-dataset filtering is backend-side WHERE clauses -- the filter value is sent to each dataset's query, and the column mapping tells each dataset which column to filter on

**Confidence:** HIGH [VERIFIED: codebase -- use-filter-options.ts, config-filter-bar.tsx, FilterConfig type]

### Research Item 2: Cross-Filter Builder Configuration (D-26)

**Problem:** How should users configure cross-filter participation and column mapping per chart in the builder?

**Finding:** The existing cross-filter system uses **column-name matching** (Phase 2 decision). When chart A emits a cross-filter on column `region`, charts B and C are filtered if they have a column named `region` in their data. The `DashboardChartConfig.crossFilter` field is a boolean opt-out (default: participates).

**Recommendation:** The panel config popover (D-13) needs:

1. **Cross-filter toggle:** Simple on/off switch. Maps to `DashboardChartConfig.crossFilter` (boolean). Default ON (participates). When OFF, this chart neither emits nor receives cross-filters.

2. **Column mapping is NOT needed in the builder UI** because:
   - Cross-filtering already works by column-name matching at runtime (Phase 2 D-07)
   - Charts from different datasets that share column names automatically participate
   - Charts without matching columns are automatically excluded
   - There is no existing config field for cross-filter column mapping -- and adding one would require modifying the renderer too
   - The real-world case of mismatched column names (e.g., `region` vs `country`) is already handled by the fact that cross-filtering only applies to matching columns

3. **If manual cross-filter column mapping is needed later** (v2), add an optional `crossFilterColumnMap` field to `DashboardChartConfig` and update `applyCrossFilters()` in `cross-filter.ts` to consult it. But this is beyond Phase 8 scope.

**Confidence:** HIGH [VERIFIED: codebase -- cross-filter.ts, DashboardChartConfig type, filter-store.ts]

### Research Item 3: Drill-Down Builder Configuration (D-27)

**Problem:** How should users visually configure drill hierarchies per chart in the builder?

**Finding:** The existing drill system uses:
- `DashboardChartConfig.drillHierarchy`: `string[]` -- ordered list of column names defining the drill path (e.g., `['region', 'country', 'city']`)
- `DashboardChartConfig.drillDetailDataSourceId`: `string | undefined` -- data source for the detail-level grid that appears when drilling past the last hierarchy level

**Recommendation:** The panel config popover (D-13) needs a **drill hierarchy editor**:

1. **Column list builder:** Show all columns from the chart's dataset (fetched via `useManagedDataset(chart.datasetId)`). User picks columns in order to define the drill path. Drag to reorder. Each column shows its display name from dataset metadata.

2. **Detail data source picker:** Optional dropdown listing all datasets. Used for the `drillDetailDataSourceId` field. When set, drilling past the last hierarchy level shows a detail grid.

3. **UI pattern:** Ordered list with:
   - [+ Add Level] button that opens a column picker dropdown
   - Drag handles for reordering
   - Remove (x) button per level
   - "Detail Grid" section below with dataset dropdown (optional)

4. **How to get the column list:** The chart references a managed chart (via chart library), which has a `datasetId`. Use `useManagedDataset(datasetId)` to get `columns: DatasetColumnMeta[]`. Filter to `role === 'dimension'` for the drill column picker (measures don't make sense as drill levels). Show `displayName` but store `name`.

**Confidence:** HIGH [VERIFIED: codebase -- DashboardChartConfig type, use-drill-down.ts, managed-dataset.ts DatasetColumnMeta]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grid drag-and-drop with collision detection | Custom drag/resize/snap/compact system | react-grid-layout v2.2.3 | Handles collision detection, compaction, snap-to-grid, layout serialization. Battle-tested. |
| Container width measurement | Manual ResizeObserver | react-grid-layout `useContainerWidth()` hook | Built into RGL v2. Returns `{ width, containerRef, mounted }`. |
| UUID generation | Custom ID scheme | `crypto.randomUUID()` | Native browser API, available in all modern browsers. Used for new dashboard/panel IDs. |
| Toast notifications | Custom notification system | Sonner (already in project) | `toast.success('Dashboard saved')`, `toast.error('Failed to save')`. |
| Dialog/popover/dropdown | Custom overlays | Shadcn Dialog, Popover, DropdownMenu (already in project) | Accessible, composable, themed. |

**Key insight:** The dashboard builder is complex enough without building layout infrastructure from scratch. react-grid-layout handles the hardest part (drag-and-drop with compaction and collision avoidance). Everything else is standard CRUD + UI composition using existing project patterns.

## Common Pitfalls

### Pitfall 1: react-grid-layout v2 Width Prop Required
**What goes wrong:** Rendering with `width={0}` or without the `mounted` check causes invisible or broken grid.
**Why it happens:** v2 requires explicit width (no auto-measurement). The `useContainerWidth()` hook returns `mounted: false` until the container is measured.
**How to avoid:** Always gate rendering on `mounted === true`: `{mounted && <ReactGridLayout width={width} ... />}`.
**Warning signs:** Grid items render at 0 width or overlap on initial render.

### Pitfall 2: react-grid-layout CSS Not Imported
**What goes wrong:** Grid items have no visual feedback during drag/resize. Items may not render correctly.
**Why it happens:** react-grid-layout requires two CSS files to be imported.
**How to avoid:** Import both CSS files in the builder canvas component: `import 'react-grid-layout/css/styles.css'` and `import 'react-resizable/css/styles.css'`.
**Warning signs:** Drag handles invisible, resize handles missing, items jump on drag start.

### Pitfall 3: Layout State Ping-Pong Between Zustand and RGL
**What goes wrong:** Infinite re-render loop when react-grid-layout's `onLayoutChange` callback updates Zustand state which re-renders the grid which triggers `onLayoutChange` again.
**Why it happens:** RGL fires `onLayoutChange` on mount and on every render if the layout changes.
**How to avoid:** Compare the incoming layout with the current Zustand state before updating. Use a ref to track whether the change was user-initiated (drag/resize) vs programmatic.
**Warning signs:** "Maximum update depth exceeded" error, browser freezing.

### Pitfall 4: api-client DATA_KEYS and Dashboard Config
**What goes wrong:** Dashboard `config` field gets camelCase-transformed when it should preserve the backend's key format.
**Why it happens:** The api-client transforms all keys to camelCase except those in DATA_KEYS. `config` is already in DATA_KEYS, so dashboard CRUD responses with a `config` field are correctly preserved.
**How to avoid:** Verify that the dashboard CRUD response structure uses `config` as the nested JSON field name (it does -- matches chart/KPI pattern). No additional DATA_KEYS entries needed.
**Warning signs:** Config keys like `cross_filter` staying snake_case or double-transforming.

### Pitfall 5: Builder vs Renderer Config Shape Mismatch
**What goes wrong:** The builder produces a DashboardConfig that the renderer can't consume, or vice versa.
**Why it happens:** Builder creates a different JSON shape than what the renderer expects.
**How to avoid:** The builder MUST produce the exact `DashboardConfig` type. Use the same Pydantic models and TypeScript types. Test round-trip: create in builder, view in renderer, edit in builder again.
**Warning signs:** Charts not rendering in view mode, filters not working after save.

### Pitfall 6: Unsaved Changes Lost on Navigation
**What goes wrong:** User navigates away from the builder without saving, losing all work.
**Why it happens:** No guard on route changes.
**How to avoid:** Implement `beforeunload` browser event for page close/refresh. For in-app navigation, use TanStack Router's `beforeLoad` or a navigation guard pattern. Show a confirmation dialog when `isDirty` is true.
**Warning signs:** User complaints about lost work. Accidental browser back button.

### Pitfall 7: react-grid-layout onDragStart Threshold
**What goes wrong:** Click events on chart content are intercepted by drag-and-drop in edit mode.
**Why it happens:** v2 has a 3px drag threshold (not 0 like v1). But chart click handlers (cross-filter, drill) might still conflict.
**How to avoid:** Use `.drag-handle` CSS selector in `dragConfig.handle` to restrict drag initiation to the panel title bar only. This is already specified in D-03.
**Warning signs:** Charts not clickable in edit mode, accidental drags when trying to interact with chart content.

## Code Examples

### react-grid-layout v2 with Custom CSS for Builder Canvas

```typescript
// Source: react-grid-layout v2 docs + project conventions [VERIFIED: GitHub README]
import ReactGridLayout, { useContainerWidth, verticalCompactor } from 'react-grid-layout'
import type { Layout, LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

interface BuilderCanvasProps {
  layout: Layout
  onLayoutChange: (layout: Layout) => void
  children: React.ReactNode
}

export function BuilderCanvas({ layout, onLayoutChange, children }: BuilderCanvasProps) {
  const { width, containerRef, mounted } = useContainerWidth()

  return (
    <div
      ref={containerRef}
      className="relative min-h-[400px] rounded-lg border-2 border-dashed border-muted-foreground/20"
      style={{
        backgroundImage:
          'radial-gradient(circle, hsl(var(--muted-foreground) / 0.15) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {mounted && (
        <ReactGridLayout
          layout={layout}
          width={width}
          gridConfig={{
            cols: 12,
            rowHeight: 80,
            margin: [16, 16],
            padding: [16, 16],
          }}
          dragConfig={{
            enabled: true,
            handle: '.drag-handle',
          }}
          resizeConfig={{
            enabled: true,
          }}
          compactor={verticalCompactor}
          onLayoutChange={onLayoutChange}
        >
          {children}
        </ReactGridLayout>
      )}
    </div>
  )
}
```

### Builder Panel Wrapper

```typescript
// Source: Project pattern [VERIFIED: CONTEXT.md D-03]
import { GripVertical, Pencil, X } from 'lucide-react'

interface BuilderPanelProps {
  item: BuilderItem
  isEditMode: boolean
  onEdit: () => void
  onRemove: () => void
  children: React.ReactNode
}

export function BuilderPanel({ item, isEditMode, onEdit, onRemove, children }: BuilderPanelProps) {
  return (
    <div className="group relative h-full rounded-lg border bg-card transition-colors hover:border-primary/50">
      {/* Drag handle header */}
      {isEditMode && (
        <div className="drag-handle flex cursor-grab items-center justify-between border-b px-3 py-1.5 active:cursor-grabbing">
          <div className="flex items-center gap-2">
            <GripVertical className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium truncate max-w-[200px]">
              {item.title}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-1 hover:bg-muted rounded">
              <Pencil className="size-3 text-muted-foreground" />
            </button>
            <button onClick={onRemove} className="p-1 hover:bg-destructive/10 rounded">
              <X className="size-3 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>
      )}
      {/* Panel content */}
      <div className="flex-1 overflow-hidden p-2">
        {children}
      </div>
    </div>
  )
}
```

### Dashboard CRUD Backend Endpoint Pattern

```python
# Source: backend/app/api/managed_charts.py pattern [VERIFIED: codebase]
@router.post("", response_model=DashboardResponse, status_code=201)
async def create_dashboard(
    body: DashboardCreateRequest,
    session: DbSessionDep,
):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    dashboard = RecvizDashboard(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        schema_version=1,
        config=body.config.model_dump(),
        created_at=now,
        updated_at=now,
    )
    session.add(dashboard)
    await session.flush()
    return _to_response(dashboard)
```

### Keyboard Shortcut Registration for Undo/Redo

```typescript
// Source: Standard React pattern [ASSUMED]
import { useEffect } from 'react'

export function useBuilderKeyboardShortcuts(
  onUndo: () => void,
  onRedo: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          onRedo()
        } else {
          onUndo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onUndo, onRedo, enabled])
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-grid-layout v1 (flat props, auto-width) | react-grid-layout v2 (hooks API, explicit width, pluggable compaction) | Dec 2025 (v2.0.0) | Must use `useContainerWidth()` hook. Built-in TS types. |
| @types/react-grid-layout | Built-in TypeScript types in v2 | Dec 2025 | Remove @types/react-grid-layout if installed. v2 ships `dist/index.d.ts`. |
| zundo for undo/redo | Still viable, but custom store preferred for narrow scope | N/A | zundo adds a dependency for <30 lines of custom code. |
| data-grid attribute for layout | Explicit `layout` prop (v2 default) | Dec 2025 | `data-grid` only works in legacy wrapper. Use explicit `layout` prop. |

**Deprecated/outdated:**
- `verticalCompact` prop: Removed in v2. Use `compactor={verticalCompactor}` or `compactor={null}`.
- `data-grid` attribute on children: Only in `react-grid-layout/legacy`. Use explicit `layout` prop.
- UMD bundle: Removed in v2. Use a bundler (Vite in our case).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Custom 30-line undo/redo store is simpler than adding zundo dependency | Alternatives Considered | Low -- zundo would also work fine, just adds a dependency for minimal benefit |
| A2 | react-grid-layout v2 `gridConfig`, `dragConfig`, `resizeConfig` interface names are correct | Code Examples | Medium -- if v2.2.3 changed these, the examples need updating. Verify when installing. |
| A3 | `verticalCompactor` is the correct named export for the default compaction algorithm | Code Examples | Low -- worst case, use `compactType="vertical"` on legacy wrapper as fallback |
| A4 | `useContainerWidth()` is exported from the main `react-grid-layout` entry point | Pattern 1 | Medium -- verify at install time. If not, import from specific subpath. |

## Open Questions

1. **react-grid-layout v2 Exact API Surface**
   - What we know: v2 uses hooks API with `useContainerWidth`, config objects (`gridConfig`, `dragConfig`, etc.), and pluggable compactors. Documentation is on GitHub.
   - What's unclear: Exact prop names and types may have changed between 2.0.0 and 2.2.3. The GitHub README and changelog are the source of truth.
   - Recommendation: Install the library first, inspect `dist/index.d.ts` for exact exported types, then implement. If any v2 API differences from research, the legacy wrapper is a guaranteed fallback.

2. **CSS Conflict Between react-grid-layout Styles and Tailwind**
   - What we know: RGL requires importing two CSS files. Tailwind may override some RGL styles.
   - What's unclear: Whether RGL's CSS classes conflict with Tailwind utility classes.
   - Recommendation: Import RGL CSS files early (in the builder canvas component). Override specific RGL classes with Tailwind if needed. The dashed grid background and panel borders are custom CSS, not RGL.

3. **Dashboard Config Evolution**
   - What we know: The existing `DashboardConfig` type is used by both the renderer and dev-built JSON configs. The builder will produce this same shape.
   - What's unclear: Whether any new fields are needed for builder-specific features (e.g., `createdBy`, `createdAt` at the config level vs. DB column level).
   - Recommendation: Keep the config shape unchanged. Use the DB model's `created_at`/`updated_at` columns for metadata. Add `created_by` as a new DB column (not in the config JSON) when auth is implemented (Phase 9+). For now, the list page shows DB-level metadata.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && pnpm vitest run --reporter=verbose` |
| Full suite command | `cd frontend && pnpm vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BLDR-01 | Create dashboard with title/description | unit + Playwright | `vitest run src/hooks/use-managed-dashboards.test.ts` | No -- Wave 0 |
| BLDR-02 | Grid layout drag/drop/resize | Playwright (visual) | Manual Playwright MCP verification | No -- visual |
| BLDR-03 | Add charts from library | Playwright | Manual Playwright MCP verification | No -- visual |
| BLDR-04 | Add/remove/configure filters | unit + Playwright | `vitest run src/stores/builder-store.test.ts` | No -- Wave 0 |
| BLDR-05 | Add KPIs from library | Playwright | Manual Playwright MCP verification | No -- visual |
| BLDR-06 | View/edit mode toggle | Playwright | Manual Playwright MCP verification | No -- visual |
| BLDR-07 | Save/save-as/delete | unit (hooks) + Playwright | `vitest run src/hooks/use-managed-dashboards.test.ts` | No -- Wave 0 |
| BLDR-08 | Dashboard list with search | Playwright | Manual Playwright MCP verification | No -- visual |

### Sampling Rate
- **Per task commit:** `cd frontend && pnpm vitest run --reporter=verbose`
- **Per wave merge:** `cd frontend && pnpm vitest run && pnpm build`
- **Phase gate:** Full suite green + Playwright MCP visual verification before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/stores/builder-store.test.ts` -- covers builder state mutations (BLDR-01, BLDR-04)
- [ ] `frontend/src/stores/layout-history-store.test.ts` -- covers undo/redo logic (BLDR-02)
- [ ] `frontend/src/hooks/use-managed-dashboards.test.ts` -- covers CRUD hooks (BLDR-01, BLDR-07)
- [ ] Backend test for dashboard CRUD endpoints -- covers persistence (BLDR-07)
- [ ] Framework install: `pnpm add react-grid-layout` -- required before any implementation

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (auth deferred) | N/A |
| V3 Session Management | No (auth deferred) | N/A |
| V4 Access Control | Minimal | No auth yet -- all dashboards are accessible. Dashboard delete is permanent. Confirmation dialog required (D-19). |
| V5 Input Validation | Yes | Pydantic v2 for all request bodies. Dashboard name/description length-limited by DB column (256/1024). Config validated via DashboardConfig Pydantic model. |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Oversized config JSON | Denial of Service | Pydantic model validation + request body size limit (FastAPI default 1MB) |
| XSS via dashboard title/description | Tampering | React auto-escapes JSX content. No `dangerouslySetInnerHTML` used. |
| CSRF on mutation endpoints | Tampering | Not applicable yet (no auth). When auth is added, CSRF tokens via FastAPI middleware. |

## Sources

### Primary (HIGH confidence)
- npm registry: react-grid-layout v2.2.3 (verified version, peer deps, types, release date 2026-03-24)
- npm registry: zundo v2.3.0 (verified version, peer deps -- compatible with Zustand 5)
- GitHub README: react-grid-layout v2 API (useContainerWidth, gridConfig, dragConfig, Layout/LayoutItem types)
- GitHub CHANGELOG: react-grid-layout v2.0.0-v2.2.3 (breaking changes, migration path, bug fixes)
- Codebase: dashboard-config.ts, config_store.py, dashboards.py, managed_charts.py, filter-store.ts, drill-store.ts, cross-filter.ts, use-filter-options.ts, use-drill-down.ts, use-managed-charts.ts, use-managed-kpis.ts, use-managed-datasets.ts, managed-dataset.ts

### Secondary (MEDIUM confidence)
- GitHub releases page for v2.x changelog details

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- react-grid-layout v2.2.3 verified on npm, all other libs already in project
- Architecture: HIGH -- patterns directly derived from existing codebase (chart/KPI library CRUD, Zustand stores, TanStack Query hooks)
- Pitfalls: HIGH -- v2 pitfalls documented from changelog (width required, CSS imports, threshold change). Layout ping-pong is well-known RGL issue.
- Research items: HIGH -- all three resolved from existing codebase analysis (FilterConfig, cross-filter.ts, DashboardChartConfig types)

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (30 days -- stable libraries, locked decisions)
