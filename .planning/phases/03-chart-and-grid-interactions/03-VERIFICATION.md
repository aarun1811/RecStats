---
phase: 03-chart-and-grid-interactions
verified: 2026-04-05T22:20:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Hover over a chart card and verify the toolbar icons (export, fullscreen, refresh) fade in on hover and disappear on mouse leave"
    expected: "Icons appear with 150ms fade animation, disappear on mouse leave"
    why_human: "Hover-reveal animation timing and visual appearance requires visual inspection"
  - test: "Click fullscreen icon on a chart card, verify the chart renders at 90vw inside a Dialog overlay, then press Escape to dismiss"
    expected: "Chart opens in fullscreen dialog at 90vw, Escape closes dialog and returns to dashboard"
    why_human: "Dialog overlay sizing, chart re-rendering at larger size, and Escape dismiss behavior require visual verification"
  - test: "Click a bar segment inside fullscreen to trigger cross-filter, verify both fullscreen and dashboard cards dim non-selected segments"
    expected: "Cross-filter dimming applies identically in fullscreen and dashboard card instances"
    why_human: "Cross-filter visual state synchronization between two React instances requires visual verification"
  - test: "Click Export dropdown on chart toolbar, select PNG Image, and verify a PNG file downloads"
    expected: "A PNG file with timestamped filename downloads to the browser's default download location"
    why_human: "File download behavior and image quality (retina output) require manual browser testing"
  - test: "On a grid card, click CSV button and verify a CSV file downloads with the currently filtered/sorted view"
    expected: "CSV file contains only the rows visible in the grid (WYSIWYG), respecting quick filter and sort order"
    why_human: "File download content verification and WYSIWYG behavior require manual inspection"
  - test: "On a grid card, click Excel button and verify loading spinner appears then an .xlsx file downloads"
    expected: "Excel button shows Loader2 spinner during export, button is disabled, then .xlsx downloads"
    why_human: "Excel loading state timing and file format correctness require manual browser testing"
  - test: "Click the dashboard-level Refresh button and verify all charts and KPIs re-fetch with spinner on button"
    expected: "RefreshCw icon spins, button is disabled during refresh, previous data stays visible, success toast appears"
    why_human: "Loading indicator, data retention during refresh, and toast notification require visual verification"
  - test: "Select '1m' from auto-refresh dropdown, verify pulsing green dot and countdown timer appear, wait for countdown to reach zero and verify data refreshes"
    expected: "Green dot pulses, countdown shows M:SS format, data re-fetches when timer reaches zero"
    why_human: "Real-time countdown behavior and automatic refresh trigger require timed visual verification"
---

# Phase 03: Chart and Grid Interactions Verification Report

