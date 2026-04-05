# Phase 3: Chart and Grid Interactions - Research

**Researched:** 2026-04-05
**Domain:** Frontend chart/grid interactions -- image export, fullscreen modal, refresh, auto-refresh
**Confidence:** HIGH

## Summary

This phase adds interactive toolbar controls to dashboard chart cards and grid panels: hover-reveal chart toolbar (export PNG/SVG/CSV, clipboard copy, fullscreen, refresh), grid toolbar (CSV, Excel, column visibility, density, auto-size), dashboard-level manual refresh, and configurable auto-refresh. All features are purely frontend -- no backend changes except adding an optional `auto_refresh_interval` field to the dashboard config JSON and Pydantic model.

The key technical finding is that AG Charts 13.x `download()` method supports only `image/png` and `image/jpeg` formats -- NOT SVG. The UI-SPEC calls for SVG export from AG Charts. For AG Charts SVG export, we must use `getImageDataURL()` to get a PNG data URL and then use a canvas-to-SVG workaround, OR we accept that AG Charts only exports PNG/JPEG and restrict SVG export to ECharts only. ECharts 6 supports SVG via `getDataURL({ type: 'svg' })` but requires the `SVGRenderer` to be registered (currently only `CanvasRenderer` is registered). This is the most significant technical constraint in this phase.

**Primary recommendation:** Add `SVGRenderer` to ECharts registration for SVG export support. For AG Charts, offer PNG only (native) and accept this as an AG Charts API limitation. Alternatively, implement client-side canvas-to-SVG conversion, but this adds complexity and fragility.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Hover-reveal icon buttons. Small icons (export, fullscreen, refresh) appear top-right of the chart card on hover. Hidden when not hovering.
- **D-02:** Icons: download/export (dropdown with PNG, SVG, CSV, clipboard options), fullscreen expand, refresh. Exact icon choices at Claude's discretion (Lucide React library).
- **D-03:** Config-data-grid panels in dashboards get a full toolbar: CSV export, Excel export, column visibility toggle, density selector, and auto-size columns button.
- **D-04:** Delete dead code: `frontend/src/components/grid/data-grid.tsx` and `frontend/src/components/grid/grid-toolbar.tsx` are unused. Remove them. Borrow the toolbar pattern for the new config-data-grid toolbar.
- **D-05:** Modal overlay using Radix Dialog (Shadcn `Dialog` component). Chart expands into a centered overlay. Dashboard stays underneath, dimmed. Escape key or backdrop click to dismiss.
- **D-06:** Chart re-renders at the larger modal size with the same data and filter state. Not a screenshot -- a live component.
- **D-07:** Fully interactive in fullscreen. Cross-filter clicks and drill-down double-clicks work exactly as in the normal dashboard view.
- **D-08:** PNG image export via AG Charts `.download()` and ECharts `.getDataURL()` + manual download trigger.
- **D-09:** SVG image export as a secondary option for vector/scalable output.
- **D-10:** CSV data export -- download the chart's underlying data as a CSV file with column headers and rows.
- **D-11:** Copy to clipboard -- chart's underlying data as tab-separated text via `navigator.clipboard.writeText()`.
- **D-12:** Export current visual state (WYSIWYG). If cross-filter dimming is active, the exported image includes the dimming.
- **D-13:** CSV export via AG Grid Enterprise `exportDataAsCsv()`.
- **D-14:** Excel export via AG Grid Enterprise `exportDataAsExcel()`.
- **D-15:** Dashboard-level manual refresh button. Invalidates TanStack Query cache for all data sources on the dashboard and re-fetches.
- **D-16:** Keep previous data visible during refresh with a subtle loading indicator. Uses TanStack Query's `keepPreviousData` / `placeholderData` pattern.
- **D-17:** On refresh failure: keep old data visible, show error toast notification. User can retry. Previous data never disappears on error.
- **D-18:** Both dashboard-wide and per-chart auto-refresh levels. Dashboard config defines a default refresh interval. Individual charts can override with their own interval.
- **D-19:** Default interval: ~10 minutes. Available presets: Off, 1m, 5m, 10m, 30m.
- **D-20:** Interval persisted in dashboard config JSON (not localStorage or session-only). Per-chart overrides also in config.
- **D-21:** Auto-refresh UI design and placement is Claude's discretion.

