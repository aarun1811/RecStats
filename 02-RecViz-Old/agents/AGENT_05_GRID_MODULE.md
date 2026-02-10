# Agent 05 — Grid Module

## Mission
Build the AG Grid Enterprise wrapper, toolbar, status bar, and custom cell renderers. The grid is used on the dashboard (detail view) and data explorer (query results).

## Read First
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/CLAUDE.md`
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/agents/AGENT_00_RESULT.md`

## Working Directory
`/Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz/frontend/`

## What Already Exists
- `src/lib/ag-grid-config.ts` — shared grid defaults (animateRows, rowSelection, headerHeight, etc.)
- AG Grid packages: `ag-grid-community`, `ag-grid-enterprise`, `ag-grid-react`
- Types: `filter.ts` (GlobalFilters, CrossFilter)

## Files To Create

### 1. `src/components/grid/data-grid.tsx`
Main AG Grid Enterprise wrapper:
- Props: `columns` (ColDef[]), `data` (Row[]), `loading`, `onRowClick`, `enablePivot`, `enableGrouping`, `enableMasterDetail`, `externalFilter` (for cross-filtering)
- Merges `defaultGridOptions` from ag-grid-config
- AG Grid Enterprise features enabled:
  - Row Grouping (drag columns to group bar)
  - Pivot Mode (toggle via toolbar)
  - Master/Detail (expand row for sub-grid)
  - Excel Export
  - Clipboard
  - Range Selection
  - Status Bar (row count, selection count, aggregations)
  - Quick Filter (type-ahead search)
- External filter integration: reads `crossFilters` from Zustand, applies via `isExternalFilterPresent` + `doesExternalFilterPass`
- Quartz theme with CSS variable overrides matching Shadcn
- Register AG Grid Enterprise modules on first render
- Skeleton loading state when `loading` is true

### 2. `src/components/grid/grid-toolbar.tsx`
Toolbar above the grid:
- Left: Title, row count badge
- Right: Quick filter input, Pivot toggle button, Column chooser button, Export dropdown (Excel, CSV, clipboard)
- Uses Shadcn `<Input>`, `<Button>`, `<DropdownMenu>`, `<Toggle>`
- Pivot toggle: switches AG Grid between flat and pivot mode
- Column chooser: opens AG Grid's built-in column tool panel
- Export: calls AG Grid API `exportDataAsExcel()` / `exportDataAsCsv()`

### 3. `src/components/grid/grid-status-bar.tsx`
Status bar below the grid:
- Shows: total rows, selected rows, filtered rows
- When rows selected: shows sum/avg/min/max of numeric columns
- Uses AG Grid's status bar framework OR custom component reading grid API
- Styled to match Shadcn muted colors, small text (text-xs)

### 4. Cell Renderers

#### `src/components/grid/cell-renderers/status-cell.tsx`
- Renders status as a colored badge
- Open = amber, Resolved = green, Pending = blue, Escalated = red
- Uses Shadcn `<Badge>` with appropriate variant

#### `src/components/grid/cell-renderers/amount-cell.tsx`
- Formats numbers as currency or compact numbers
- Right-aligned
- Negative values in red
- Uses `formatCurrency` / `formatCompactNumber` from utils

#### `src/components/grid/cell-renderers/date-cell.tsx`
- Formats dates using date-fns (`format(date, 'MMM d, yyyy')`)
- Tooltip shows full datetime
- Relative time option ("2 days ago")

#### `src/components/grid/cell-renderers/sparkline-cell.tsx`
- Uses AG Grid's built-in sparkline cell renderer
- Shows a mini line/bar chart inside the cell
- Configured for trend data (last 7/30 days)

### 5. `src/lib/ag-grid-theme.css`
Custom CSS overrides for AG Grid Quartz theme:
```css
/* Map AG Grid CSS variables to Shadcn CSS variables */
.ag-theme-quartz,
.ag-theme-quartz-dark {
  --ag-foreground-color: hsl(var(--foreground));
  --ag-background-color: hsl(var(--background));
  --ag-header-background-color: hsl(var(--muted));
  --ag-border-color: hsl(var(--border));
  --ag-row-hover-color: hsl(var(--accent));
  --ag-selected-row-background-color: hsl(var(--primary) / 0.1);
  --ag-font-family: 'Inter', 'Geist', system-ui, sans-serif;
  --ag-font-size: 13px;
  --ag-header-font-size: 13px;
  --ag-header-font-weight: 600;
}
```
Import this CSS in the data-grid component.

### 6. `src/components/grid/grid-wrapper.tsx`
Complete grid assembly: toolbar + grid + status bar in a single component:
```tsx
export function GridWrapper(props: GridWrapperProps) {
  return (
    <div className="flex flex-col border rounded-lg overflow-hidden">
      <GridToolbar ... />
      <DataGrid ... />
      <GridStatusBar ... />
    </div>
  )
}
```

## Design Requirements
- Grid must handle 10k+ rows at 60fps (AG Grid handles this with virtualization)
- Quartz theme customized to look like it belongs in the Shadcn app
- Cell text: 13px, monospace for numbers, proportional for text
- Header: slightly bolder, muted background
- Row hover: subtle highlight
- Selected rows: primary color with low opacity
- Dark mode: use `ag-theme-quartz-dark` class, same CSS variable mapping

## Acceptance Criteria
- [ ] Grid renders with sample data, columns sortable/filterable
- [ ] Pivot mode toggles on/off
- [ ] Row grouping works (drag column header to group zone)
- [ ] Excel export produces a downloadable file
- [ ] Quick filter narrows visible rows
- [ ] Cell renderers display correctly (status badges, formatted amounts, dates)
- [ ] External cross-filter from Zustand filters rows
- [ ] Master/Detail expand works (renders sub-grid)
- [ ] Grid looks native to the Shadcn design in both light/dark
- [ ] No TypeScript errors
