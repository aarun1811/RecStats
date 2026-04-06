import { useCallback, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community'
import { useTheme } from '@/components/layout/theme-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Copy, BarChart3, CheckCircle2, XCircle, Clock, Save } from 'lucide-react'
import { toast } from 'sonner'
import type { SqlResult } from '@/types/api'

interface QueryResultsProps {
  result: SqlResult | null
  isLoading: boolean
  executionTime: number | null
  onChartIt: () => void
  onSaveAsDataset?: () => void
}

const DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  minWidth: 80,
}

export function QueryResults({ result, isLoading, executionTime, onChartIt, onSaveAsDataset }: QueryResultsProps) {
  const gridRef = useRef<AgGridReact>(null)
  const [gridApi, setGridApi] = useState<GridApi | null>(null)
  const { resolvedTheme } = useTheme()

  const themeClass = resolvedTheme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'

  const columnNames = useMemo(
    () => result?.columns?.map((col) => typeof col === 'string' ? col : col.column_name ?? col.name) ?? [],
    [result?.columns],
  )

  const columnDefs = useMemo<ColDef[]>(() => {
    if (!columnNames.length) return []
    return columnNames.map((name) => ({
      field: name,
      headerName: name,
      flex: 1,
      minWidth: 100,
    }))
  }, [columnNames])

  const rowData = useMemo(() => result?.data ?? [], [result?.data])

  const onGridReady = useCallback((e: GridReadyEvent) => {
    setGridApi(e.api)
    e.api.sizeColumnsToFit()
  }, [])

  const handleExportCsv = () => {
    gridApi?.exportDataAsCsv({ fileName: 'query-results.csv' })
  }

  const handleCopy = () => {
    if (!result?.data?.length) return
    const header = columnNames.join('\t')
    const rows = result.data.map((row) =>
      columnNames.map((col) => String(row[col] ?? '')).join('\t'),
    )
    const tsv = [header, ...rows].join('\n')
    navigator.clipboard.writeText(tsv)
    toast.success('Copied to clipboard')
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <BarChart3 className="size-10 opacity-30" />
        <p className="text-sm">Run a query to see results</p>
      </div>
    )
  }

  if (result.status === 'error') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-destructive/10">
          <XCircle className="size-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">Query Error</span>
        </div>
        <div className="p-4">
          <pre className="text-sm text-destructive bg-destructive/5 p-3 rounded-md whitespace-pre-wrap">
            {result.error}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1 text-xs">
            <CheckCircle2 className="size-3 text-green-500" />
            Success
          </Badge>
          <span className="text-xs text-muted-foreground">
            {result.rowCount.toLocaleString()} rows
          </span>
          {executionTime !== null && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              {executionTime}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onChartIt}>
            <BarChart3 className="mr-1 size-3" />
            Chart It
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCopy}>
            <Copy className="mr-1 size-3" />
            Copy
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExportCsv}>
            <Download className="mr-1 size-3" />
            CSV
          </Button>
          {onSaveAsDataset && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onSaveAsDataset}>
              <Save className="mr-1 size-3" />
              Save as Dataset
            </Button>
          )}
        </div>
      </div>
      {/* Results grid */}
      <div className={`flex-1 min-h-0 ${themeClass}`}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={DEFAULT_COL_DEF}
          pagination
          paginationPageSize={50}
          paginationPageSizeSelector={[25, 50, 100]}
          enableCellTextSelection
          onGridReady={onGridReady}
        />
      </div>
    </div>
  )
}