### Claude's Discretion
- Auto-refresh UI design and placement (D-21)
- Chart toolbar icon selection and hover animation timing
- Export filename conventions
- PNG export resolution/DPI (recommend 2x for retina sharpness)
- Grid toolbar layout and component structure
- Whether per-chart refresh override uses a separate UI control or inherits from chart hover menu
- Fullscreen modal sizing, animation transition

### Deferred Ideas (OUT OF SCOPE)
- **Chart style/appearance configuration** -- Ability to change chart colors, fonts, axis labels, legend position, etc. This is Phase 6 (Chart Library) scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTR-05 | Fullscreen chart view -- expand any chart to a modal/overlay for detailed inspection | Radix Dialog (Shadcn `Dialog` component) already installed. `ChartFactory` renders live component at larger size. No additional deps needed. |
| INTR-06 | Chart export -- PNG, CSV, clipboard from chart toolbar | AG Charts `download()` for PNG, `getImageDataURL()` for data URL. ECharts `getDataURL()` for PNG/SVG. CSV/clipboard from chart data array. SVG limitation documented. |
| INTR-07 | Grid export -- CSV and Excel via AG Grid Enterprise built-in export | `exportDataAsCsv()` and `exportDataAsExcel()` available via `AllEnterpriseModule` already registered. |
| INTR-08 | Manual refresh button per dashboard -- invalidates cache, re-fetches all data | `useQueryClient().invalidateQueries({ queryKey: ['data-source'] })` pattern. `keepPreviousData` already configured. |
| INTR-09 | Configurable auto-refresh -- default ~10 min interval, user-configurable per dashboard | `setInterval` + `invalidateQueries` for dashboard-level. TanStack Query `refetchInterval` for per-chart granularity. Config field addition to `DashboardConfig`. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Strict TypeScript (no `any`, no `@ts-ignore`)
- Named exports for all components/hooks/stores (except page default exports)
- `motion/react` for animations (NOT `framer-motion`)
- Shadcn CSS variable colors only -- never hardcode hex/rgb/hsl
- Dark mode first-class on every component
- Lucide React for icons
- File naming: `kebab-case.tsx` for components, `use-{name}.ts` for hooks
- Sonner for toast notifications
- AG Charts for standard chart types, ECharts for exotic only
- `cn()` from `lib/utils.ts` for Tailwind class merging
- No barrel exports
- Props interface named `{ComponentName}Props`

## Standard Stack

### Core (Already Installed)

| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| ag-charts-enterprise | ^13.0.1 (latest: 13.2.0) | Chart image export (`download()`, `getImageDataURL()`) | Already the chart library; export is built-in API [VERIFIED: node_modules type inspection] |
| ag-charts-react | ^13.0.1 | React wrapper; `forwardRef` exposes `AgChartInstance` ref | Already used; ref gives direct access to `download()` [VERIFIED: node_modules type inspection] |
| ag-grid-enterprise | ^35.0.1 (latest: 35.2.0) | Grid CSV/Excel export (`exportDataAsCsv`, `exportDataAsExcel`) | `AllEnterpriseModule` already registered in `main.tsx`, includes `ExcelExportModule` [VERIFIED: codebase grep] |
| echarts | ^6.0.0 | ECharts image export (`getDataURL()`, `getSvgDataURL()`) | Already the exotic chart library [VERIFIED: package.json] |
| echarts-for-react | ^3.0.6 | React wrapper; ref gives `getEchartsInstance()` | Already used; existing ref pattern in `echart-wrapper.tsx` [VERIFIED: codebase] |
| @tanstack/react-query | ^5.90.20 | Cache invalidation (`invalidateQueries`), `keepPreviousData`, `refetchInterval` | Already the server state manager [VERIFIED: package.json] |
| motion | ^12.34.0 | Hover toolbar fade in/out animation via `motion/react` | Already installed per CLAUDE.md requirement [VERIFIED: package.json] |
| sonner | ^2.0.7 | Toast notifications for export success/failure | Already configured with `richColors` at `bottom-right` [VERIFIED: codebase] |
| lucide-react | (installed) | Icons: Download, Maximize2, RefreshCw, Image, FileImage, FileSpreadsheet, ClipboardCopy, etc. | Already the icon library [VERIFIED: codebase usage] |