**Phase Goal:** Users can export, enlarge, and refresh individual charts and grids from toolbar controls on each panel
**Verified:** 2026-04-05T22:20:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can expand any chart into a fullscreen modal overlay for detailed inspection, and dismiss it to return to the dashboard | VERIFIED | `ChartFullscreenDialog` component renders a Radix Dialog at `sm:max-w-[90vw] max-h-[85vh]` with `onOpenAutoFocus` prevention. Integrated into both `QueryChartItemWithDrill` and `KpiValuesChartItem` in `config-chart-grid.tsx` with `fullscreenOpen` state. Fullscreen chart receives identical `data`, `activeSelection`, `onChartClick`, and `onChartDoubleClick` props as dashboard card. |
| 2 | User can export any chart as PNG image, CSV data, or copy to clipboard from a chart toolbar menu | VERIFIED | `ChartToolbar` has DropdownMenu with PNG Image, conditional SVG Image (ECharts only), CSV Data, and Copy to Clipboard items. Each calls through `ChartRef` unified interface which delegates to `AgChartRef.download()` for AG Charts PNG or `EChartRef.getDataURL()` for ECharts. `chart-export.ts` provides `buildCSV`, `downloadCSV`, `copyToClipboard`, `triggerDownload`, `exportFilename`, `sanitizeFilename` (18 passing tests). `EXPORT_PIXEL_RATIO = 2` for retina quality. |
| 3 | User can export grid data as CSV or Excel using AG Grid's built-in export | VERIFIED | `GridToolbar` component calls `gridApi.exportDataAsCsv()` and `gridApi.exportDataAsExcel()` directly. Excel export has loading state (`isExporting` with `Loader2` spinner). WYSIWYG export documented in code comment. Integrated into both `SingleSourceGrid` and `MergedSourceGrid` in `config-data-grid.tsx`. 13 unit tests covering all toolbar controls and API calls. |
| 4 | User can click a refresh button on a dashboard to invalidate cache and re-fetch all data, with a loading indicator during the refresh | VERIFIED | `DashboardToolbar` renders `RefreshCw` button with `animate-spin` during refresh and `disabled` state. `handleRefresh` in `dashboard-renderer.tsx` calls `queryClient.invalidateQueries({ queryKey: ['data-source'] })` and `queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })`. Error toast on failure (`Refresh failed: ...`), success toast on completion (`Dashboard refreshed`). TanStack Query `keepPreviousData` pattern ensures old data stays visible. |
| 5 | Dashboard auto-refreshes at a configurable interval (default ~10 min), and the user can change the interval per dashboard | VERIFIED | `useAutoRefresh` hook with timestamp-based countdown (avoids drift), 11 unit tests. `AutoRefreshControl` with presets: Off (0), 1m (60000), 5m (300000), 10m (600000), 30m (1800000). Default `600_000` (10 min) in `dashboard-renderer.tsx`. Pulsing green dot, tabular-nums countdown. `autoRefreshInterval` field on `DashboardConfig` type (frontend) and `auto_refresh_interval` on backend Pydantic model. `refreshInterval` per-chart override on `DashboardChartConfig` (config-only, no UI). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/types/chart.ts` | ChartRef, AgChartRef, EChartRef interfaces | VERIFIED | Contains all three interfaces with `supportsSVG`, `downloadImage`, `exportCSV`, `copyToClipboard` |
| `frontend/src/lib/chart-export.ts` | CSV builder, download trigger, clipboard copy, EXPORT_PIXEL_RATIO | VERIFIED | 81 lines, exports `buildCSV`, `buildTSV`, `sanitizeFilename`, `triggerDownload`, `triggerDownloadFromDataURL`, `downloadCSV`, `copyToClipboard`, `exportFilename`, `EXPORT_PIXEL_RATIO = 2` |
| `frontend/src/lib/chart-export.test.ts` | Unit tests for export utilities | VERIFIED | 18 tests passing |
| `frontend/src/components/charts/ag-chart-wrapper.tsx` | forwardRef exposing AgChartRef | VERIFIED | `forwardRef<AgChartRef, ChartWrapperProps>` with `useImperativeHandle` exposing `download`, `getImageDataURL`, `getData` |
| `frontend/src/components/charts/echart-wrapper.tsx` | forwardRef exposing EChartRef, SVGRenderer | VERIFIED | `forwardRef<EChartRef, ChartWrapperProps>` with `useImperativeHandle`, `SVGRenderer` registered, `EXPORT_PIXEL_RATIO` imported |
| `frontend/src/components/charts/chart-factory.tsx` | forwardRef forwarding unified ChartRef | VERIFIED | `forwardRef<ChartRef, ChartWrapperProps>` with `supportsSVG`, `downloadImage`, `exportCSV`, `copyToClipboard` |
| `frontend/src/components/dashboard/chart-toolbar.tsx` | Hover-reveal toolbar with export dropdown, fullscreen, refresh | VERIFIED | 129 lines, export dropdown with PNG/SVG/CSV/Clipboard, Maximize2 fullscreen (hidden when `isInsideFullscreen`), RefreshCw with `animate-spin` |
| `frontend/src/components/dashboard/chart-fullscreen-dialog.tsx` | Fullscreen dialog rendering live chart | VERIFIED | 53 lines, `sm:max-w-[90vw]`, `onOpenAutoFocus` prevention, `toolbarSlot` for export controls |
| `frontend/src/components/dashboard/config-chart-grid.tsx` | ChartToolbar and fullscreen integrated into chart cards | VERIFIED | Both `QueryChartItemWithDrill` and `KpiValuesChartItem` have `chartRef`, `fullscreenChartRef`, `hovered`, `fullscreenOpen` state, AnimatePresence hover-reveal, ChartFullscreenDialog with identical props |
| `frontend/src/components/dashboard/grid-toolbar.tsx` | Grid toolbar with CSV, Excel, columns, density, auto-size | VERIFIED | 202 lines, `exportDataAsCsv`, `exportDataAsExcel`, `setColumnsVisible`, `autoSizeAllColumns`, density (comfortable/normal/compact), `isExporting` state, `Loader2` spinner, WYSIWYG comment |
| `frontend/src/components/dashboard/grid-toolbar.test.tsx` | Unit tests for grid toolbar | VERIFIED | 13 tests passing |
| `frontend/src/components/dashboard/config-data-grid.tsx` | GridToolbar integrated, inline Input removed | VERIFIED | `GridToolbar` used in both `SingleSourceGrid` and `MergedSourceGrid`, `displayedRowCount` tracked via `filterChanged` listener, no standalone `<Input placeholder="Quick filter..."` |
| `frontend/src/hooks/use-auto-refresh.ts` | Auto-refresh timer hook | VERIFIED | 72 lines, timestamp-based countdown, `remainingMs`, `isActive`, `reset()` |
| `frontend/src/hooks/use-auto-refresh.test.ts` | Unit tests for auto-refresh hook | VERIFIED | 11 tests passing |
| `frontend/src/components/dashboard/auto-refresh-control.tsx` | Interval selector with countdown | VERIFIED | 83 lines, PRESETS (0, 60000, 300000, 600000, 1800000), pulsing green dot, tabular-nums countdown |
| `frontend/src/components/dashboard/dashboard-toolbar.tsx` | Manual refresh + auto-refresh control | VERIFIED | 61 lines, RefreshCw with `animate-spin`, AutoRefreshControl integration |
| `frontend/src/components/dashboard/dashboard-renderer.tsx` | DashboardToolbar integrated, invalidateQueries, useAutoRefresh | VERIFIED | DashboardToolbar rendered before ConfigFilterBar, `handleRefresh` with `invalidateQueries`, `useAutoRefresh` hook, success/error toasts, deduplication comment |
| `frontend/src/types/dashboard-config.ts` | autoRefreshInterval, refreshInterval fields | VERIFIED | `autoRefreshInterval?: number` on DashboardConfig, `refreshInterval?: number` on DashboardChartConfig |
| `backend/app/models/dashboard_config.py` | auto_refresh_interval, refresh_interval fields | VERIFIED | `auto_refresh_interval: int | None = None` on DashboardConfig, `refresh_interval: int | None = None` on DashboardChartConfig |
| `frontend/src/components/grid/data-grid.tsx` | DELETED (dead code) | VERIFIED | File does not exist |
| `frontend/src/components/grid/grid-toolbar.tsx` | DELETED (dead code) | VERIFIED | File does not exist |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| chart-toolbar.tsx | types/chart.ts | ChartRef interface | WIRED | `import type { ChartRef } from '@/types/chart'` at line 19, `chartRef: React.RefObject<ChartRef \| null>` in props |
| config-chart-grid.tsx | chart-toolbar.tsx | ChartToolbar component | WIRED | `import { ChartToolbar } from '@/components/dashboard/chart-toolbar'` at line 11, used in both QueryChartItemWithDrill and KpiValuesChartItem |
| chart-fullscreen-dialog.tsx | chart-factory.tsx | ChartFactory rendered inside Dialog | WIRED | ChartFactory rendered as children of ChartFullscreenDialog in config-chart-grid.tsx lines 290 and 441 |
| grid-toolbar.tsx | ag-grid-enterprise | exportDataAsCsv, exportDataAsExcel | WIRED | `gridApi?.exportDataAsCsv()` at line 55, `gridApi?.exportDataAsExcel()` at line 70 |
| config-data-grid.tsx | grid-toolbar.tsx | GridToolbar component | WIRED | `import { GridToolbar } from '@/components/dashboard/grid-toolbar'` at line 7, used in SingleSourceGrid (line 156) and MergedSourceGrid (line 297) |
| dashboard-toolbar.tsx | use-auto-refresh.ts | useAutoRefresh hook | WIRED | useAutoRefresh called in dashboard-renderer.tsx (line 67), results passed to DashboardToolbar via AutoRefreshControl |
| dashboard-renderer.tsx | dashboard-toolbar.tsx | DashboardToolbar component | WIRED | `import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar'` at line 11, rendered at line 130 |
| dashboard-toolbar.tsx | @tanstack/react-query | invalidateQueries | WIRED | `queryClient.invalidateQueries({ queryKey: ['data-source'] })` at line 53 and `['dashboard-kpis']` at line 54 in dashboard-renderer.tsx |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| chart-toolbar.tsx | chartRef | ChartRef from parent's useRef | Delegates to chart wrapper imperativeHandle methods | FLOWING |
| grid-toolbar.tsx | gridApi | GridApi from parent's onGridReady | AG Grid native API instance with real data | FLOWING |
| dashboard-renderer.tsx | autoRefreshInterval | config.autoRefreshInterval or default 600000 | Config-driven, updates via state setter | FLOWING |
| auto-refresh-control.tsx | intervalMs / remainingMs | Props from DashboardToolbar <- DashboardRenderer | Connected to useAutoRefresh hook countdown | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | `cd frontend && npx tsc --noEmit` | Exit code 0, no errors | PASS |
| All unit tests pass | `cd frontend && npx vitest run` | 115 tests passed, 0 failed | PASS |
| chart-export tests | `npx vitest run src/lib/chart-export.test.ts` | 18 tests passing | PASS |
| use-auto-refresh tests | `npx vitest run src/hooks/use-auto-refresh.test.ts` | 11 tests passing | PASS |
| grid-toolbar tests | `npx vitest run src/components/dashboard/grid-toolbar.test.tsx` | 13 tests passing | PASS |
| Dead code deleted | `ls frontend/src/components/grid/{data-grid,grid-toolbar}.tsx` | "No such file or directory" for both | PASS |
| ChartFactory exports ChartRef | Source inspection | `forwardRef<ChartRef, ChartWrapperProps>` confirmed | PASS |
| Git commits verified | `git log --oneline -15` | All 7 task commits present (6f88f4e, a976f16, c9f08ad, d846934, 7f0276d, 0084aa1, f4bb749) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INTR-05 | 03-01 | Fullscreen chart view -- expand any chart to a modal/overlay for detailed inspection | SATISFIED | ChartFullscreenDialog at 90vw with live chart, onOpenAutoFocus prevention, identical cross-filter state |
| INTR-06 | 03-01 | Chart export -- PNG, CSV, clipboard from chart toolbar | SATISFIED | ChartToolbar export dropdown with PNG, SVG (ECharts only), CSV, Clipboard. ChartRef unified interface. chart-export.ts utilities with 18 tests |
| INTR-07 | 03-02 | Grid export -- CSV and Excel via AG Grid Enterprise built-in export | SATISFIED | GridToolbar with exportDataAsCsv and exportDataAsExcel. WYSIWYG behavior. Excel loading state. 13 tests |
| INTR-08 | 03-03 | Manual refresh button per dashboard -- invalidates cache, re-fetches all data | SATISFIED | DashboardToolbar with RefreshCw spinner, invalidateQueries for data-source and dashboard-kpis, success/error toasts, keepPreviousData pattern |
| INTR-09 | 03-03 | Configurable auto-refresh -- default ~10 min interval, user-configurable per dashboard | SATISFIED | useAutoRefresh hook, AutoRefreshControl with Off/1m/5m/10m/30m presets, default 600000ms, autoRefreshInterval on DashboardConfig type and backend model |

