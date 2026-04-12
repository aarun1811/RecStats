import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import { format as formatSql } from 'sql-formatter'
import { ArrowLeft, Play, Loader2, Trash2, Save, Columns3, Eye, Code2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { SqlEditor } from '@/components/explorer/sql-editor'
import { ColumnMetadataGrid } from '@/components/datasets/column-metadata-grid'
import { ColumnMetadataHelpSheet } from '@/components/datasets/column-metadata-help-sheet'
import { DatasetSqlRerunBanner } from '@/components/datasets/dataset-sql-rerun-banner'
import { DeleteDatasetDialog } from '@/components/datasets/delete-dataset-dialog'
import { useDatabases } from '@/hooks/use-databases'
import { useSqlExecute } from '@/hooks/use-sql-execute'
import {
  useCreateDataset,
  useUpdateDataset,
  useDeleteDataset,
} from '@/hooks/use-managed-datasets'
import { autoDetectColumns } from '@/lib/column-detection'
import { mergeColumns } from '@/lib/column-merge'
import { cn } from '@/lib/utils'
import type { MergedColumn } from '@/lib/column-merge'
import type { RecvizDataset, DatasetColumnMeta } from '@/types/managed-dataset'
import type { SqlResult } from '@/types/api'
import { useTheme } from '@/components/layout/theme-provider'
import { AgGridReact } from 'ag-grid-react'
import { type ColDef, themeQuartz, colorSchemeDark } from 'ag-grid-community'

// --- Run button state machine ---
type RunState = 'idle' | 'running' | 'success' | 'error'

interface DatasetEditorProps {
  mode: 'create' | 'edit'
  dataset?: RecvizDataset
  isLoading?: boolean
}

export function DatasetEditor({ mode, dataset, isLoading }: DatasetEditorProps) {
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()

  // Data hooks
  const { data: databases = [] } = useDatabases()
  const sqlExecute = useSqlExecute()
  const createDataset = useCreateDataset()
  const updateDataset = useUpdateDataset()
  const deleteDataset = useDeleteDataset()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [databaseId, setDatabaseId] = useState<string>('')
  const [sql, setSql] = useState('')
  const [columns, setColumns] = useState<MergedColumn[]>([])
  const [lastRunSql, setLastRunSql] = useState('')
  const [queryResult, setQueryResult] = useState<SqlResult | null>(null)
  const [showFormatted, setShowFormatted] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Run state machine
  const [runState, setRunState] = useState<RunState>('idle')
  const [runResultText, setRunResultText] = useState('')
  const [runStartTime, setRunStartTime] = useState(0)
  const [executionTime, setExecutionTime] = useState<number | null>(null)

  // Derived state
  const hasUnsavedSqlChanges = sql !== lastRunSql && lastRunSql !== ''

  // Initialize form from dataset in edit mode
  useEffect(() => {
    if (dataset) {
      setName(dataset.name)
      setDescription(dataset.description)
      setDatabaseId(String(dataset.databaseId))
      setSql(dataset.sql)
      setLastRunSql(dataset.sql)
      setColumns(
        dataset.columns.map((c) => ({ ...c, status: 'unchanged' as const })),
      )
    }
  }, [dataset])

  const handleRunQuery = useCallback(() => {
    if (!sql.trim() || !databaseId || sqlExecute.isPending) return

    const startTime = Date.now()
    setRunState('running')
    setRunStartTime(startTime)

    sqlExecute.mutate(
      { sql, databaseId, limit: 1000 },
      {
        onSuccess: (result) => {
          setQueryResult(result)
          setLastRunSql(sql)

          const elapsed = (Date.now() - startTime) / 1000
          setExecutionTime(elapsed)
          setRunState('success')
          setRunResultText(`${result.rowCount} rows in ${elapsed.toFixed(2)}s`)
          setTimeout(() => setRunState('idle'), 3000)

          const colNames = result.columns.map((c) => c.column_name ?? c.name)

          if (columns.length === 0) {
            // First run: auto-detect columns
            const detected = autoDetectColumns(colNames, result.data)
            setColumns(detected.map((c) => ({ ...c, status: 'unchanged' as const })))
          } else {
            // Subsequent run: merge columns
            const existingCols: DatasetColumnMeta[] = columns
              .filter((c) => c.status !== 'missing')
              .map(({ status: _status, ...rest }) => rest)
            const detected = autoDetectColumns(colNames, result.data)
            setColumns(mergeColumns(existingCols, detected))
          }
        },
        onError: (err) => {
          setQueryResult({
            status: 'error',
            columns: [],
            data: [],
            rowCount: 0,
            error: err.message,
          })
          setRunState('error')
          setRunResultText(err.message.slice(0, 100))
          setTimeout(() => setRunState('idle'), 5000)
        },
      },
    )
  }, [sql, databaseId, sqlExecute, columns])

  const handleFormatSql = useCallback(() => {
    try {
      const formatted = formatSql(sql, { language: 'plsql' })
      setSql(formatted)
    } catch {
      // If formatting fails, leave SQL unchanged
      toast.error('Could not format SQL')
    }
  }, [sql])

  const handleSave = useCallback(() => {
    if (hasUnsavedSqlChanges) return
    if (!name.trim()) {
      toast.error('Please enter a dataset name')
      return
    }

    if (!databaseId) {
      toast.error('Please select a database')
      return
    }

    // Strip merge status before saving
    const cleanColumns: DatasetColumnMeta[] = columns
      .filter((c) => c.status !== 'missing')
      .map(({ status: _status, ...rest }) => rest)

    if (mode === 'create') {
      createDataset.mutate(
        {
          name: name.trim(),
          description: description.trim(),
          databaseId,
          sql,
          columns: cleanColumns,
        },
        {
          onSuccess: () => {
            toast.success(`Dataset "${name.trim()}" created`)
            navigate({ to: '/datasets' })
          },
          onError: (err) => {
            toast.error(`Failed to create dataset: ${err.message}`)
          },
        },
      )
    } else if (dataset) {
      updateDataset.mutate(
        {
          id: dataset.id,
          data: {
            name: name.trim(),
            description: description.trim(),
            sql,
            columns: cleanColumns,
          },
        },
        {
          onSuccess: () => {
            toast.success(`Dataset "${name.trim()}" updated`)
          },
          onError: (err) => {
            toast.error(`Failed to update dataset: ${err.message}`)
          },
        },
      )
    }
  }, [
    hasUnsavedSqlChanges,
    name,
    databaseId,
    columns,
    mode,
    sql,
    description,
    dataset,
    createDataset,
    updateDataset,
    navigate,
  ])

  const handleDelete = useCallback(() => {
    if (!dataset) return
    deleteDataset.mutate(dataset.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false)
        toast.success(`Dataset "${dataset.name}" deleted`)
        navigate({ to: '/datasets' })
      },
      onError: (err) => {
        toast.error(`Failed to delete dataset: ${err.message}`)
      },
    })
  }, [dataset, deleteDataset, navigate])

  const isSaving = createDataset.isPending || updateDataset.isPending

  // Results preview column defs
  const resultColumnDefs = useMemo<ColDef[]>(() => {
    if (!queryResult?.columns) return []
    return queryResult.columns.map((col) => {
      const colName = col.column_name ?? col.name
      const meta = columns.find((c) => c.name === colName)
      const def: ColDef = {
        field: colName,
        headerName: colName,
        flex: 1,
        minWidth: 100,
      }
      if (showFormatted && meta?.formatPreset && meta.formatPreset !== 'none') {
        def.valueFormatter = (params) => {
          if (params.value == null) return ''
          switch (meta.formatPreset) {
            case 'number':
              return Number(params.value).toLocaleString('en-US')
            case 'currency':
              return Number(params.value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            case 'percentage':
              return `${Number(params.value).toFixed(1)}%`
            case 'decimal2':
              return Number(params.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            case 'date':
            case 'datetime':
              return String(params.value)
            default:
              return String(params.value)
          }
        }
      }
      return def
    })
  }, [queryResult?.columns, showFormatted, columns])

  const resultRowData = useMemo(
    () => queryResult?.data ?? [],
    [queryResult?.data],
  )

  const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-64 flex-1" />
          <Skeleton className="h-64 w-[480px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="px-6 pt-4 pb-4 shrink-0 space-y-3">
        {/* Top bar: back link + mode badge + actions */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-2"
              aria-label="Back to datasets"
              onClick={() => navigate({ to: '/datasets' })}
            >
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Button>
            <Badge
              variant="outline"
              className={cn(
                'h-5 px-2 text-xs font-semibold',
                mode === 'create'
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-muted text-muted-foreground border-border',
              )}
            >
              {mode === 'create' ? 'New' : 'Editing'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'edit' && dataset && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete Dataset
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={hasUnsavedSqlChanges || isSaving || !name.trim() || !databaseId || !lastRunSql}
            >
              {isSaving ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 size-3.5" />
              )}
              {mode === 'create' ? 'Save Dataset' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Dataset name as editable heading */}
        <input
          className="text-2xl font-semibold tracking-tight bg-transparent border-b border-dashed border-border/50 hover:border-border focus:border-primary focus:border-solid outline-none w-full placeholder:text-muted-foreground/50 transition-colors pb-1"
          placeholder="Untitled Dataset"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* Metadata row */}
        <div className="flex items-center gap-4">
          <Select value={databaseId} onValueChange={setDatabaseId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select database" />
            </SelectTrigger>
            <SelectContent>
              {databases.map((db) => (
                <SelectItem key={db.id} value={String(db.id)}>
                  {db.databaseName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="flex-1"
            placeholder="Add a description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* SQL Editor panel */}
      <div className="mx-6 rounded-lg border bg-card overflow-hidden mb-4 shrink-0 h-[250px]">
        <SqlEditor
          value={sql}
          onChange={setSql}
          onRun={handleRunQuery}
          isRunning={sqlExecute.isPending}
          onFormat={handleFormatSql}
          runState={runState}
          runResultText={runResultText}
        />
      </div>

      {/* SQL re-run banner */}
      <div className="px-6 shrink-0">
        <AnimatePresence>
          {hasUnsavedSqlChanges && <DatasetSqlRerunBanner />}
        </AnimatePresence>
      </div>

      {/* Results + Column Metadata split */}
      <div className="flex gap-4 flex-1 min-h-0 px-6 pb-4" style={{ minHeight: '200px' }}>
        {/* Left: Results preview */}
        <div className="flex-1 min-w-0 rounded-lg border overflow-hidden flex flex-col bg-card">
          <div className="flex items-center justify-between px-3 h-9 border-b border-l-2 border-l-primary bg-muted/30 shrink-0">
            <div className="flex items-center">
              <Eye className="mr-1.5 size-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold tracking-tight">Preview</span>
            </div>
            {queryResult?.status === 'success' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded-md">
                  {queryResult.rowCount.toLocaleString()} rows
                </span>
                <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded-md">
                  {queryResult.columns.length} columns
                </span>
                {executionTime !== null && (
                  <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded-md">
                    {executionTime.toFixed(2)}s
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowFormatted((v) => !v)}
                >
                  {showFormatted ? 'Show Raw' : 'Show Formatted'}
                </Button>
              </div>
            )}
          </div>
          {queryResult?.status === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="p-4"
            >
              <pre className="text-sm text-destructive bg-destructive/5 p-3 rounded-md whitespace-pre-wrap">
                {queryResult.error}
              </pre>
            </motion.div>
          ) : queryResult?.status === 'success' ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex-1 min-h-0"
            >
              <AgGridReact
                theme={gridTheme}
                rowData={resultRowData}
                columnDefs={resultColumnDefs}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  minWidth: 80,
                }}
                pagination
                paginationPageSize={50}
                paginationPageSizeSelector={[25, 50, 100]}
                enableCellTextSelection
              />
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2">
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.4, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Play className="size-7" />
              </motion.div>
              <p className="text-sm">Run a query to see results</p>
            </div>
          )}
        </div>

        {/* Right: Column metadata */}
        <div className="w-[480px] shrink-0 rounded-lg border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 h-9 border-b border-l-2 border-l-primary bg-muted/30 shrink-0">
            <div className="flex items-center">
              <Columns3 className="mr-1.5 size-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold tracking-tight">Column Metadata</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AnimatePresence>
                {columns.some((c) => c.status === 'missing') && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-6 text-[11px] px-2"
                      onClick={() => setColumns(columns.filter((c) => c.status !== 'missing'))}
                    >
                      <Trash2 className="mr-1 size-3" />
                      Discard Missing
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
              <ColumnMetadataHelpSheet />
            </div>
          </div>
          {columns.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-auto">
              <ColumnMetadataGrid columns={columns} onChange={setColumns} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2">
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.4, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Columns3 className="size-7" />
              </motion.div>
              <p className="text-sm">Run a query to detect columns</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete dialog */}
      {mode === 'edit' && dataset && (
        <DeleteDatasetDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          datasetId={dataset.id}
          datasetName={dataset.name}
          onConfirmDelete={handleDelete}
          isDeleting={deleteDataset.isPending}
        />
      )}
    </div>
  )
}
