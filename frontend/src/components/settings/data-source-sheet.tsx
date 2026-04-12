import { useState, useEffect, useMemo } from 'react'

import { toast } from 'sonner'
import {
  Database,
  Loader2,
  RefreshCw,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Plug,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

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
import { useManagedDataset } from '@/hooks/use-managed-datasets'
import { Badge } from '@/components/ui/badge'

import {
  BACKEND_LABELS,
  BACKEND_COLORS,
} from './data-source-card'
import { AnimatedStatusBadge } from './animated-status-badge'
import { ConnectionTestArea } from './connection-test-area'
import { ConnectionHealthHeader } from './connection-health-header'

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
}

const BACKENDS: { value: DatabaseBackend; label: string; disabled?: boolean }[] = [
  { value: 'oracle', label: 'Oracle' },
]

export function DataSourceSheet({
  open,
  onOpenChange,
  mode,
  databaseId,
  onModeChange,
}: DataSourceSheetProps) {
  // Form state
  const [backend, setBackend] = useState<DatabaseBackend>('oracle')
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
      setBackend('oracle')
      setDisplayName('')
      setConnectionTab('simple')
      setFormValues({ port: String(BACKEND_FIELDS.oracle.defaultPort) })
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

  const handleTestDetailConnection = () => {
    if (!databaseDetail) return
    setTestResult(null)
    const payload: TestConnectionRequest = {
      backend: databaseDetail.backend,
      databaseId: databaseDetail.id,
    }
    testMutation.mutate(payload, {
      onSuccess: (res) => {
        setTestResult(res)
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
        <AnimatePresence mode="wait">
          {mode === 'detail' ? (
            <motion.div
              key="detail"
              className="flex flex-col flex-1 min-h-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
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
                onTestConnection={handleTestDetailConnection}
                testMutation={testMutation}
                testResult={testResult}
                onSync={handleSync}
                syncMutation={syncMutation}
                isDeleting={deleteMutation.isPending}
              />
            </motion.div>
          ) : (
            <motion.div
              key={mode}
              className="flex flex-col flex-1 min-h-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>
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
      {/* ── Fixed Header ── */}
      <SheetHeader className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Database className={cn('size-5', BACKEND_COLORS[backendKey] ?? 'text-muted-foreground')} />
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-base font-semibold truncate">{database.databaseName}</SheetTitle>
            <SheetDescription className="text-xs">
              {BACKEND_LABELS[backendKey] || database.backend}
              {database.createdOn && (
                <> &middot; {new Date(database.createdOn).toLocaleDateString()}</>
              )}
            </SheetDescription>
          </div>
          <AnimatedStatusBadge status={database.status} />
        </div>
      </SheetHeader>

      {/* ── Fixed Health Summary ── */}
      <motion.div
        className="px-6 py-4 border-b bg-muted/30 shrink-0"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <ConnectionHealthHeader database={database} />
      </motion.div>

      {/* ── Datasets Header (fixed) ── */}
      <div className="px-6 pt-4 pb-2 flex items-center justify-between shrink-0">
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
          Sync Datasets
        </Button>
      </div>

      {/* ── Scrollable Datasets List (only this scrolls) ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 pb-4">
          {datasetsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : datasets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No datasets found. Click Sync Datasets to refresh.
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
                    <ExpandedDatasetColumns datasetId={ds.id} />
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
      </ScrollArea>

      {/* ── Sticky Footer — Unified Action Bar ── */}
      <div className="border-t shrink-0">
        {/* Test result banner — slides in above the action bar when result arrives */}
        <AnimatePresence>
          {testResult && !testMutation.isPending && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className={cn(
                'px-5 py-2.5 text-xs font-medium flex items-center gap-2 border-b',
                testResult.success
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
              )}>
                {testResult.success ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <CheckCircle2 className="size-3.5" />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ x: [0, -3, 3, -3, 3, 0] }}
                    transition={{ duration: 0.4 }}
                  >
                    <XCircle className="size-3.5" />
                  </motion.div>
                )}
                {testResult.message}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action bar — all actions on one row */}
        <div className="px-5 py-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onTestConnection}
            disabled={testMutation.isPending}
            className="shrink-0"
          >
            {testMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Plug className="mr-1.5 size-3.5" />
                Test Connection
              </>
            )}
          </Button>

          <div className="flex-1" />

          <Button
            variant="default"
            size="sm"
            onClick={onEdit}
          >
            <Pencil className="mr-1.5 size-3.5" />
            Edit Source
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
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
  const [flashingFields, setFlashingFields] = useState<Set<string>>(new Set())

  const handleRequiredBlur = (fieldName: string, value: string, isRequired: boolean) => {
    if (!isRequired || value.trim()) return
    setFlashingFields((prev) => {
      const next = new Set(prev)
      next.add(fieldName)
      return next
    })
    setTimeout(() => {
      setFlashingFields((prev) => {
        const next = new Set(prev)
        next.delete(fieldName)
        return next
      })
    }, 300)
  }

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
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0 * 0.05 }}
          >
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
          </motion.div>

          {/* Display Name */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 1 * 0.05 }}
          >
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              placeholder="e.g. recon_data_prod"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              onBlur={() => handleRequiredBlur('displayName', displayName, true)}
              className={cn(flashingFields.has('displayName') && 'border-destructive/50')}
            />
          </div>
          </motion.div>

          <Separator />

          {/* Connection Tab Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 2 * 0.05 }}
          >
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
                      onBlur={() => handleRequiredBlur(field.name, formValues[field.name] ?? '', field.required)}
                      className={cn(flashingFields.has(field.name) && 'border-destructive/50')}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="uri" className="text-xs">SQLAlchemy URI</Label>
                <Textarea
                  id="uri"
                  placeholder="oracle+oracledb://user:pass@host:1521/?service_name=SID"
                  className="font-mono text-xs min-h-[80px]"
                  value={sqlalchemyUri}
                  onChange={(e) => onSqlalchemyUriChange(e.target.value)}
                />
              </div>
            )}
          </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 3 * 0.05 }}
          >
            <Separator />
          </motion.div>

          {/* Test Connection */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 4 * 0.05 }}
          >
            <ConnectionTestArea
              onTest={onTestConnection}
              isPending={testMutation.isPending}
              result={testResult}
            />
          </motion.div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-4 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Discard
        </Button>
        <Button size="sm" onClick={onSave} disabled={!canSave || isSaving}>
          {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          {mode === 'create' ? 'Save Connection' : 'Update'}
        </Button>
      </div>
    </>
  )
}

