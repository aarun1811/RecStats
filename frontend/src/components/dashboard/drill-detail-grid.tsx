import { useCallback, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { type ColDef, type GridApi, type GridReadyEvent } from 'ag-grid-community'
import { gridTheme } from '@/lib/grid-theme'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorPanel } from '@/components/shared/error-panel'
import { useTheme } from '@/components/layout/theme-provider'
import { useDrillDetail } from '@/hooks/use-drill-detail'
import { useFilterStore } from '@/stores/filter-store'
import { ApiError } from '@/lib/api-client'
import type { DrillLevel } from '@/types/filter'

interface DrillDetailGridProps {
  chartTitle: string
  dataSourceId: string
  drillLevels: DrillLevel[]
}

const PAGE_SIZE = 100
const MIN_HEIGHT = 320
const MAX_HEIGHT = 480

const DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  suppressMovable: false,
}

/**
 * Full-width AG Grid for detail-level drill data.
 * Fetches raw rows from the backend via useDrillDetail.
 * Includes column auto-sizing, sort, filter, pagination, and dark mode support.
 *
 * Uses `data-static` attribute on Card to prevent hover lift effect.
 */
export function DrillDetailGrid({
  chartTitle,
  dataSourceId,
  drillLevels,
}: DrillDetailGridProps) {
  const appliedFilters = useFilterStore((s) => s.applied)
  const { resolvedTheme } = useTheme()

  const [, setGridApi] = useState<GridApi | null>(null)

  const { data, isLoading, isError, error, refetch } = useDrillDetail(
    dataSourceId,
    appliedFilters,
    drillLevels,
  )

  const columns = data?.columns
  const rows = data?.rows

  const columnDefs = useMemo((): ColDef[] => {
    if (!columns) return []
    return columns.map((col) => ({
      field: col,
      headerName: col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }))
  }, [columns])

  const rowData = useMemo(() => rows ?? [], [rows])

  const onGridReady = useCallback((event: GridReadyEvent) => {
    setGridApi(event.api)
    // Auto-size columns after data loads
    setTimeout(() => event.api.autoSizeAllColumns(), 100)
  }, [])

  // Ref for auto-scroll into view (used by parent animation callback)
  const containerRef = useRef<HTMLDivElement>(null)

  if (isLoading) {
    return (
      <Card data-static>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-medium">
            {chartTitle} - Detail
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Skeleton className="w-full rounded-lg" style={{ height: MIN_HEIGHT }} />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    const apiError = error instanceof ApiError ? error : null
    return (
      <Card data-static>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-medium">
            {chartTitle} - Detail
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ErrorPanel
            message={apiError?.userMessage ?? 'Failed to load detail data. Check your connection and try again.'}
            detail={apiError?.detail}
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    )
  }

  if (!rowData.length) {
    return (
      <Card data-static>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-medium">
            {chartTitle} - Detail
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-foreground">No detail records</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No rows match the current drill-down path. Try drilling into a different value.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-static ref={containerRef}>
      <CardHeader className="px-4 py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          {chartTitle} - Detail
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {rowData.length} rows
        </span>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div style={{ height: Math.min(Math.max(MIN_HEIGHT, rowData.length * 32 + 48), MAX_HEIGHT), width: '100%' }} data-ag-theme-mode={resolvedTheme}>
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