### No New Dependencies

This phase requires zero new npm packages. All capabilities are available from existing installed libraries.

**Installation:** None needed.

## Architecture Patterns

### Recommended Project Structure (New/Modified Files)

```
frontend/src/
├── components/
│   ├── charts/
│   │   ├── ag-chart-wrapper.tsx      # MODIFY: add forwardRef + useImperativeHandle for AgChartInstance
│   │   ├── echart-wrapper.tsx        # MODIFY: add forwardRef + useImperativeHandle for ECharts instance
│   │   └── chart-factory.tsx         # MODIFY: forward ref through to correct wrapper
│   └── dashboard/
│       ├── chart-toolbar.tsx         # NEW: hover-reveal toolbar (export dropdown, fullscreen, refresh)
│       ├── chart-fullscreen-dialog.tsx # NEW: fullscreen modal with live chart
│       ├── grid-toolbar.tsx          # NEW: full toolbar for config-data-grid
│       ├── auto-refresh-control.tsx  # NEW: interval selector + countdown
│       ├── dashboard-toolbar.tsx     # NEW: manual refresh + auto-refresh control
│       ├── config-chart-grid.tsx     # MODIFY: add ChartToolbar + fullscreen state
│       ├── config-data-grid.tsx      # MODIFY: replace inline Input with GridToolbar
│       └── dashboard-renderer.tsx    # MODIFY: add DashboardToolbar, refresh logic
├── hooks/
│   └── use-auto-refresh.ts          # NEW: setInterval + countdown timer logic
├── lib/
│   └── chart-export.ts              # NEW: unified export utilities (CSV builder, download trigger, clipboard)
├── types/
│   └── dashboard-config.ts          # MODIFY: add autoRefreshInterval, refreshInterval fields
└── components/grid/
    ├── data-grid.tsx                 # DELETE: dead code
    └── grid-toolbar.tsx              # DELETE: dead code (borrow pattern first)
```

### Pattern 1: Chart Wrapper Ref Forwarding

**What:** Expose chart instance methods via `forwardRef` + `useImperativeHandle` so parent components can trigger export operations.

**When to use:** When a parent component (toolbar) needs to call methods on the chart rendering library instance.

**Example (AG Charts):**
```typescript
// Source: AG Charts React types (node_modules inspection)
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { AgCharts } from 'ag-charts-react'
import type { AgChartInstance } from 'ag-charts-enterprise'

export interface AgChartRef {
  download: (format: 'png' | 'jpeg', fileName: string) => Promise<void>
  getImageDataURL: (opts: { pixelRatio?: number }) => Promise<string>
  getData: () => { columns: string[]; rows: Record<string, unknown>[] } | null
}

export const AgChartWrapper = forwardRef<AgChartRef, ChartWrapperProps>(
  function AgChartWrapper(props, ref) {
    const chartRef = useRef<AgChartInstance>(null)
    
    useImperativeHandle(ref, () => ({
      download: async (format, fileName) => {
        await chartRef.current?.download({
          fileFormat: format === 'png' ? 'image/png' : 'image/jpeg',
          fileName,
        })
      },
      getImageDataURL: async (opts) => {
        return chartRef.current?.getImageDataURL({
          fileFormat: 'image/png',
          ...opts,
        }) ?? ''
      },
      getData: () => {
        if (!props.data) return null
        return { columns: props.data.columns, rows: props.data.data as Record<string, unknown>[] }
      },
    }))
    
    // ... render <AgCharts ref={chartRef} options={options} />
  }
)
```
[VERIFIED: AG Charts React exposes AgChartInstance via forwardRef in node_modules]

### Pattern 2: Unified ChartRef Interface

**What:** A consistent ref interface that abstracts over AG Charts and ECharts differences, consumed by `ChartToolbar`.

**When to use:** When toolbar actions need to work identically regardless of which chart library renders the visualization.

```typescript
// Exported from chart-factory.tsx
export interface ChartRef {
  downloadImage: (format: 'png' | 'svg', fileName: string) => Promise<void>
  exportCSV: (fileName: string) => void
  copyToClipboard: () => Promise<void>
}
```
[ASSUMED: interface design decision]

### Pattern 3: Dashboard Refresh via Query Invalidation

