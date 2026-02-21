import { Database } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  oracle: 'text-red-500',
  postgresql: 'text-blue-500',
  hive: 'text-yellow-500',
  elasticsearch: 'text-green-500',
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

export { BACKEND_LABELS, BACKEND_COLORS, STATUS_STYLES, STATUS_LABELS }

export function DataSourceCard({ database, onClick }: DataSourceCardProps) {
  const backendKey = database.backend as DatabaseBackend

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 p-4"
      onClick={onClick}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <Database className={cn('size-8', BACKEND_COLORS[backendKey] || 'text-muted-foreground')} />
          <Badge variant="secondary" className={cn('text-[10px]', STATUS_STYLES[database.status])}>
            {STATUS_LABELS[database.status] || database.status}
          </Badge>
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
