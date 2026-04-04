import { useCallback, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { type ColDef, type GridApi, type GridReadyEvent, themeQuartz, colorSchemeDark } from 'ag-grid-community'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from '@/components/layout/theme-provider'
import { useDataSourceQuery } from '@/hooks/use-data-source-query'
import { useDataSourceMerge } from '@/hooks/use-data-source-merge'
import { useFilterStore } from '@/stores/filter-store'
import type { GridColumn, GridConfig, KpiResult, VisibleWhen } from '@/types/dashboard-config'

interface ConfigDataGridProps {
  grids: GridConfig[]
  kpiResults?: KpiResult[]
}

const PAGE_SIZE = 50

const DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  suppressMovable: false,
}

function isVisible(
  visibleWhen: VisibleWhen | undefined,
  kpiResults?: KpiResult[],
): boolean {
  if (!visibleWhen || !kpiResults) return true
  const kpi = kpiResults.find((k) => k.id === visibleWhen.kpi)
  if (!kpi) return true
  switch (visibleWhen.condition) {
    case 'gt':
      return kpi.value > visibleWhen.value
    case 'lt':
      return kpi.value < visibleWhen.value
    case 'eq':
      return kpi.value === visibleWhen.value
    default:
      return true
  }
}

function buildColDefs(columns: GridColumn[]): ColDef[] {
  return columns.map((col) => ({
    field: col.field,
    headerName: col.header,
    type: col.type === 'number' ? 'numericColumn' : undefined,
  }))
}

/**
 * Grid item powered by a single data source.
 * Hook is always called at the top level (not conditionally).
 */
function SingleSourceGrid({ grid }: { grid: GridConfig }) {
  const appliedFilters = useFilterStore((s) => s.applied)
  const { resolvedTheme } = useTheme()

  const [gridApi, setGridApi] = useState<GridApi | null>(null)
  const [quickFilter, setQuickFilter] = useState('')

  const { data: queryResponse, isLoading } = useDataSourceQuery(
    grid.dataSourceId ?? '',
    appliedFilters,
    !!grid.dataSourceId,
  )

  const columnDefs = useMemo(() => buildColDefs(grid.columns), [grid.columns])
  const rowData = useMemo(() => queryResponse?.rows ?? [], [queryResponse])
  const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz

  const onGridReady = useCallback((event: GridReadyEvent) => {
    setGridApi(event.api)
  }, [])

  const handleQuickFilter = useCallback(
    (value: string) => {
      setQuickFilter(value)
      gridApi?.setGridOption('quickFilterText', value)
    },
    [gridApi],
  )

  if (isLoading) {
    return <GridSkeleton title={grid.title} />
  }

  return (
    <Card className="py-4 gap-2">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-sm font-medium">{grid.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <Input
          placeholder="Quick filter..."
          value={quickFilter}
          onChange={(e) => handleQuickFilter(e.target.value)}
          className="max-w-sm"
        />
        <div style={{ height: 400, width: '100%' }}>
          <AgGridReact
            theme={gridTheme}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={DEFAULT_COL_DEF}
            pagination
            paginationPageSize={PAGE_SIZE}
            paginationPageSizeSelector={[25, 50, 100]}
            enableCellTextSelection
            onGridReady={onGridReady}
          />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Grid item powered by multiple merged data sources.
 * Hook is always called at the top level (not conditionally).
 */
function MergedSourceGrid({ grid }: { grid: GridConfig }) {
  const appliedFilters = useFilterStore((s) => s.applied)
  const { resolvedTheme } = useTheme()

  const [gridApi, setGridApi] = useState<GridApi | null>(null)
  const [quickFilter, setQuickFilter] = useState('')

  const mergeConfig = useMemo(
    () => ({
      sources: (grid.sources ?? []).map((s) => s.dataSourceId),
      mergeOn: grid.mergeOn ?? [],
      mergeType: grid.mergeType ?? 'inner',
    }),
    [grid.sources, grid.mergeOn, grid.mergeType],
  )

  const { data: queryResponse, isLoading } = useDataSourceMerge(
    mergeConfig,
    appliedFilters,
    mergeConfig.sources.length > 0,
  )

  const columnDefs = useMemo(() => buildColDefs(grid.columns), [grid.columns])
  const rowData = useMemo(() => queryResponse?.rows ?? [], [queryResponse])
  const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz

  const onGridReady = useCallback((event: GridReadyEvent) => {
    setGridApi(event.api)
  }, [])

  const handleQuickFilter = useCallback(
    (value: string) => {
      setQuickFilter(value)
      gridApi?.setGridOption('quickFilterText', value)
    },
    [gridApi],
  )

  if (isLoading) {
    return <GridSkeleton title={grid.title} />
  }

  return (
    <Card className="py-4 gap-2">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-sm font-medium">{grid.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <Input
          placeholder="Quick filter..."
          value={quickFilter}
          onChange={(e) => handleQuickFilter(e.target.value)}
          className="max-w-sm"
        />
        <div style={{ height: 400, width: '100%' }}>
          <AgGridReact
            theme={gridTheme}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={DEFAULT_COL_DEF}
            pagination
            paginationPageSize={PAGE_SIZE}
            paginationPageSizeSelector={[25, 50, 100]}
            enableCellTextSelection
            onGridReady={onGridReady}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function GridSkeleton({ title }: { title?: string }) {
  return (
    <Card className="py-4 gap-2">
      <CardHeader className="px-4 py-0">
        {title ? (
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

/**
 * Config-driven data grid section.
 *
 * Renders one or more AG Grid Enterprise tables from a dashboard configuration.
 * Each grid can be powered by a single data source or by merging multiple sources.
 * Grids support conditional visibility based on KPI values (e.g. only show the
 * breaks grid when breaks > 0).
 */
export function ConfigDataGrid({ grids, kpiResults }: ConfigDataGridProps) {
  return (
    <div className="flex flex-col gap-4">
      {grids.map((grid) => {
        if (!isVisible(grid.visibleWhen, kpiResults)) {
          return null
        }

        // Determine whether this grid uses a single source or merged sources
        if (grid.sources && grid.sources.length > 0) {
          return <MergedSourceGrid key={grid.id} grid={grid} />
        }

        return <SingleSourceGrid key={grid.id} grid={grid} />
      })}
    </div>
  )
}

export function ConfigDataGridSkeleton({ count = 1 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <GridSkeleton key={i} />
      ))}
    </div>
  )
}
