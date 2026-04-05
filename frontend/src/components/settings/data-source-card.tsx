import { Database } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DatabaseInfo, ConnectionStatus, DatabaseBackend } from '@/types/database'

interface DataSourceCardProps {
  database: DatabaseInfo
  onClick: () => void
}

const BACKEND_LABELS: Record<DatabaseBackend, string> = {
  oracle: 'Oracle',
  postgresql: 'PostgreSQL',
  hive: 'Hive',
  elasticsearch: 'Elasticsearch',
}

const BACKEND_COLORS: Record<DatabaseBackend, string> = {
  oracle: 'text-red-600 dark:text-red-400',
  postgresql: 'text-blue-600 dark:text-blue-400',
  hive: 'text-yellow-600 dark:text-yellow-400',
  elasticsearch: 'text-green-600 dark:text-green-400',
}

const STATUS_STYLES: Record<ConnectionStatus, string> = {
  connected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  unreachable: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  untested: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  unreachable: 'Unreachable',
  untested: 'Untested',
}

const STATUS_DOT_COLORS: Record<ConnectionStatus, string> = {
  connected: 'bg-green-500',
  unreachable: 'bg-red-500',
  untested: 'bg-gray-400',
}

interface StatusDotProps {
  status: ConnectionStatus
}

export function StatusDot({ status }: StatusDotProps) {
  return (
    <span
      className={cn('inline-block size-2 rounded-full', STATUS_DOT_COLORS[status])}
      title={STATUS_LABELS[status]}
      aria-label={`Status: ${STATUS_LABELS[status]}`}
    />
  )
}

export { BACKEND_LABELS, BACKEND_COLORS, STATUS_STYLES, STATUS_LABELS, STATUS_DOT_COLORS }

export function DataSourceCard({ database, onClick }: DataSourceCardProps) {
  const backendKey = database.backend

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 p-4"
      onClick={onClick}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <Database className={cn('size-8', BACKEND_COLORS[backendKey] || 'text-muted-foreground')} />
          <div className="flex items-center gap-1.5">
            <StatusDot status={database.status} />
            <span className="text-[10px] text-muted-foreground">{STATUS_LABELS[database.status]}</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium truncate">{database.databaseName}</p>
          <p className="text-xs text-muted-foreground">
            {BACKEND_LABELS[backendKey] || database.backend} &middot; {database.datasetCount} tables
          </p>
        </div>
      </div>
    </Card>
  )
}
