import { useState, useEffect, useMemo } from 'react'

import { toast } from 'sonner'
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
  STATUS_LABELS,
  StatusDot,
} from './data-source-card'

import type {
  DatabaseBackend,
  DatabaseInfo,
  DatabaseCreate,
  DatasetSummary,
  TestConnectionRequest,
} from '@/types/database'

type SheetMode = 'create' | 'edit' | 'detail'
type ConnectionTab = 'simple' | 'advanced'

interface DataSourceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: SheetMode
  databaseId: string | null
  onModeChange: (mode: SheetMode) => void
}

// ── Backend field configuration ──────────────────────────────

interface BackendFieldDef {
  name: string
  label: string
  placeholder: string
  type: 'text' | 'password' | 'number'
  required: boolean
  gridSpan?: 1 | 2
}

interface BackendFieldConfig {
  fields: BackendFieldDef[]
  defaultPort: number
}

const BACKEND_FIELDS: Record<DatabaseBackend, BackendFieldConfig> = {
  oracle: {
    defaultPort: 1521,
    fields: [
      { name: 'host', label: 'Host', placeholder: 'oracle-host.example.com', type: 'text', required: true, gridSpan: 2 },
      { name: 'port', label: 'Port', placeholder: '1521', type: 'number', required: true },
      { name: 'database', label: 'Service Name', placeholder: 'MYSERVICE', type: 'text', required: true },
      { name: 'schemaName', label: 'Schema', placeholder: 'RECON_OWNER', type: 'text', required: false },
      { name: 'username', label: 'Username', placeholder: 'recon_user', type: 'text', required: true },
      { name: 'password', label: 'Password', placeholder: '', type: 'password', required: true },
    ],
  },
  hive: {
    defaultPort: 10000,
    fields: [
      { name: 'host', label: 'Host', placeholder: 'hive-host.example.com', type: 'text', required: true, gridSpan: 2 },
      { name: 'port', label: 'Port', placeholder: '10000', type: 'number', required: true },
      { name: 'database', label: 'Database', placeholder: 'default', type: 'text', required: true },
      { name: 'username', label: 'Username', placeholder: 'hive_user', type: 'text', required: false },
      { name: 'password', label: 'Password', placeholder: '', type: 'password', required: false },
    ],
  },
  postgresql: {
    defaultPort: 5432,
    fields: [
      { name: 'host', label: 'Host', placeholder: 'pg-host.example.com', type: 'text', required: true, gridSpan: 2 },
      { name: 'port', label: 'Port', placeholder: '5432', type: 'number', required: true },
      { name: 'database', label: 'Database', placeholder: 'mydb', type: 'text', required: true },
      { name: 'username', label: 'Username', placeholder: 'db_user', type: 'text', required: true },
      { name: 'password', label: 'Password', placeholder: '', type: 'password', required: true },
    ],
  },
  elasticsearch: {
    defaultPort: 9200,
    fields: [],
  },
}

