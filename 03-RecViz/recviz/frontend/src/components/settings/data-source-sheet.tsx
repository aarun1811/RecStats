import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import {
  useDatabase,
  useDatabaseDatasets,
  useCreateDatabase,
  useUpdateDatabase,
  useDeleteDatabase,
  useTestConnection,
  useSyncDatasets,
} from '@/hooks/use-databases'
import {
  BACKEND_LABELS,
  BACKEND_COLORS,
  STATUS_STYLES,
  STATUS_LABELS,
} from './data-source-card'
import type {
  DatabaseBackend,
  DatabaseInfo,
  DatabaseCreate,
  DatasetSummary,
} from '@/types/database'

type SheetMode = 'create' | 'edit' | 'detail'
type ConnectionTab = 'simple' | 'advanced'

interface DataSourceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: SheetMode
  databaseId: number | null
  onModeChange: (mode: SheetMode) => void
}

const BACKENDS: { value: DatabaseBackend; label: string; defaultPort: number }[] = [
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'oracle', label: 'Oracle', defaultPort: 1521 },
  { value: 'hive', label: 'Hive', defaultPort: 10000 },
  { value: 'elasticsearch', label: 'Elasticsearch', defaultPort: 9200 },
]

export function DataSourceSheet({
  open,
  onOpenChange,
  mode,
  databaseId,
  onModeChange,
}: DataSourceSheetProps) {
  // Form state
  const [backend, setBackend] = useState<DatabaseBackend>('postgresql')
  const [displayName, setDisplayName] = useState('')
  const [connectionTab, setConnectionTab] = useState<ConnectionTab>('simple')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [database, setDatabase] = useState('')
  const [schemaName, setSchemaName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [sqlalchemyUri, setSqlalchemyUri] = useState('')

  // Test connection state
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Dataset expand state
  const [expandedDataset, setExpandedDataset] = useState<number | null>(null)

  // Queries and mutations
  const { data: databaseDetail } = useDatabase(mode === 'detail' || mode === 'edit' ? databaseId : null)
  const {
    data: datasetsPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: datasetsLoading,
  } = useDatabaseDatasets(mode === 'detail' ? databaseId : null)

  const createMutation = useCreateDatabase()
  const updateMutation = useUpdateDatabase()
  const deleteMutation = useDeleteDatabase()
  const testMutation = useTestConnection()
  const syncMutation = useSyncDatasets()

  // Flatten paginated datasets
  const allDatasets = useMemo(
    () => datasetsPages?.pages.flatMap((p) => p.datasets) ?? [],
    [datasetsPages],
  )
  const totalDatasets = datasetsPages?.pages[0]?.total ?? 0

  // Reset form when mode/database changes
  useEffect(() => {
    setTestResult(null)
    setExpandedDataset(null)
    if (mode === 'create') {
      setBackend('postgresql')
      setDisplayName('')
      setConnectionTab('simple')
      setHost('')
      setPort('5432')
      setDatabase('')
      setSchemaName('')
      setUsername('')
      setPassword('')
      setSqlalchemyUri('')
    }
  }, [mode, databaseId, open])

  // Auto-fill port when backend changes in create/edit mode
  useEffect(() => {
    if (mode === 'create' || mode === 'edit') {
      const backendConfig = BACKENDS.find((b) => b.value === backend)
      if (backendConfig) {
        setPort(String(backendConfig.defaultPort))
      }
    }
  }, [backend, mode])

  const handleTestConnection = () => {
    setTestResult(null)
    const payload =
      connectionTab === 'advanced'
        ? { backend, sqlalchemyUri }
        : { backend, host, port: port ? parseInt(port) : undefined, database, username, password }
    testMutation.mutate(payload, {
      onSuccess: (res) => setTestResult(res),
      onError: () => setTestResult({ success: false, message: 'Request failed' }),
    })
  }

  const handleSave = () => {
    const data: DatabaseCreate = {
      databaseName: displayName,
      backend,
      ...(connectionTab === 'advanced'
        ? { sqlalchemyUri }
        : { host, port: port ? parseInt(port) : undefined, database, schemaName, username, password }),
    }

    if (mode === 'create') {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success(`Created "${displayName}"`)
          onOpenChange(false)
        },
        onError: () => toast.error('Failed to create data source'),
      })
    } else if (mode === 'edit' && databaseId) {
      updateMutation.mutate(
        { id: databaseId, data },
        {
          onSuccess: () => {
            toast.success(`Updated "${displayName}"`)
            onModeChange('detail')
          },
          onError: () => toast.error('Failed to update data source'),
        },
      )
    }
  }

  const handleDelete = () => {
    if (!databaseId || !databaseDetail) return
    if (!window.confirm(`Delete "${databaseDetail.databaseName}"? This cannot be undone.`)) return
    deleteMutation.mutate(databaseId, {
      onSuccess: () => {
        toast.success(`Deleted "${databaseDetail.databaseName}"`)
        onOpenChange(false)
      },
      onError: () => toast.error('Failed to delete data source'),
    })
  }

  const handleSync = () => {
    if (!databaseId) return
    syncMutation.mutate(databaseId, {
      onSuccess: (res) => toast.success(`Synced ${res.datasetCount} datasets`),
      onError: () => toast.error('Failed to sync datasets'),
    })
  }

  const canSave = !!(displayName.trim() && (connectionTab === 'advanced' ? sqlalchemyUri.trim() : host.trim()))
  const isSaving = createMutation.isPending || updateMutation.isPending

  // ── Render ──────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[540px] sm:max-w-[540px] p-0 flex flex-col">
        {mode === 'detail' ? (
          <DetailView
            database={databaseDetail}
            datasets={allDatasets}
            totalDatasets={totalDatasets}
            datasetsLoading={datasetsLoading}
            expandedDataset={expandedDataset}
            onToggleDataset={(id) => setExpandedDataset(expandedDataset === id ? null : id)}
            hasNextPage={hasNextPage ?? false}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
            onEdit={() => onModeChange('edit')}
            onDelete={handleDelete}
            onTestConnection={handleTestConnection}
            testMutation={testMutation}
            testResult={testResult}
            onSync={handleSync}
            syncMutation={syncMutation}
            isDeleting={deleteMutation.isPending}
          />
        ) : (
          <FormView
            mode={mode}
            backend={backend}
            onBackendChange={setBackend}
            displayName={displayName}
            onDisplayNameChange={setDisplayName}
            connectionTab={connectionTab}
            onConnectionTabChange={setConnectionTab}
            host={host}
            onHostChange={setHost}
            port={port}
            onPortChange={setPort}
            database={database}
            onDatabaseChange={setDatabase}
            schemaName={schemaName}
            onSchemaNameChange={setSchemaName}
            username={username}
            onUsernameChange={setUsername}
            password={password}
            onPasswordChange={setPassword}
            sqlalchemyUri={sqlalchemyUri}
            onSqlalchemyUriChange={setSqlalchemyUri}
            onTestConnection={handleTestConnection}
            testMutation={testMutation}
            testResult={testResult}
            canSave={canSave}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={() => {
              if (mode === 'edit') {
                onModeChange('detail')
              } else {
                onOpenChange(false)
              }
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Detail View ──────────────────────────────────────────────

interface DetailViewProps {
  database: DatabaseInfo | undefined
  datasets: DatasetSummary[]
  totalDatasets: number
  datasetsLoading: boolean
  expandedDataset: number | null
  onToggleDataset: (id: number) => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  onEdit: () => void
  onDelete: () => void
  onTestConnection: () => void
  testMutation: ReturnType<typeof useTestConnection>
  testResult: { success: boolean; message: string } | null
  onSync: () => void
  syncMutation: ReturnType<typeof useSyncDatasets>
  isDeleting: boolean
}

function DetailView({
  database,
  datasets,
  totalDatasets,
  datasetsLoading,
  expandedDataset,
  onToggleDataset,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onEdit,
  onDelete,
  onTestConnection,
  testMutation,
  testResult,
  onSync,
  syncMutation,
  isDeleting,
}: DetailViewProps) {
  if (!database) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const backendKey = database.backend as DatabaseBackend

  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Database className={cn('size-5', BACKEND_COLORS[backendKey])} />
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-base truncate">{database.databaseName}</SheetTitle>
            <SheetDescription>
              {BACKEND_LABELS[backendKey] || database.backend}
              {database.createdOn && (
                <> &middot; Created {new Date(database.createdOn).toLocaleDateString()}</>
              )}
            </SheetDescription>
          </div>
          <Badge variant="secondary" className={cn('text-[10px] shrink-0', STATUS_STYLES[database.status])}>
            {STATUS_LABELS[database.status]}
          </Badge>
        </div>
      </SheetHeader>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Datasets Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">
                Datasets{' '}
                <span className="text-muted-foreground font-normal">
                  ({datasets.length} of {totalDatasets})
                </span>
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onSync}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className={cn('mr-1 size-3', syncMutation.isPending && 'animate-spin')} />
                Sync
              </Button>
            </div>

            {datasetsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No datasets found. Click Sync to refresh.
              </p>
            ) : (
              <div className="space-y-1">
                {datasets.map((ds) => (
                  <div key={ds.id}>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                      onClick={() => onToggleDataset(ds.id)}
                    >
                      {expandedDataset === ds.id ? (
                        <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-mono text-xs truncate flex-1 text-left">
                        {ds.tableName}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {ds.columnCount} cols
                      </span>
                    </button>
                    {expandedDataset === ds.id && (
                      <div className="ml-6 pl-2 border-l text-xs text-muted-foreground py-1">
                        <p className="italic">Column details loaded on demand</p>
                      </div>
                    )}
                  </div>
                ))}
                {hasNextPage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-muted-foreground"
                    onClick={onLoadMore}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : null}
                    Load more...
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Test Connection */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onTestConnection}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              Test Connection
            </Button>
            {testResult && (
              <div className="flex items-center gap-1.5 text-xs">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">{testResult.message}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-3.5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">{testResult.message}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="border-t p-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-1.5 size-3.5" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="mr-1.5 size-3.5" />
          Delete
        </Button>
      </div>
    </>
  )
}

// ── Form View (Create / Edit) ────────────────────────────────

interface FormViewProps {
  mode: 'create' | 'edit'
  backend: DatabaseBackend
  onBackendChange: (b: DatabaseBackend) => void
  displayName: string
  onDisplayNameChange: (v: string) => void
  connectionTab: ConnectionTab
  onConnectionTabChange: (t: ConnectionTab) => void
  host: string
  onHostChange: (v: string) => void
  port: string
  onPortChange: (v: string) => void
  database: string
  onDatabaseChange: (v: string) => void
  schemaName: string
  onSchemaNameChange: (v: string) => void
  username: string
  onUsernameChange: (v: string) => void
  password: string
  onPasswordChange: (v: string) => void
  sqlalchemyUri: string
  onSqlalchemyUriChange: (v: string) => void
  onTestConnection: () => void
  testMutation: ReturnType<typeof useTestConnection>
  testResult: { success: boolean; message: string } | null
  canSave: boolean
  isSaving: boolean
  onSave: () => void
  onCancel: () => void
}

function FormView({
  mode,
  backend,
  onBackendChange,
  displayName,
  onDisplayNameChange,
  connectionTab,
  onConnectionTabChange,
  host,
  onHostChange,
  port,
  onPortChange,
  database,
  onDatabaseChange,
  schemaName,
  onSchemaNameChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  sqlalchemyUri,
  onSqlalchemyUriChange,
  onTestConnection,
  testMutation,
  testResult,
  canSave,
  isSaving,
  onSave,
  onCancel,
}: FormViewProps) {
  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle className="text-base">
          {mode === 'create' ? 'Add Data Source' : 'Edit Data Source'}
        </SheetTitle>
        <SheetDescription>
          {mode === 'create'
            ? 'Configure a new database connection'
            : 'Update connection details'}
        </SheetDescription>
      </SheetHeader>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Database Type */}
          <div className="space-y-2">
            <Label>Database Type</Label>
            <div className="grid grid-cols-4 gap-2">
              {BACKENDS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => onBackendChange(b.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors cursor-pointer',
                    backend === b.value
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30',
                  )}
                >
                  <Database
                    className={cn(
                      'size-5',
                      backend === b.value
                        ? BACKEND_COLORS[b.value]
                        : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'text-[11px] font-medium',
                      backend === b.value ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {b.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              placeholder="e.g. recon_data_prod"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
            />
          </div>

          <Separator />

          {/* Connection Tab Toggle */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Connection</Label>
              <div className="flex gap-1 ml-auto">
                <Button
                  variant={connectionTab === 'simple' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onConnectionTabChange('simple')}
                >
                  Simple
                </Button>
                <Button
                  variant={connectionTab === 'advanced' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onConnectionTabChange('advanced')}
                >
                  Advanced
                </Button>
              </div>
            </div>

            {connectionTab === 'simple' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="host" className="text-xs">Host</Label>
                    <Input
                      id="host"
                      placeholder="db-host.example.com"
                      value={host}
                      onChange={(e) => onHostChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="port" className="text-xs">Port</Label>
                    <Input
                      id="port"
                      placeholder="5432"
                      value={port}
                      onChange={(e) => onPortChange(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="database" className="text-xs">Database</Label>
                    <Input
                      id="database"
                      placeholder="mydb"
                      value={database}
                      onChange={(e) => onDatabaseChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="schema" className="text-xs">Schema</Label>
                    <Input
                      id="schema"
                      placeholder="public"
                      value={schemaName}
                      onChange={(e) => onSchemaNameChange(e.target.value)}
                    />
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-xs">Username</Label>
                    <Input
                      id="username"
                      placeholder="db_user"
                      value={username}
                      onChange={(e) => onUsernameChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => onPasswordChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="uri" className="text-xs">SQLAlchemy URI</Label>
                <Textarea
                  id="uri"
                  placeholder="postgresql://user:pass@host:5432/dbname"
                  className="font-mono text-xs min-h-[80px]"
                  value={sqlalchemyUri}
                  onChange={(e) => onSqlalchemyUriChange(e.target.value)}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Test Connection */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onTestConnection}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              Test Connection
            </Button>
            {testResult && (
              <div className="flex items-center gap-1.5 text-xs">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">{testResult.message}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-3.5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">{testResult.message}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-4 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={!canSave || isSaving}>
          {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          {mode === 'create' ? 'Save' : 'Update'}
        </Button>
      </div>
    </>
  )
}
