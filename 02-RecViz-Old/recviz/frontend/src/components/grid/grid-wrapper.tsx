import { useCallback, useState } from 'react'

import type { ColDef, GridApi, RowClickedEvent } from 'ag-grid-community'

import { DataGrid } from '@/components/grid/data-grid'
import { GridToolbar } from '@/components/grid/grid-toolbar'
import { GridStatusBar } from '@/components/grid/grid-status-bar'

interface GridWrapperProps<TData = Record<string, unknown>> {
  title?: string
  columns: ColDef<TData>[]
  data: TData[]
  loading?: boolean
  onRowClick?: (event: RowClickedEvent<TData>) => void
  enablePivot?: boolean
  enableGrouping?: boolean
  enableMasterDetail?: boolean
  detailCellRenderer?: React.ComponentType<unknown>
  externalFilter?: boolean
}

export function GridWrapper<TData = Record<string, unknown>>({
  title,
  columns,
  data,
  loading = false,
  onRowClick,
  enablePivot = false,
  enableGrouping = true,
  enableMasterDetail = false,
  detailCellRenderer,
  externalFilter = true,
}: GridWrapperProps<TData>) {
  const [gridApi, setGridApi] = useState<GridApi<TData> | null>(null)
  const [pivotMode, setPivotMode] = useState(false)
  const [quickFilterText, setQuickFilterText] = useState('')

  const handleGridReady = useCallback((api: GridApi<TData>) => {
    setGridApi(api)
  }, [])

  // Cast to GridApi (without generic) for the toolbar/status bar which don't need TData
  const untypedApi = gridApi as GridApi | null

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden bg-background">
      <GridToolbar
        title={title}
        rowCount={data.length}
        gridApi={untypedApi}
        pivotMode={pivotMode}
        onPivotModeChange={setPivotMode}
        quickFilterText={quickFilterText}
        onQuickFilterChange={setQuickFilterText}
      />
      <DataGrid<TData>
        columns={columns}
        data={data}
        loading={loading}
        onRowClick={onRowClick}
        enablePivot={enablePivot}
        enableGrouping={enableGrouping}
        enableMasterDetail={enableMasterDetail}
        detailCellRenderer={detailCellRenderer}
        externalFilter={externalFilter}
        pivotMode={pivotMode}
        quickFilterText={quickFilterText}
        onGridReady={handleGridReady}
      />
      <GridStatusBar gridApi={untypedApi} />
    </div>
  )
}