const BACKENDS: { value: DatabaseBackend; label: string; disabled?: boolean }[] = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'oracle', label: 'Oracle' },
  { value: 'hive', label: 'Hive' },
  { value: 'elasticsearch', label: 'Elasticsearch', disabled: true },
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
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [sqlalchemyUri, setSqlalchemyUri] = useState('')

  // Test connection state
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [hasPassedTest, setHasPassedTest] = useState(false)

  // Dataset expand state
  const [expandedDataset, setExpandedDataset] = useState<string | null>(null)

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

  const updateFormValue = (name: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  // Reset form when mode/database changes
  useEffect(() => {
    setTestResult(null)
    setHasPassedTest(false)
    setExpandedDataset(null)
    if (mode === 'create') {
      setBackend('postgresql')
      setDisplayName('')
      setConnectionTab('simple')
      setFormValues({ port: String(BACKEND_FIELDS.postgresql.defaultPort) })
      setSqlalchemyUri('')
    }
  }, [mode, databaseId, open])

  // Auto-fill port when backend changes in create/edit mode
  useEffect(() => {
    if (mode === 'create' || mode === 'edit') {
      setFormValues((prev) => ({
        ...prev,
        port: String(BACKEND_FIELDS[backend].defaultPort),
      }))
    }
  }, [backend, mode])

  // Reset hasPassedTest when connection params change
  useEffect(() => {
    setHasPassedTest(false)
  }, [formValues, backend, connectionTab, sqlalchemyUri])

  const handleTestConnection = () => {
    setTestResult(null)
    const payload: TestConnectionRequest =
      connectionTab === 'advanced'
        ? { backend, sqlalchemyUri }
        : {
            backend,
            host: formValues.host,
            port: formValues.port ? parseInt(formValues.port) : undefined,
            database: formValues.database,
            username: formValues.username,
            password: formValues.password,
            ...(mode === 'edit' && databaseId ? { databaseId } : {}),
          }
    testMutation.mutate(payload, {
      onSuccess: (res) => {
        setTestResult(res)
        if (res.success) setHasPassedTest(true)
      },
      onError: () => setTestResult({ success: false, message: 'Request failed' }),
    })
  }

  const handleSave = () => {
    const data: DatabaseCreate = {
      databaseName: displayName,
      backend,
      ...(connectionTab === 'advanced'
        ? { sqlalchemyUri }
        : {
            host: formValues.host,
            port: formValues.port ? parseInt(formValues.port) : undefined,
            database: formValues.database,
            schemaName: formValues.schemaName,
            username: formValues.username,
            password: formValues.password,
          }),
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
      onSuccess: () => toast.success('Datasets refreshed'),
      onError: () => toast.error('Failed to sync datasets'),
    })
  }

  const canSave = mode === 'create'
    ? !!(displayName.trim() && hasPassedTest)
    : !!(displayName.trim() && (
        connectionTab === 'advanced' ? sqlalchemyUri.trim() : formValues.host?.trim()
      ))
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
            formValues={formValues}
            onFormValueChange={updateFormValue}
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
  expandedDataset: string | null
  onToggleDataset: (id: string) => void
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
        <SheetTitle className="sr-only">Loading data source</SheetTitle>
        <SheetDescription className="sr-only">Loading data source details</SheetDescription>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const backendKey = database.backend

  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Database className={cn('size-5', BACKEND_COLORS[backendKey] ?? 'text-muted-foreground')} />
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-base truncate">{database.databaseName}</SheetTitle>
            <SheetDescription>
              {BACKEND_LABELS[backendKey] || database.backend}
              {database.createdOn && (
                <> &middot; Created {new Date(database.createdOn).toLocaleDateString()}</>
              )}
              {database.lastTested && (
                <> &middot; Last tested {new Date(database.lastTested).toLocaleString()}</>
              )}
            </SheetDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusDot status={database.status} />
            <span className="text-xs text-muted-foreground">{STATUS_LABELS[database.status]}</span>
          </div>
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
  formValues: Record<string, string>
  onFormValueChange: (name: string, value: string) => void
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
  formValues,
  onFormValueChange,
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
  const fields = BACKEND_FIELDS[backend].fields

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
                  disabled={b.disabled}
                  onClick={() => !b.disabled && onBackendChange(b.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors',
                    b.disabled
                      ? 'border-muted opacity-40 cursor-not-allowed'
                      : backend === b.value
                        ? 'border-primary bg-primary/5 cursor-pointer'
                        : 'border-muted hover:border-muted-foreground/30 cursor-pointer',
                  )}
                >
                  <Database
                    className={cn(
                      'size-5',
                      b.disabled
                        ? 'text-muted-foreground'
                        : backend === b.value
                          ? BACKEND_COLORS[b.value]
                          : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'text-[11px] font-medium',
                      b.disabled
                        ? 'text-muted-foreground'
                        : backend === b.value
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                    )}
                  >
                    {b.label}
                  </span>
                  {b.disabled && (
                    <span className="text-[9px] text-muted-foreground">Coming soon</span>
                  )}
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
              <div className="grid grid-cols-2 gap-3">
                {fields.map((field) => (
                  <div
                    key={field.name}
                    className={cn('space-y-1.5', field.gridSpan === 2 && 'col-span-2')}
                  >
                    <Label htmlFor={field.name} className="text-xs">
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </Label>
                    <Input
                      id={field.name}
                      type={field.type}
                      placeholder={
                        mode === 'edit' && field.type === 'password'
                          ? 'Leave blank to keep current'
                          : field.placeholder
                      }
                      value={formValues[field.name] ?? ''}
                      onChange={(e) => onFormValueChange(field.name, e.target.value)}
                    />
                  </div>
                ))}
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
