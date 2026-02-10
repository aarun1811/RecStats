import { useCallback, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, GridReadyEvent, PaginationChangedEvent, ValueFormatterParams } from 'ag-grid-community'
import { useTheme } from '@/components/layout/theme-provider'
import { useBreaksData } from '@/hooks/use-breaks-data'
import { GridToolbar } from './grid-toolbar'
import { StatusCell } from './cell-renderers/status-cell'
import { AmountCell } from './cell-renderers/amount-cell'
import { SlaCell } from './cell-renderers/sla-cell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function formatDate(value: unknown): string {
  if (!value) return ''
  const ts = Number(value)
  if (isNaN(ts)) return String(value)
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const COLUMN_DEFS: ColDef[] = [
  { field: 'id', headerName: 'Break ID', width: 130, pinned: 'left' },
  { field: 'createdDate', headerName: 'Created', width: 120, valueFormatter: (p: ValueFormatterParams) => formatDate(p.value) },
  { field: 'resolvedDate', headerName: 'Resolved', width: 120, valueFormatter: (p: ValueFormatterParams) => formatDate(p.value) },
  { field: 'reason', headerName: 'Reason', width: 170 },
  { field: 'desk', headerName: 'Desk', width: 110 },
  { field: 'breakType', headerName: 'Break Type', width: 120 },
  { field: 'amount', headerName: 'Amount', width: 140, type: 'numericColumn', cellRenderer: AmountCell },
  { field: 'currency', headerName: 'Ccy', width: 70 },
  { field: 'status', headerName: 'Status', width: 130, cellRenderer: StatusCell },
  { field: 'agingDays', headerName: 'Aging', width: 80, type: 'numericColumn' },
  { field: 'slaBreach', headerName: 'SLA', width: 70, cellRenderer: SlaCell },
  { field: 'category', headerName: 'Category', width: 100 },
  { field: 'region', headerName: 'Region', width: 90 },
  { field: 'country', headerName: 'Country', width: 110 },
  { field: 'lob', headerName: 'LOB', width: 140 },
  { field: 'assignedTo', headerName: 'Assigned To', width: 140 },
  { field: 'priority', headerName: 'Priority', width: 85, type: 'numericColumn' },
  { field: 'notes', headerName: 'Notes', width: 250, tooltipField: 'notes' },
]

const DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  suppressMovable: false,
}

const PAGE_SIZE = 50

export function DataGrid() {
  const gridRef = useRef<AgGridReact>(null)
  const [gridApi, setGridApi] = useState<GridApi | null>(null)
  const [quickFilter, setQuickFilter] = useState('')
  const [displayedRows, setDisplayedRows] = useState(0)
  const { resolvedTheme } = useTheme()

  const { data, isLoading } = useBreaksData(PAGE_SIZE * 20) // fetch plenty of rows for client-side pagination

  const themeClass = resolvedTheme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'

  const onGridReady = useCallback((event: GridReadyEvent) => {
    setGridApi(event.api)
    setDisplayedRows(event.api.getDisplayedRowCount())
  }, [])

  const onFilterChanged = useCallback(() => {
    if (gridApi) {
      setDisplayedRows(gridApi.getDisplayedRowCount())
    }
  }, [gridApi])

  const handleQuickFilter = useCallback((value: string) => {
    setQuickFilter(value)
    gridApi?.setGridOption('quickFilterText', value)
    setTimeout(() => {
      if (gridApi) setDisplayedRows(gridApi.getDisplayedRowCount())
    }, 100)
  }, [gridApi])

  const rowData = useMemo(() => data?.data ?? [], [data])
  const totalRows = data?.rowCount ?? 0

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Break Records</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Break Records</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <GridToolbar
          gridApi={gridApi}
          totalRows={totalRows}
          displayedRows={displayedRows}
          quickFilter={quickFilter}
          onQuickFilterChange={handleQuickFilter}
        />
        <div className={themeClass} style={{ height: 500, width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={COLUMN_DEFS}
            defaultColDef={DEFAULT_COL_DEF}
            pagination
            paginationPageSize={PAGE_SIZE}
            paginationPageSizeSelector={[25, 50, 100]}
            rowSelection="multiple"
            suppressRowClickSelection
            enableCellTextSelection
            tooltipShowDelay={500}
            onGridReady={onGridReady}
            onFilterChanged={onFilterChanged}
            onPaginationChanged={(e: PaginationChangedEvent) => {
              setDisplayedRows(e.api.getDisplayedRowCount())
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