**All 5 requirements satisfied. No orphaned requirements.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| config-chart-grid.tsx | 283, 436 | `onFullscreen={() => {}}` | Info | Intentional no-op: fullscreen button is hidden via `isInsideFullscreen` prop, handler never invoked |
| grid-toolbar.tsx | 113 | `placeholder="Quick filter..."` | Info | Legitimate UI text, not a stub |

No blockers or warnings found.

### Human Verification Required

### 1. Chart Toolbar Hover Animation

**Test:** Hover over a chart card on a dashboard and verify toolbar icons fade in, then move mouse away and verify they fade out
**Expected:** Icons (Export, Fullscreen, Refresh) appear with 150ms fade animation, disappear on mouse leave
**Why human:** Hover-reveal animation timing and visual appearance require visual inspection

### 2. Fullscreen Dialog Rendering

**Test:** Click fullscreen icon on a chart card, verify chart renders at full size inside a Dialog overlay, press Escape to dismiss
**Expected:** Chart opens in fullscreen dialog at 90vw width, chart is interactive, Escape closes dialog
**Why human:** Dialog overlay sizing, chart re-rendering at larger size, and keyboard dismiss require visual verification

### 3. Fullscreen Cross-Filter State Sync

**Test:** In fullscreen mode, click a bar segment to trigger cross-filter, verify both fullscreen and dashboard cards behind it dim non-selected segments
**Expected:** Cross-filter dimming applies identically in both fullscreen and dashboard card instances
**Why human:** Cross-filter visual state synchronization between separate React instances requires visual verification

