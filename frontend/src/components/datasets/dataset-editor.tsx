import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import { ArrowLeft, Play, Loader2, Trash2, Save, Columns3 } from 'lucide-react'

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
import type { MergedColumn } from '@/lib/column-merge'
import type { RecvizDataset, DatasetColumnMeta } from '@/types/managed-dataset'
import type { SqlResult } from '@/types/api'
import { useTheme } from '@/components/layout/theme-provider'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'

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
    const dbId = Number(databaseId)
    if (!sql.trim() || !dbId || sqlExecute.isPending) return

    sqlExecute.mutate(
      { sql, databaseId: dbId, limit: 1000 },
      {
        onSuccess: (result) => {
          setQueryResult(result)
          setLastRunSql(sql)

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
        },
      },
    )
  }, [sql, databaseId, sqlExecute, columns])

  const handleSave = useCallback(() => {
    if (hasUnsavedSqlChanges) return
    if (!name.trim()) {
      toast.error('Please enter a dataset name')
      return
    }

    const dbId = Number(databaseId)
    if (!dbId) {
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
          databaseId: dbId,
          sql,
          columns: cleanColumns,
        },
        {
          onSuccess: () => {
            toast.success(`Dataset "${name.trim()}" created`)
            navigate({ to: '/datasets' })
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
        toast.success(`Dataset "${dataset.name}" deleted`)
        navigate({ to: '/datasets' })
      },
    })
  }, [dataset, deleteDataset, navigate])

  const isSaving = createDataset.isPending || updateDataset.isPending

  // Results preview column defs
  const resultColumnDefs = useMemo<ColDef[]>(() => {
    if (!queryResult?.columns) return []
    return queryResult.columns.map((col) => ({
      field: col.column_name ?? col.name,
      headerName: col.column_name ?? col.name,
      flex: 1,
      minWidth: 100,
    }))
  }, [queryResult?.columns])

  const resultRowData = useMemo(
    () => queryResult?.data ?? [],
    [queryResult?.data],
  )

  const resultThemeClass =
    resolvedTheme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'

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
        {/* Top bar: back link + actions */}
        <div className="flex items-center justify-between">
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
          className="text-2xl font-semibold tracking-tight bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none w-full placeholder:text-muted-foreground/50 transition-colors pb-1"
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
        />
      </div>

      {/* SQL re-run banner */}
      <div className="px-6 shrink-0">
        <AnimatePresence>
          {hasUnsavedSqlChanges && <DatasetSqlRerunBanner />}
        </AnimatePresence>
      </div>

      {/* Results + Column Metadata split */}
      <div className="flex gap-4 flex-1 min-h-0 px-6 pb-4">
        {/* Left: Results preview */}
        <div className="flex-1 min-w-0 rounded-lg border overflow-hidden flex flex-col bg-card">
          <div className="flex items-center justify-between px-3 h-9 border-b bg-muted/30 shrink-0">
            <span className="text-sm font-semibold tracking-tight">Preview</span>
            {queryResult?.status === 'success' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {queryResult.rowCount.toLocaleString()} rows
                </span>
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
            <div className="p-4">
              <pre className="text-sm text-destructive bg-destructive/5 p-3 rounded-md whitespace-pre-wrap">
                {queryResult.error}
              </pre>
            </div>
          ) : queryResult?.status === 'success' ? (
            <div className={`flex-1 min-h-0 ${resultThemeClass}`}>
              <AgGridReact
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
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2">
              <Play className="size-10 opacity-30" />
              <p className="text-sm">Run a query to see results</p>
            </div>
          )}
        </div>

        {/* Right: Column metadata */}
        <div className="w-[480px] shrink-0 rounded-lg border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center px-3 h-9 border-b bg-muted/30 shrink-0">
            <Columns3 className="mr-1.5 size-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold tracking-tight">Column Metadata</span>
          </div>
          {columns.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-auto">
              <ColumnMetadataGrid columns={columns} onChange={setColumns} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2">
              <Columns3 className="size-10 opacity-30" />
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
