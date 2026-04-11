import { useState, useCallback, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Database } from 'lucide-react'

import { useSqlExecute } from '@/hooks/use-sql-execute'
import { useDatabases } from '@/hooks/use-databases'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SqlEditor } from '@/components/explorer/sql-editor'
import { SchemaBrowser } from '@/components/explorer/schema-browser'
import { QueryResults } from '@/components/explorer/query-results'
import { QueryHistory } from '@/components/explorer/query-history'
import { ChartBuilderDialog } from '@/components/explorer/chart-builder-dialog'
import { SaveAsDatasetDialog } from '@/components/explorer/save-as-dataset-dialog'
import type { SqlResult } from '@/types/api'

export const Route = createFileRoute('/_app/explorer/')({
  component: Explorer,
})

const DEFAULT_SQL = ''

function Explorer() {
  const { data: databases = [] } = useDatabases()

  const [selectedDbId, setSelectedDbId] = useState<string>('')
  const [sql, setSql] = useState(DEFAULT_SQL)
  const [result, setResult] = useState<SqlResult | null>(null)
  const [executionTime, setExecutionTime] = useState<number | null>(null)
  const [chartOpen, setChartOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('results')

  const executeMutation = useSqlExecute()

  // Auto-select the first database when the list first loads.
  useEffect(() => {
    if (!selectedDbId && databases.length > 0) {
      setSelectedDbId(databases[0].id)
    }
  }, [databases, selectedDbId])

  const handleRun = useCallback(() => {
    if (!sql.trim() || !selectedDbId || executeMutation.isPending) return
    const start = performance.now()
    executeMutation.mutate(
      { sql, databaseId: selectedDbId },
      {
        onSuccess: (data) => {
          setResult(data)
          setExecutionTime(Math.round(performance.now() - start))
          setActiveTab('results')
        },
        onError: (err) => {
          setResult({
            status: 'error',
            columns: [],
            data: [],
            rowCount: 0,
            error: err.message,
          })
          setExecutionTime(Math.round(performance.now() - start))
          setActiveTab('results')
        },
      },
    )
  }, [sql, selectedDbId, executeMutation])

  const handleInsertTable = useCallback((tableName: string) => {
    setSql((prev) => prev + (prev.endsWith(' ') ? '' : ' ') + tableName)
  }, [])

  const handleInsertColumn = useCallback((columnName: string) => {
    setSql((prev) => prev + (prev.endsWith(' ') ? '' : ' ') + columnName)
  }, [])

  const handleLoadQuery = useCallback((query: string) => {
    setSql(query)
    setActiveTab('results')
  }, [])

  const handleChartIt = useCallback(() => {
    if (result?.status === 'success' && result.data.length > 0) {
      setChartOpen(true)
    }
  }, [result])

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="px-6 pt-4 pb-3 shrink-0 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Data Explorer</h1>
        <div className="flex items-center gap-2">
          <Database className="size-4 text-muted-foreground" />
          <Select value={selectedDbId} onValueChange={setSelectedDbId}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Select database" />
            </SelectTrigger>
            <SelectContent>
              {databases.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No databases registered
                </div>
              ) : (
                databases.map((db) => (
                  <SelectItem key={db.id} value={db.id}>
                    {db.databaseName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* IDE layout: schema sidebar (left) + editor/results (right) */}
      <div className="flex-1 min-h-0 px-4 pb-4 flex gap-3">
        {/* LEFT: Schema Browser — fixed width sidebar */}
        <div className="w-64 shrink-0 rounded-lg border bg-card overflow-hidden">
          <SchemaBrowser
            onInsertTable={handleInsertTable}
            onInsertColumn={handleInsertColumn}
            selectedDbId={selectedDbId}
            onSelectedDbIdChange={setSelectedDbId}
          />
        </div>

        {/* RIGHT: Editor (top) + Results (bottom) — stacked vertically */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* SQL Editor — 40% height */}
          <div className="h-[40%] min-h-[200px] rounded-lg border bg-card overflow-hidden">
            <SqlEditor
              value={sql}
              onChange={setSql}
              onRun={handleRun}
              isRunning={executeMutation.isPending}
              disabled={!selectedDbId}
              disabledReason={!selectedDbId ? 'Select a database to run queries' : undefined}
            />
          </div>

          {/* Results / History — fills remaining 60% */}
          <div className="flex-1 min-h-0 rounded-lg border bg-card overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <div className="border-b bg-muted/40 px-4 shrink-0">
                <TabsList className="h-9 bg-transparent p-0 gap-0">
                  <TabsTrigger
                    value="results"
                    className="text-xs rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    Results
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="text-xs rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    History
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="results" className="flex-1 min-h-0 mt-0">
                <QueryResults
                  result={result}
                  isLoading={executeMutation.isPending}
                  executionTime={executionTime}
                  onChartIt={handleChartIt}
                  onSaveAsDataset={
                    result?.status === 'success'
                      ? () => setSaveDialogOpen(true)
                      : undefined
                  }
                />
              </TabsContent>
              <TabsContent value="history" className="flex-1 min-h-0 mt-0">
                <QueryHistory onLoadQuery={handleLoadQuery} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Chart Builder Dialog */}
      {result?.status === 'success' && result.data.length > 0 && (
        <ChartBuilderDialog
          open={chartOpen}
          onOpenChange={setChartOpen}
          result={result}
        />
      )}

      {/* Save as Dataset Dialog */}
      <SaveAsDatasetDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        sql={sql}
        databaseId={selectedDbId || null}
        columns={(result?.columns ?? []).map((c) => c.column_name ?? c.name)}
        rows={result?.data ?? []}
      />
    </div>
  )
}