**What:** Manual refresh invalidates all `['data-source', *]` queries. Auto-refresh uses `setInterval` + same invalidation. Per-chart refresh invalidates only that chart's query key.

```typescript
// Dashboard-level refresh
const queryClient = useQueryClient()
const handleRefresh = () => {
  queryClient.invalidateQueries({ queryKey: ['data-source'] })
}

// Per-chart refresh (invalidate specific data source)
const handleChartRefresh = (dataSourceId: string) => {
  queryClient.invalidateQueries({ queryKey: ['data-source', dataSourceId] })
}
```
[VERIFIED: existing pattern in use-saved-views.ts, use-databases.ts]

### Pattern 4: Auto-Refresh with Countdown

**What:** Custom hook managing `setInterval` for auto-refresh + countdown state.

```typescript
// use-auto-refresh.ts
export function useAutoRefresh(intervalMs: number, onRefresh: () => void) {
  const [remainingMs, setRemainingMs] = useState(intervalMs)
  // setInterval for countdown tick (every 1s)
  // Calls onRefresh when timer reaches 0, then resets
  // Cleans up on unmount or interval change
  return { remainingMs, isActive: intervalMs > 0 }
}
```
[ASSUMED: hook design pattern]

### Anti-Patterns to Avoid

- **Direct chart library access from toolbar:** Toolbar should use the unified `ChartRef` interface, not reach into AG Charts or ECharts directly. This breaks if we swap chart libraries later.
- **Storing auto-refresh state in localStorage:** Decision D-20 explicitly requires persisting in dashboard config JSON. All users see the same default.
- **Skeleton loading during refresh:** Decision D-16 explicitly requires keeping previous data visible. Use `opacity-75` dimming during refresh, never blank/skeleton states.
- **Modifying Shadcn ui/ files:** Use composition and className overrides on `DialogContent` for fullscreen sizing, not editing `dialog.tsx`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart image export | Canvas screenshot / html2canvas | AG Charts `download()` / `getImageDataURL()` + ECharts `getDataURL()` | Native APIs handle DPI, backgrounds, WYSIWYG state correctly [VERIFIED: type definitions] |
| Excel export | Building .xlsx manually | AG Grid Enterprise `exportDataAsExcel()` | Enterprise module handles xlsx format, formatting, large datasets [VERIFIED: ExcelExportModule in AllEnterpriseModule] |
| CSV generation for grid | String building | AG Grid `exportDataAsCsv()` | Handles escaping, quoting, large datasets [VERIFIED: existing usage in query-results.tsx] |
| Modal/dialog | Custom overlay div | Shadcn `Dialog` (Radix Dialog) | Focus trap, escape key, overlay click, animations, accessibility all handled [VERIFIED: dialog.tsx exists] |
| Cache invalidation | Manual refetch tracking | TanStack Query `invalidateQueries()` | Handles stale marking, background refetch, error recovery [VERIFIED: existing pattern] |
| Tooltip | Custom hover state | Shadcn `Tooltip` (Radix Tooltip) | Positioning, delay, keyboard accessibility [VERIFIED: tooltip.tsx exists] |
| Dropdown menu | Custom popover | Shadcn `DropdownMenu` (Radix) | Arrow keys, typeahead, outside click, checkmarks [VERIFIED: dropdown-menu.tsx exists] |

**Key insight:** Every interaction in this phase has a library-native solution. The only hand-rolled code should be: (1) the unified ChartRef adapter between AG Charts and ECharts, (2) CSV string building for chart data export (simple `columns.join(',')` + rows), (3) the auto-refresh countdown timer.

## Common Pitfalls

### Pitfall 1: AG Charts SVG Export Not Supported