// ── Expanded dataset column list ─────────────────────────────

interface ExpandedDatasetColumnsProps {
  datasetId: string
}

/**
 * Renders the column list for a single managed dataset when its row in the
 * DetailView is expanded. Lazily fetches the full dataset (including its
 * ``columns`` array) via ``useManagedDataset``, so the parent list query
 * doesn't have to carry every dataset's full metadata up front.
 */
function ExpandedDatasetColumns({ datasetId }: ExpandedDatasetColumnsProps) {
  const { data: dataset, isLoading, error } = useManagedDataset(datasetId)

  if (isLoading) {
    return (
      <div className="ml-6 pl-2 border-l py-1 space-y-1">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    )
  }

  if (error || !dataset) {
    return (
      <div className="ml-6 pl-2 border-l text-[11px] text-destructive py-1">
        Failed to load columns
      </div>
    )
  }

  if (dataset.columns.length === 0) {
    return (
      <div className="ml-6 pl-2 border-l text-[11px] text-muted-foreground py-1 italic">
        No columns
      </div>
    )
  }

  return (
    <div className="ml-6 pl-2 border-l py-1 space-y-0.5">
      {dataset.columns.map((col) => (
        <div
          key={col.name}
          className="flex items-center gap-2 text-xs text-muted-foreground"
          title={`${col.displayName || col.name} — ${col.dataType} (${col.role})`}
        >
          <span className="font-mono truncate flex-1">{col.name}</span>
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-3.5 shrink-0 font-mono"
          >
            {col.dataType}
          </Badge>
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">
            {col.role}
          </span>
        </div>
      ))}
    </div>
  )
}
