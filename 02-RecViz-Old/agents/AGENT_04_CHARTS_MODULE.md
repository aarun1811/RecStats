# Agent 04 — Charts Module

## Mission
Build the chart wrapper components for AG Charts and ECharts. Create a unified chart factory that picks the right renderer based on chart type. Theme both libraries to match Shadcn's design system.

## Read First
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/CLAUDE.md`
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/agents/AGENT_00_RESULT.md`

## Working Directory
`/Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz/frontend/`

## What Already Exists
- `src/lib/ag-chart-themes.ts` — base AG Charts theme (light + dark)
- `src/types/chart.ts` — `ChartType`, `ChartConfig`, `ChartClickEvent`, `ChartLibrary`
- AG Charts packages: `ag-charts-community`, `ag-charts-enterprise`, `ag-charts-react`
- ECharts packages: `echarts`, `echarts-for-react`

## Files To Create

### 1. `src/components/charts/ag-chart-wrapper.tsx`
AG Charts React wrapper component:
- Props: `ChartWrapperProps` interface (data, config, crossFilter, onNodeClick, loading, error)
- Uses `AgCharts` from `ag-charts-react`
- Applies `recvizChartTheme` or `recvizChartThemeDark` based on current theme
- Handles click events → maps to `ChartClickEvent` → calls `onNodeClick`
- Cross-filter highlighting: when crossFilter is active, dim non-matching data points (opacity)
- Responsive: uses `width: '100%'` and `height: '100%'`, container controls size
- Loading state: returns `<Skeleton>` when loading
- Error state: returns error message in a styled container
- Supports all AG Charts types: line, bar, area, pie, donut, scatter, histogram, heatmap, treemap, waterfall, combo, etc.

### 2. `src/components/charts/echart-wrapper.tsx`
ECharts wrapper for exotic chart types:
- Same `ChartWrapperProps` interface as AG Charts wrapper
- Uses `ReactECharts` from `echarts-for-react`
- Theme: create ECharts theme object matching Shadcn colors (use CHART_COLORS from constants)
- Dark mode: switch ECharts theme between custom light/dark
- Click handler: maps ECharts click params to `ChartClickEvent`
- Responsive via ECharts `opts={{ renderer: 'svg' }}` and autoResize
- Loading/error states same as AG Charts wrapper

### 3. `src/components/charts/chart-factory.tsx`
Factory component that picks the right wrapper:
```tsx
interface ChartFactoryProps extends ChartWrapperProps {
  chartType: ChartType
}

export function ChartFactory({ chartType, ...props }: ChartFactoryProps) {
  const library = getChartLibrary(chartType)
  if (library === 'ag-charts') return <AgChartWrapper {...props} />
  return <EChartWrapper {...props} />
}
```

Helper function `getChartLibrary(type: ChartType): ChartLibrary`:
- Returns `'echarts'` for: sankey, sunburst, radar, graph, gauge, parallel, funnel
- Returns `'ag-charts'` for everything else

### 4. `src/components/charts/chart-config-builder.ts`
Utility functions to build chart options from data + chart type:

```typescript
// Builds AG Charts options object from chart config + data
buildAgChartOptions(config: ChartConfig, data: Record<string, unknown>[]): AgChartOptions

// Builds ECharts options object from chart config + data
buildEChartOptions(config: ChartConfig, data: Record<string, unknown>[]): EChartsOption
```

Support building options for common chart types:
- **Area chart**: break trend over time (x=date, y=count, series=category)
- **Bar chart**: breaks by type (x=type, y=count)
- **Donut chart**: breaks by desk (category=desk, value=count)
- **Stacked bar**: aging distribution (x=bucket, y=count, series=desk)
- **Sankey**: flow from source → process → outcome (ECharts)
- **Radar**: multi-dimensional quality scores (ECharts)

### 5. `src/components/charts/chart-export.tsx`
Chart export utilities:
- `exportChartAsPng(chartRef)` — capture chart as PNG, trigger download
- `exportChartDataAsCsv(data, columns, filename)` — export underlying data as CSV
- `copyChartToClipboard(chartRef)` — copy chart image to clipboard
- Uses `canvas.toBlob()` for AG Charts, ECharts `getDataURL()` for ECharts

### 6. Update `src/lib/ag-chart-themes.ts`
Enhance the existing theme file:
- Add per-chart-type overrides (bar padding, pie label formatting, etc.)
- Create a `getChartTheme(isDark: boolean)` function components can call
- Add animation config (entrance animations for bars, line draw animation)

### 7. `src/lib/echart-themes.ts`
ECharts theme definition matching Shadcn:
```typescript
export const recvizEChartsThemeLight = { ... }
export const recvizEChartsThemeDark = { ... }
```
Register themes with `echarts.registerTheme('recviz-light', ...)`.

## Design Requirements
- Charts must look premium — smooth animations, clean typography, consistent colors
- AG Charts entrance animation: bars grow up, lines draw in, pies spin in
- Color palette: use the 5 chart colors from constants consistently
- Tooltips: clean, minimal, show value + percentage where applicable
- Legends: bottom-aligned, horizontal, wrap to next line if needed
- No chart borders — let the ChartPanel card provide the container
- Font: match app font (Inter/Geist) in all chart labels

## Acceptance Criteria
- [ ] `<AgChartWrapper>` renders line, bar, area, pie, donut, scatter charts
- [ ] `<EChartWrapper>` renders sankey and radar charts
- [ ] `<ChartFactory>` routes to correct wrapper based on chart type
- [ ] Click events fire `onNodeClick` with correct `ChartClickEvent` data
- [ ] Cross-filter highlighting dims non-matching data
- [ ] Light/dark theme switching works for both AG Charts and ECharts
- [ ] Chart export (PNG, CSV, clipboard) works
- [ ] No TypeScript errors