**What goes wrong:** The UI-SPEC (D-09) calls for SVG export from all charts. AG Charts 13.x `download()` and `getImageDataURL()` only support `image/png` and `image/jpeg` -- NOT SVG. Attempting to pass `image/svg+xml` as `fileFormat` will likely silently fall back to PNG or error.
**Why it happens:** AG Charts renders to HTML5 Canvas, not SVG DOM. The API reflects this limitation.
**How to avoid:** Two options: (A) Offer SVG export only for ECharts (which supports it natively with SVGRenderer), show PNG for AG Charts with a note. (B) Use `getImageDataURL()` to get PNG data URL, then embed it in an SVG wrapper (`<image>` element inside `<svg>`) -- technically SVG file but not vector graphics. Option A is honest; Option B is misleading.
**Warning signs:** Users expecting scalable vector output from AG Charts will get rasterized images.
**Recommendation:** Offer PNG for AG Charts, SVG for ECharts only. The dropdown menu can conditionally show/hide SVG based on chart type.
[VERIFIED: `ImageDataUrlOptions.fileFormat` docs say "Options: `image/png`, `image/jpeg`" -- no SVG]

### Pitfall 2: ECharts SVG Requires SVGRenderer Registration

**What goes wrong:** ECharts `getDataURL({ type: 'svg' })` requires the `SVGRenderer` to be registered. Currently only `CanvasRenderer` is registered in `echart-wrapper.tsx` (line 30).
**Why it happens:** ECharts tree-shaking means you must explicitly import and `use()` renderers.
**How to avoid:** Add `import { SVGRenderer } from 'echarts/renderers'` and include it in `echarts.use([..., SVGRenderer])`. This does NOT change the default rendering (Canvas is still used for display), but makes SVG export available via `getDataURL({ type: 'svg' })`.
**Warning signs:** `getDataURL({ type: 'svg' })` returns empty string or throws if SVGRenderer not registered.
[VERIFIED: echart-wrapper.tsx line 30 only registers CanvasRenderer]

### Pitfall 3: AG Charts Ref Lifecycle with React Strict Mode

**What goes wrong:** In React 19 Strict Mode, `useEffect` runs twice. The `AgCharts` component creates and destroys the chart instance on mount. If the ref is captured too early (before the second mount completes), it may point to a destroyed instance.
**Why it happens:** React Strict Mode double-invokes effects for development safety checks.
**How to avoid:** Use the ref only in event handlers (click callbacks), never in effects that run on mount. The ref is stable after the component settles.
**Warning signs:** `ref.current?.download()` returns undefined or throws "chart destroyed".
[ASSUMED: standard React 19 strict mode behavior]

### Pitfall 4: Export Triggered During Fullscreen Transition

**What goes wrong:** If user clicks export immediately after opening fullscreen dialog, the chart may still be animating/resizing. The exported image captures a partially-rendered state.
**Why it happens:** AG Charts needs a frame or two to resize to the fullscreen container dimensions.
**How to avoid:** In fullscreen dialog, wait for `requestAnimationFrame` or a brief delay before enabling export buttons. Or use the fullscreen chart's own ref (which will have the correct dimensions once settled).
**Warning signs:** Exported PNG has wrong dimensions or is blank.
[ASSUMED: common chart resizing behavior]

### Pitfall 5: `navigator.clipboard.writeText()` Requires Secure Context

**What goes wrong:** Clipboard API fails silently or throws in non-HTTPS contexts or when called outside a user gesture.
**Why it happens:** Browser security restrictions on clipboard access.
**How to avoid:** Always call from a click handler (user gesture). Wrap in try/catch. Fallback: create a `<textarea>`, select, `document.execCommand('copy')` (deprecated but works). Show error toast if both fail.
**Warning signs:** Copy succeeds in dev (localhost is secure context) but fails in HTTP deployment.
[ASSUMED: standard web API behavior, but the pattern already works in explorer/query-results.tsx]

### Pitfall 6: Fullscreen Dialog Blocks Chart Click Events

**What goes wrong:** Radix Dialog's focus trap may interfere with AG Charts/ECharts click event handling inside the dialog content.
**Why it happens:** Dialog focus management can intercept events.
**How to avoid:** Test that `seriesNodeClick` (AG Charts) and ECharts `click` events fire correctly inside the Dialog. If they don't, use `onOpenAutoFocus={(e) => e.preventDefault()}` on DialogContent to prevent the dialog from stealing focus from the chart.
**Warning signs:** Cross-filter clicks don't work in fullscreen but work in dashboard.
[ASSUMED: possible Radix Dialog interaction, needs testing]

### Pitfall 7: Auto-Refresh Timer Drift

