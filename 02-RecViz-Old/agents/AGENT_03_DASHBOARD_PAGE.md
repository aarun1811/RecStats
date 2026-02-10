# Agent 03 — Dashboard Page

## Mission
Build the dashboard page — the primary view users interact with. Includes the filter bar, KPI cards row, chart grid layout, drill-down breadcrumbs, and the detail grid section.

## Read First
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/CLAUDE.md`
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/agents/AGENT_00_RESULT.md`

## Working Directory
`/Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz/frontend/`

## What Already Exists
- Shadcn components: card, select, popover, calendar, badge, button, separator, skeleton, breadcrumb
- Stores: `filter-store.ts` (globalFilters, crossFilters), `drill-store.ts`
- Types: `filter.ts`, `chart.ts`, `api.ts` (DashboardConfig, CrossFilterRule, etc.)
- Note: Hooks from Agent 02, chart wrappers from Agent 04, grid wrapper from Agent 05 may not exist yet. **Import them but handle missing gracefully** — use placeholder components if the real ones aren't available.

## Files To Create

### 1. `src/components/dashboard/filter-bar.tsx`
- Horizontal bar with filter controls
- **Date Range**: Shadcn `<Popover>` + `<Calendar>` for date range picking
- **Entity Selector**: Shadcn `<Command>` inside `<Popover>` — searchable multi-select
- **Status Filter**: Shadcn multi-select with checkboxes (Open, Resolved, Pending, Escalated)
- **Desk Filter**: Shadcn `<Select>` single-select
- **Actions**: "Apply" button (primary), "Reset" button (ghost)
- Reads/writes `globalFilters` from `useFilterStore`
- Filter chips showing active filters with "x" to remove
- Framer Motion: filter bar slides down on mount

### 2. `src/components/dashboard/kpi-card.tsx`
- Shadcn `<Card>` with title, large value, trend indicator
- Props: `title`, `value` (number), `previousValue` (number), `format` ('number' | 'percent' | 'currency' | 'days')
- Trend: shows arrow up/down + percentage change, colored green (good) / red (bad)
- `invertTrend` prop: for metrics where "down is good" (e.g., avg age, SLA breaches)
- Value uses animated counter (import from Agent 07's shared components, or inline simple version)
- Skeleton state when `loading` prop is true
- Framer Motion: card fades in with staggered delay

### 3. `src/components/dashboard/kpi-row.tsx`
- Renders 4 `<KpiCard>` components in a responsive grid
- Cards: Total Breaks, Resolution Rate, Avg Age, SLA Breaches
- Uses data from chart/dashboard hooks
- `grid grid-cols-2 lg:grid-cols-4 gap-4`

### 4. `src/components/dashboard/chart-panel.tsx`
- Container for a single chart with header and toolbar
- **Header**: title (left), toolbar (right)
- **Toolbar**: Refresh button, fullscreen toggle, export menu (PNG, CSV)
- **Body**: renders the chart component (passed as children or via chartConfig)
- **Footer**: "Last updated" timestamp, data source name
- Shadcn `<Card>` as container
- Fullscreen uses Shadcn `<Dialog>` to show chart expanded
- Loading state: `<Skeleton>` in chart body area
- Clicking chart data points triggers cross-filter via `onNodeClick` prop

### 5. `src/components/dashboard/chart-grid.tsx`
- Responsive grid layout for chart panels
- Default: 2 columns on large screens, 1 on small
- Uses dashboard config `layout` array to position charts
- `grid grid-cols-1 lg:grid-cols-2 gap-6`
- Each cell renders `<ChartPanel>` with appropriate chart wrapper inside

### 6. `src/components/dashboard/drill-breadcrumb.tsx`
- Breadcrumb trail showing drill-down path
- Uses Shadcn `<Breadcrumb>` component
- Each level is clickable to drill back up
- "Reset" link at the end to go back to top level
- Only visible when drill depth > 0
- Reads from `useDrillStore`
- Example: `Overview > January 2026 > Jan 15 > Settlement Breaks`

### 7. `src/components/dashboard/cross-filter-indicator.tsx`
- Small indicator bar showing active cross-filters
- Shows: "Filtered by: Desk = Operations" with X to clear
- Uses Shadcn `<Badge>` for each active filter
- Clear all button
- Reads from `useFilterStore` crossFilters
- Framer Motion: slides in/out based on whether cross-filters are active

### 8. Dashboard Page Route Component
Update the dashboard route placeholder to render the full dashboard page:
- Reads dashboard config (from hook or mock data)
- Renders: FilterBar → CrossFilterIndicator → DrillBreadcrumb → KPIRow → ChartGrid → DetailGrid section
- Progressive loading: KPIs appear first, then charts, then grid
- Use `<Suspense>` boundaries where appropriate

### 9. Mock Dashboard Config
Create `src/lib/mock/dashboard-config.ts` with a sample "Recon Overview" dashboard:
- 4 KPI cards
- 4 charts (break trend area, breaks by type bar, breaks by desk donut, aging stacked bar)
- Cross-filter rules (desk chart filters all, type chart filters trend + grid)
- Layout config (2x2 grid)

## Design Requirements
- Filter bar: sticky at top of dashboard content area
- KPI cards: `min-h-[100px]`, generous padding, large numbers (text-3xl font-bold)
- Chart panels: `min-h-[300px]`, subtle border, rounded corners
- Spacing between sections: `space-y-6`
- Everything must look premium in both light and dark mode
- Skeleton loaders for every data-dependent component

## Acceptance Criteria
- [ ] Filter bar renders with all 4 filter types + apply/reset
- [ ] KPI cards show with animated values and trend indicators
- [ ] Chart grid renders 4 chart panels in 2x2 layout
- [ ] Drill breadcrumb appears when drill state is active
- [ ] Cross-filter indicator shows active filters
- [ ] Mock dashboard config loads and renders correctly
- [ ] All components work in dark mode
- [ ] No TypeScript errors