### 4. Chart PNG Export

**Test:** Click Export dropdown, select PNG Image, verify a PNG file downloads
**Expected:** PNG file with timestamped filename downloads at retina quality
**Why human:** File download behavior and image quality require manual browser testing

### 5. Grid CSV/Excel Export

**Test:** On a grid, apply a quick filter, then click CSV button. Verify the downloaded CSV contains only the filtered rows
**Expected:** CSV contains WYSIWYG data (only visible rows), Excel export shows loading spinner then downloads .xlsx
**Why human:** File download content verification requires manual inspection

### 6. Dashboard Manual Refresh

**Test:** Click the Refresh button on the dashboard toolbar, verify spinner appears, data re-fetches, and success toast shows
**Expected:** RefreshCw icon spins, button disabled during refresh, old data stays visible, "Dashboard refreshed" toast appears
**Why human:** Loading indicator timing, data retention during refresh, and toast notification require visual verification

### 7. Auto-Refresh Countdown and Trigger

**Test:** Select "1m" from auto-refresh dropdown, verify pulsing green dot and M:SS countdown appear, wait for countdown to reach zero
**Expected:** Green dot pulses, countdown decrements every second in tabular-nums format, data auto-refreshes at zero
**Why human:** Real-time countdown behavior and automatic refresh trigger require timed visual verification

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria are verified through code inspection:

1. **Fullscreen chart view** -- ChartFullscreenDialog component exists, is substantive (53 lines, live chart rendering), is wired into config-chart-grid.tsx for both query and KPI chart items, and receives identical cross-filter state as dashboard cards.

2. **Chart export** -- ChartToolbar, ChartRef interface, chart-export utilities all exist, are substantive, and are fully wired. 18 unit tests for export utilities pass. PNG, SVG (ECharts), CSV, and clipboard export all have code paths.

3. **Grid export** -- GridToolbar with exportDataAsCsv and exportDataAsExcel exists, is substantive (202 lines), is wired into both SingleSourceGrid and MergedSourceGrid. 13 unit tests pass. Excel loading state implemented.

4. **Manual refresh** -- DashboardToolbar exists, is substantive, is wired into DashboardRenderer. invalidateQueries calls both data-source and dashboard-kpis query keys. Error handling and toast notifications implemented.

5. **Auto-refresh** -- useAutoRefresh hook, AutoRefreshControl, type extensions, and backend model all exist and are wired. 11 unit tests for the hook pass. Default 600000ms (10 min), presets Off/1m/5m/10m/30m.

Status is `human_needed` because all items require visual/interactive verification that cannot be performed programmatically (hover animations, file downloads, dialog behavior, real-time countdown).

---

_Verified: 2026-04-05T22:20:00Z_
_Verifier: Claude (gsd-verifier)_
