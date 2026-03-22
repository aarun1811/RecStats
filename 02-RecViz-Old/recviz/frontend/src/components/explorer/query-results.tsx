import { useMemo, useState } from 'react'

import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import {
  AlertCircle,
  BarChart3,
  ClipboardCopy,
  Download,
  Loader2,
  Terminal,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { defaultGridOptions } from '@/lib/ag-grid-config'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import type { SqlExecuteResponse } from '@/types/api'

interface QueryResult {
  id: string
  label: string
  data: SqlExecuteResponse | null
  error: string | null
  isLoading: boolean
}

interface QueryResultsProps {
  results: QueryResult[]
  activeTabId: string
  onTabChange: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onChartIt?: (result: SqlExecuteResponse) => void
  onExportCsv?: (result: SqlExecuteResponse) => void
}

function ResultToolbar({
  result,
  onChartIt,
  onExportCsv,
}: {
  result: SqlExecuteResponse
  onChartIt?: (result: SqlExecuteResponse) => void
  onExportCsv?: (result: SqlExecuteResponse) => void
}) {
  const handleCopy = () => {
    const header = result.columns.map((c) => c.name).join('\t')
    const rows = result.data.map((row) =>
      result.columns.map((c) => String(row[c.name] ?? '')).join('\t'),
    )
    const text = [header, ...rows].join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">
        {result.query.rowCount.toLocaleString()} rows
      </span>
      <span className="text-xs text-muted-foreground">
        {result.query.executionTime < 1000
          ? `${result.query.executionTime}ms`
          : `${(result.query.executionTime / 1000).toFixed(1)}s`}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {onChartIt && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => onChartIt(result)}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Chart It
          </Button>
        )}
        {onExportCsv && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => onExportCsv(result)}
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={handleCopy}
        >
          <ClipboardCopy className="h-3.5 w-3.5" />
          Copy
        </Button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Terminal className="h-10 w-10 opacity-30" />
      <p className="text-sm">Run a query to see results</p>
      <p className="text-xs opacity-60">Press Cmd+Enter to execute</p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="m-3 rounded-md border border-destructive/50 bg-destructive/5 p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-destructive">Query Error</p>
          <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-destructive/80">
            {message}
          </pre>
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Executing query...</p>
    </div>
  )
}

function ResultGrid({ data }: { data: SqlExecuteResponse }) {
  const columnDefs = useMemo<ColDef[]>(
    () =>
      data.columns.map((col) => ({
        field: col.name,
        headerName: col.name,
        filter: true,
        sortable: true,
        resizable: true,
      })),
    [data.columns],
  )

  return (
    <div className="ag-theme-quartz h-full w-full dark:ag-theme-quartz-dark">
      <AgGridReact
        {...defaultGridOptions}
        rowData={data.data}
        columnDefs={columnDefs}
        enableCellTextSelection
        suppressCellFocus={false}
        animateRows={false}
      />
    </div>
  )
}

export function QueryResults({
  results,
  activeTabId,
  onTabChange,
  onTabClose,
  onChartIt,
  onExportCsv,
}: QueryResultsProps) {
  const [_hoveredTab, setHoveredTab] = useState<string | null>(null)
  const activeResult = results.find((r) => r.id === activeTabId)

  if (results.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-background">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-background">
      {/* Tab bar */}
      {results.length > 1 && (
        <div className="flex items-center gap-0 overflow-x-auto border-b border-border bg-muted/50">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => onTabChange(result.id)}
              onMouseEnter={() => setHoveredTab(result.id)}
              onMouseLeave={() => setHoveredTab(null)}
              className={cn(
                'group flex items-center gap-1 border-r border-border px-3 py-1.5 text-xs transition-colors',
                result.id === activeTabId
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:bg-background/50',
              )}
            >
              <span className="max-w-[120px] truncate">{result.label}</span>
              {result.isLoading && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {result.error && (
                <AlertCircle className="h-3 w-3 text-destructive" />
              )}
              {results.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTabClose(result.id)
                  }}
                  className="ml-1 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {activeResult && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {activeResult.isLoading && <LoadingState />}
          {activeResult.error && <ErrorState message={activeResult.error} />}
          {activeResult.data && !activeResult.isLoading && (
            <>
              <ResultToolbar
                result={activeResult.data}
                onChartIt={onChartIt}
                onExportCsv={onExportCsv}
              />
              <div className="flex-1 overflow-hidden">
                <ResultGrid data={activeResult.data} />
              </div>
            </>
          )}
          {!activeResult.data &&
            !activeResult.error &&
            !activeResult.isLoading && <EmptyState />}
        </div>
      )}

      {!activeResult && (
        <div className="flex-1">
          <EmptyState />
        </div>
      )}
    </div>
  )
}

export function QueryResultsSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-background">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-12" />
        </div>
      </div>
      <div className="flex-1 p-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