**What goes wrong:** `setInterval` is not precise. Over time, the countdown display drifts from the actual refresh trigger.
**Why it happens:** `setInterval` guarantees minimum delay, not exact timing. Tab throttling in background tabs makes it worse.
**How to avoid:** Store the `nextRefreshAt` timestamp (Date.now() + intervalMs) and compute remaining time from current time in the countdown tick. Reset `nextRefreshAt` after each refresh. Use `requestAnimationFrame` or 1-second `setInterval` for the countdown display only.
**Warning signs:** Countdown shows 0:00 but refresh hasn't fired yet, or shows negative values.
[ASSUMED: standard JavaScript timer behavior]

## Code Examples

### AG Charts Image Export
```typescript
// Source: AG Charts 13 type definitions (verified from node_modules)
// AgChartInstance.download() signature:
interface DownloadOptions {
  fileName?: string           // Default: 'image'
  fileFormat?: string         // 'image/png' | 'image/jpeg' (NOT svg)
  width?: number              // Pixel width (default: current chart width)
  height?: number             // Pixel height (default: current chart height)
}

// Usage:
const chartRef = useRef<AgChartInstance>(null)
await chartRef.current?.download({
  fileName: 'tlm-breaks-by-region-2026-04-05',
  fileFormat: 'image/png',
  width: chartWidth * 2,  // 2x for retina
  height: chartHeight * 2,
})
```
[VERIFIED: type definitions in ag-charts-types@13.0.1]

### ECharts Image Export
```typescript
// Source: ECharts 6 type definitions (verified from node_modules)
// echartsInstance.getDataURL() signature:
interface GetDataURLOpts {
  type?: 'png' | 'jpeg' | 'svg'  // SVG requires SVGRenderer registered
  pixelRatio?: number             // Default: 1
  backgroundColor?: string
  excludeComponents?: string[]
}

// Usage (PNG):
const instance = chartRef.current?.getEchartsInstance()
const dataURL = instance?.getDataURL({ type: 'png', pixelRatio: 2 })
// dataURL is a base64 string like 'data:image/png;base64,...'
// Trigger download via <a> element:
const link = document.createElement('a')
link.href = dataURL
link.download = fileName
link.click()
```
[VERIFIED: ECharts 6 type definitions]

### AG Grid Excel Export
```typescript
// Source: AG Grid Enterprise 35 (verified AllEnterpriseModule registered)
// gridApi.exportDataAsExcel() is available via ExcelExportModule
gridApi?.exportDataAsExcel({
  fileName: 'grid-export.xlsx',
  sheetName: 'Data',
})
```
[VERIFIED: ExcelExportModule exported from ag-grid-enterprise, AllEnterpriseModule registered in main.tsx]

### CSV Builder for Chart Data
```typescript
// For chart data CSV (not grid -- grid uses AG Grid's built-in)
function buildCSV(columns: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const header = columns.map(escape).join(',')
  const body = rows.map(row => columns.map(col => escape(row[col])).join(',')).join('\n')
  return `${header}\n${body}`
}

function downloadCSV(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
```
[ASSUMED: standard CSV generation pattern]

### Clipboard Copy (Existing Pattern)
```typescript
// Source: explorer/query-results.tsx (verified in codebase)
const handleCopy = async (columns: string[], rows: Record<string, unknown>[]) => {
  const header = columns.join('\t')
  const body = rows.map(row =>
    columns.map(col => String(row[col] ?? '')).join('\t')
  )
  const tsv = [header, ...body].join('\n')
  try {
    await navigator.clipboard.writeText(tsv)
    toast.success('Data copied to clipboard')
  } catch {
    toast.error('Failed to copy to clipboard')
  }
}
```
[VERIFIED: existing pattern in explorer/query-results.tsx]

### Query Invalidation for Refresh
```typescript
// Source: existing pattern in use-saved-views.ts, use-databases.ts
import { useQueryClient } from '@tanstack/react-query'

// Dashboard-level: invalidate ALL data source queries
const queryClient = useQueryClient()
queryClient.invalidateQueries({ queryKey: ['data-source'] })

// Per-chart: invalidate specific data source
queryClient.invalidateQueries({ queryKey: ['data-source', specificDataSourceId] })

// Also invalidate KPI queries for full refresh
queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
```
[VERIFIED: existing invalidation pattern in codebase]

