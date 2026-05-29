import { useCallback, useEffect, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { type ColDef, type GridApi, type GridReadyEvent, themeQuartz, colorSchemeDark } from 'ag-grid-community'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { GridToolbar } from '@/components/dashboard/grid-toolbar'
import { ErrorPanel } from '@/components/shared/error-panel'
import { useTheme } from '@/components/layout/theme-provider'
import { useDataSourceQuery } from '@/hooks/use-data-source-query'
import { useDataSourceMerge } from '@/hooks/use-data-source-merge'
import { useFilterStore } from '@/stores/filter-store'
import { rowPassesCrossFilters } from '@/lib/cross-filter'
import { isVisible } from '@/lib/visibility'
import { ApiError } from '@/lib/api-client'
import type { GridColumn, GridConfig, KpiResult } from '@/types/dashboard-config'

interface ConfigDataGridProps {
  grids: GridConfig[]
  kpiResults?: KpiResult[]
  crossFilterEnabled?: boolean
}

const PAGE_SIZE = 50

const DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  suppressMovable: false,
}

function buildColDefs(columns: GridColumn[]): ColDef[] {
  return columns.map((col) => ({
    field: col.field,
    headerName: col.header,
    type: col.type === 'number' ? 'numericColumn' : undefined,
  }))
}

/**
 * Resolve cross-filter column: explicit config > first dimension (string) > first column.
 * Avoids using ID/timestamp columns that are too granular for cross-filtering (review concern 1).
 */
function resolveCrossFilterField(grid: GridConfig): string | undefined {
  if (grid.crossFilterColumn) return grid.crossFilterColumn
  // Find first dimension (string-type) column -- avoids IDs/timestamps
  const firstDimension = grid.columns.find((c) => c.type === 'string')
  return firstDimension?.field ?? grid.columns[0]?.field
}

/**
 * Grid item powered by a single data source.
 * Hook is always called at the top level (not conditionally).
 */
