import { useCallback, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { type ColDef, type GridApi, type GridReadyEvent, themeQuartz, colorSchemeDark } from 'ag-grid-community'
import { useTheme } from '@/components/layout/theme-provider'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ClipboardCopy,
  Download,
  Rows3,
  Save,
  Table2,
} from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import type { SqlResult } from '@/types/api'

interface QueryResultsProps {
  result: SqlResult | null
  isLoading: boolean
  executionTime: number | null
  onSaveAsDataset?: () => void
}

const DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  minWidth: 80,
}

export function QueryResults({ result, isLoading, executionTime, onSaveAsDataset }: QueryResultsProps) {
  const gridRef = useRef<AgGridReact>(null)
  const [gridApi, setGridApi] = useState<GridApi | null>(null)
  const { resolvedTheme } = useTheme()

  const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz

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

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/30">
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
      </div>
    )
  }

  // ── Empty state ──
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="flex items-center justify-center size-14 rounded-xl bg-muted/50"
        >
          <Table2 className="size-6 text-muted-foreground" />
        </motion.div>
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">No results yet</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Write a query and press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">⌘ Enter</kbd> to execute
          </p>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (result.status === 'error') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-destructive/5">
          <div className="flex items-center justify-center size-5 rounded bg-destructive/10">
            <AlertCircle className="size-3 text-destructive" />
          </div>
          <span className="text-xs font-semibold tracking-wide uppercase text-destructive">
            Query Failed
          </span>
          {executionTime !== null && (
            <span className="text-xs text-destructive/60 flex items-center gap-1 ml-auto">
              <Clock className="size-3" />
              {executionTime}ms
            </span>
          )}
        </div>
        <div className="p-4 flex-1 overflow-auto">
          <pre className="text-xs text-destructive/90 bg-destructive/5 border border-destructive/10 p-4 rounded-lg whitespace-pre-wrap font-mono leading-relaxed">
            {result.error}
          </pre>
        </div>
      </div>
    )
  }

  // ── Success state ──
  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
        {/* Left — stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center size-4 rounded-full bg-green-500/10">
              <CheckCircle2 className="size-2.5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs font-medium text-green-600 dark:text-green-400">Success</span>
          </div>
          <span className="text-[10px] text-muted-foreground/40">|</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Rows3 className="size-3" />
            {result.rowCount.toLocaleString()} rows
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="size-3" />
            {executionTime !== null ? `${executionTime}ms` : '--'}
          </span>
          <span className="text-xs text-muted-foreground">
            {columnNames.length} cols
          </span>
        </div>

        {/* Right — actions */}
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
                  <ClipboardCopy className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy as TSV</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={handleExportCsv}>
                  <Download className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>
            {onSaveAsDataset && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs ml-1" onClick={onSaveAsDataset}>
                    <Save className="mr-1 size-3" />
                    Save as Dataset
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create a reusable dataset from this query</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </div>

      {/* Results grid */}
      <div className="flex-1 min-h-0">
        <AgGridReact
          theme={gridTheme}
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