### Fullscreen Dialog Sizing
```typescript
// Source: Shadcn Dialog component (verified in components/ui/dialog.tsx)
// Override DialogContent max-width for fullscreen:
<DialogContent className="sm:max-w-[90vw] max-h-[85vh] p-6">
  <DialogHeader>
    <DialogTitle>{chartTitle}</DialogTitle>
  </DialogHeader>
  <div className="h-[calc(85vh-80px)]">
    <ChartFactory ref={chartRef} {...chartProps} />
  </div>
</DialogContent>
```
[VERIFIED: DialogContent accepts className override per Shadcn pattern]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AG Charts `AgChart.create()` static API | `AgCharts` React component with `forwardRef` | AG Charts 10+ | React component handles lifecycle; ref gives `AgChartInstance` directly |
| ECharts 5 `getDataURL()` | ECharts 6 same API, same signature | ECharts 6.0 (2025) | No change needed; API is stable |
| AG Grid `themeClass` strings | AG Grid 33+ `themeQuartz` object + `withPart()` | AG Grid 33 | Already adopted in codebase |
| AG Grid manual Excel building | Enterprise `ExcelExportModule` | AG Grid Enterprise | Built-in, handles formatting and large datasets |

**Deprecated/outdated:**
- `html2canvas` for chart screenshots -- unnecessary; both chart libraries have native export APIs
- `ag-theme-quartz-dark` CSS class approach -- replaced by `themeQuartz.withPart(colorSchemeDark)` (already adopted)
- `framer-motion` package -- project uses `motion/react` from the `motion` package

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AG Charts `download()` with `width: chartWidth * 2` produces 2x retina output | Code Examples | Image may be same pixel density; would need `getImageDataURL()` + manual canvas resize instead |
| A2 | Radix Dialog focus trap does not interfere with AG Charts/ECharts click events inside dialog | Pitfall 6 | Cross-filter and drill-down won't work in fullscreen mode; would need `onOpenAutoFocus` prevention |
| A3 | `navigator.clipboard.writeText()` works reliably in the corporate deployment environment | Pitfall 5 | Clipboard copy would silently fail; needs fallback `execCommand('copy')` |
| A4 | ECharts `getDataURL({ type: 'svg' })` works correctly after registering `SVGRenderer` alongside `CanvasRenderer` | Pitfall 2 | SVG export from ECharts would not work; would need separate ECharts instance with SVG renderer |
| A5 | Auto-refresh `setInterval` is sufficient (not `requestAnimationFrame` loop) | Pattern 4 | Timer may drift significantly in background tabs; countdown display would be inaccurate |

## Open Questions

1. **SVG Export for AG Charts**
   - What we know: AG Charts 13 `download()` and `getImageDataURL()` only support `image/png` and `image/jpeg`. No SVG.
   - What's unclear: Should we (A) conditionally hide SVG option for AG Charts and only show it for ECharts, (B) wrap PNG in an SVG container (technically SVG file but rasterized), or (C) remove SVG from the export menu entirely?
   - Recommendation: Option A -- show SVG only for ECharts charts. This is honest about capabilities. The export dropdown can be chart-type-aware. AG Charts users get PNG (which is the primary use case for financial dashboards anyway -- pasting into reports/PowerPoint).