function SingleSourceGrid({
  grid,
  crossFilterEnabled,
}: {
  grid: GridConfig
  crossFilterEnabled?: boolean
}) {
  const appliedFilters = useFilterStore((s) => s.applied)
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const addCrossFilter = useFilterStore((s) => s.addCrossFilter)
  const { resolvedTheme } = useTheme()

  const [gridApi, setGridApi] = useState<GridApi | null>(null)
  const [quickFilter, setQuickFilter] = useState('')
  const [displayedRowCount, setDisplayedRowCount] = useState(0)

  const { data: queryResponse, isLoading, isError, error, refetch } = useDataSourceQuery(
    grid.dataSourceId ?? '',
    appliedFilters,
    !!grid.dataSourceId,
  )

  const columnDefs = useMemo(() => buildColDefs(grid.columns), [grid.columns])
  const rowData = useMemo(() => queryResponse?.rows ?? [], [queryResponse])
  const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz

  // Resolve cross-filter column for row-click emission
  const crossFilterField = useMemo(
    () => resolveCrossFilterField(grid),
    [grid],
  )

  // Trigger external filter refresh when cross-filters change
  useEffect(() => {
    gridApi?.onFilterChanged()
  }, [crossFilters, gridApi])

  const onGridReady = useCallback((event: GridReadyEvent) => {
    setGridApi(event.api)
    setDisplayedRowCount(event.api.getDisplayedRowCount())
    // Update displayed count when filters change
    event.api.addEventListener('filterChanged', () => {
      setDisplayedRowCount(event.api.getDisplayedRowCount())
    })
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

  if (isError) {
    const apiError = error instanceof ApiError ? error : null
    return (
      <Card className="py-4 gap-2">
        <CardHeader className="px-4 py-0">
          <CardTitle className="text-sm font-medium">{grid.title}</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <ErrorPanel
            message={apiError?.userMessage ?? 'Failed to load grid data'}
            detail={apiError?.detail}
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="py-4 gap-2">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-sm font-medium">{grid.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <GridToolbar
          gridApi={gridApi}
          gridTitle={grid.title}
          totalRows={rowData.length}
          displayedRows={displayedRowCount || rowData.length}
          quickFilter={quickFilter}
          onQuickFilterChange={handleQuickFilter}
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
            isExternalFilterPresent={() =>
              crossFilterEnabled === true && crossFilters.length > 0
            }
            doesExternalFilterPass={(node) => {
              const externalFilters = crossFilters.filter(
                (f) => f.sourceChartId !== grid.id,
              )
              return rowPassesCrossFilters(
                node.data as Record<string, unknown>,
                externalFilters,
              )
            }}
            onRowClicked={(event) => {
              if (!crossFilterEnabled || !event.data || !crossFilterField) return
              addCrossFilter({
                sourceChartId: grid.id,
                column: crossFilterField,
                value: (event.data as Record<string, unknown>)[crossFilterField] as string | number,
              })
            }}
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
function MergedSourceGrid({
  grid,
  crossFilterEnabled,
}: {
  grid: GridConfig
  crossFilterEnabled?: boolean
}) {
  const appliedFilters = useFilterStore((s) => s.applied)
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const addCrossFilter = useFilterStore((s) => s.addCrossFilter)
  const { resolvedTheme } = useTheme()

  const [gridApi, setGridApi] = useState<GridApi | null>(null)
  const [quickFilter, setQuickFilter] = useState('')
  const [displayedRowCount, setDisplayedRowCount] = useState(0)

  const mergeConfig = useMemo(
    () => ({
      sources: (grid.sources ?? []).map((s) => s.dataSourceId),
      mergeOn: grid.mergeOn ?? [],
      mergeType: grid.mergeType ?? 'inner',
      coalesceZero: grid.coalesceZero ?? false,
    }),
    [grid.sources, grid.mergeOn, grid.mergeType, grid.coalesceZero],
  )

  const { data: queryResponse, isLoading, isError, error, refetch } = useDataSourceMerge(
    mergeConfig,
    appliedFilters,
    mergeConfig.sources.length > 0,
  )

  const columnDefs = useMemo(() => buildColDefs(grid.columns), [grid.columns])
  const rowData = useMemo(() => queryResponse?.rows ?? [], [queryResponse])
  const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz

  // Resolve cross-filter column for row-click emission
  const crossFilterField = useMemo(
    () => resolveCrossFilterField(grid),
    [grid],
  )

  // Trigger external filter refresh when cross-filters change
  useEffect(() => {
    gridApi?.onFilterChanged()
  }, [crossFilters, gridApi])

  const onGridReady = useCallback((event: GridReadyEvent) => {
    setGridApi(event.api)
    setDisplayedRowCount(event.api.getDisplayedRowCount())
    // Update displayed count when filters change
    event.api.addEventListener('filterChanged', () => {
      setDisplayedRowCount(event.api.getDisplayedRowCount())
    })
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

  if (isError) {
    const apiError = error instanceof ApiError ? error : null
    return (
      <Card className="py-4 gap-2">
        <CardHeader className="px-4 py-0">
          <CardTitle className="text-sm font-medium">{grid.title}</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <ErrorPanel
            message={apiError?.userMessage ?? 'Failed to load grid data'}
            detail={apiError?.detail}
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="py-4 gap-2">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-sm font-medium">{grid.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <GridToolbar
          gridApi={gridApi}
          gridTitle={grid.title}
          totalRows={rowData.length}
          displayedRows={displayedRowCount || rowData.length}
          quickFilter={quickFilter}
          onQuickFilterChange={handleQuickFilter}
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
            isExternalFilterPresent={() =>
              crossFilterEnabled === true && crossFilters.length > 0
            }
            doesExternalFilterPass={(node) => {
              const externalFilters = crossFilters.filter(
                (f) => f.sourceChartId !== grid.id,
              )
              return rowPassesCrossFilters(
                node.data as Record<string, unknown>,
                externalFilters,
              )
            }}
            onRowClicked={(event) => {
              if (!crossFilterEnabled || !event.data || !crossFilterField) return
              addCrossFilter({
                sourceChartId: grid.id,
                column: crossFilterField,
                value: (event.data as Record<string, unknown>)[crossFilterField] as string | number,
              })
            }}
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
export function ConfigDataGrid({ grids, kpiResults, crossFilterEnabled }: ConfigDataGridProps) {
  return (
    <div className="flex flex-col gap-4">
      {grids.map((grid) => {
        if (!isVisible(grid.visibleWhen, kpiResults)) {
          return null
        }

        // Determine whether this grid uses a single source or merged sources
        if (grid.sources && grid.sources.length > 0) {
          return (
            <MergedSourceGrid
              key={grid.id}
              grid={grid}
              crossFilterEnabled={crossFilterEnabled}
            />
          )
        }

        return (
          <SingleSourceGrid
            key={grid.id}
            grid={grid}
            crossFilterEnabled={crossFilterEnabled}
          />
        )
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