2. **Per-Chart Auto-Refresh: Config-Only vs UI Control**
   - What we know: D-18 says both dashboard-wide and per-chart levels. D-20 says interval persisted in config.
   - What's unclear: Should there be a visible UI control for per-chart refresh interval override, or is it config-only (dev team sets it, users don't change it)?
   - Recommendation: Config-only for v1. The UI-SPEC (line 355) already says "No separate UI control for per-chart override in this phase -- it is config-driven only. UI for per-chart override deferred to Phase 8 (dashboard builder)."

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `vitest/config`) |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && pnpm vitest run --reporter=verbose` |
| Full suite command | `cd frontend && pnpm vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTR-05 | Fullscreen dialog opens/closes, renders chart | unit + E2E | `pnpm vitest run src/components/dashboard/chart-fullscreen-dialog.test.tsx` | Wave 0 |
| INTR-06-a | AG Charts PNG export via download() | unit | `pnpm vitest run src/components/charts/ag-chart-wrapper.test.ts` | Existing (needs extension) |
| INTR-06-b | ECharts PNG/SVG export via getDataURL() | unit | `pnpm vitest run src/components/charts/echart-wrapper.test.ts` | Wave 0 |
| INTR-06-c | CSV export builds correct CSV string | unit | `pnpm vitest run src/lib/chart-export.test.ts` | Wave 0 |
| INTR-06-d | Clipboard copy produces TSV | unit | `pnpm vitest run src/lib/chart-export.test.ts` | Wave 0 |
| INTR-07 | Grid CSV/Excel export calls gridApi methods | unit | `pnpm vitest run src/components/dashboard/grid-toolbar.test.ts` | Wave 0 |
| INTR-08 | Manual refresh invalidates queries | unit | `pnpm vitest run src/components/dashboard/dashboard-toolbar.test.ts` | Wave 0 |
| INTR-09 | Auto-refresh fires on interval, countdown works | unit | `pnpm vitest run src/hooks/use-auto-refresh.test.ts` | Wave 0 |
| INTR-09-b | DashboardConfig type includes autoRefreshInterval | unit (type assertion) | `pnpm vitest run src/types/dashboard-config.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && pnpm vitest run --reporter=verbose`
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/chart-export.test.ts` -- covers CSV builder, download trigger, clipboard copy (INTR-06-c, INTR-06-d)
- [ ] `src/hooks/use-auto-refresh.test.ts` -- covers timer lifecycle, countdown, interval changes (INTR-09)
- [ ] `src/components/dashboard/grid-toolbar.test.ts` -- covers toolbar button rendering, export method calls (INTR-07)
- [ ] `src/components/dashboard/dashboard-toolbar.test.ts` -- covers refresh button, query invalidation (INTR-08)
- [ ] `src/components/charts/echart-wrapper.test.ts` -- covers ECharts export ref methods (INTR-06-b)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase has no auth changes |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | No permission changes |
| V5 Input Validation | Marginal | Filename sanitization for exports (strip special chars) |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via export filename | Tampering | Sanitize chart/dashboard titles before using as filenames (strip `<>/\:*?"` etc.) |
| Clipboard data exposure | Information Disclosure | Only copies data already visible to the user; no escalation risk |
| Auto-refresh DoS on backend | Denial of Service | Minimum interval preset is 1 minute; no custom input field for arbitrary intervals |

## Sources

### Primary (HIGH confidence)
- AG Charts 13 type definitions (`ag-charts-types@13.0.1/chartBuilderOptions.d.ts`) -- `AgChartInstance`, `DownloadOptions`, `ImageDataUrlOptions`
- AG Charts React type definitions (`ag-charts-react@13.0.1/index.d.ts`) -- `ForwardRefExoticComponent<AgChartProps & RefAttributes<AgChartInstance>>`
- ECharts 6 type definitions (`echarts@6.0.0/types/src/core/echarts.d.ts`) -- `getDataURL()`, `getSvgDataURL()`
- AG Grid Enterprise type definitions (`ag-grid-enterprise@35.0.1`) -- `ExcelExportModule`, `exportDataAsExcel`
- Codebase files: `ag-chart-wrapper.tsx`, `echart-wrapper.tsx`, `chart-factory.tsx`, `config-chart-grid.tsx`, `config-data-grid.tsx`, `dashboard-renderer.tsx`, `api-client.ts`, `query-client.ts`, `dialog.tsx`, `grid-toolbar.tsx` (dead code), `query-results.tsx`
- `main.tsx` -- module registration (AllEnterpriseModule for both AG Charts and AG Grid)

### Secondary (MEDIUM confidence)
- [AG Charts 13.2 release blog](https://blog.ag-grid.com/whats-new-in-ag-charts-13-2/) -- confirms SSR rendering capabilities
- [AG Grid chart image export docs](https://www.ag-grid.com/javascript-data-grid/integrated-charts-api-downloading-image/) -- general export pattern reference

### Tertiary (LOW confidence)
- None -- all critical claims verified against installed type definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, APIs verified against actual type definitions in node_modules
- Architecture: HIGH -- patterns follow existing codebase conventions, all integration points identified and code-reviewed
- Pitfalls: HIGH for SVG limitation (verified), MEDIUM for Radix Dialog interaction and timer drift (assumed but common)

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (30 days -- stable libraries, no breaking changes expected)
