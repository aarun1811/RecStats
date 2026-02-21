import { ChevronRight, Database } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DatabaseInfo, DatabaseBackend } from '@/types/database'
import { BACKEND_LABELS, BACKEND_COLORS, STATUS_STYLES, STATUS_LABELS } from './data-source-card'

interface DataSourceRowProps {
  database: DatabaseInfo
  onClick: () => void
}

export function DataSourceRow({ database, onClick }: DataSourceRowProps) {
  const backendKey = database.backend as DatabaseBackend

  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      <Database className={cn('size-5 shrink-0', BACKEND_COLORS[backendKey] || 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{database.databaseName}</p>
        <p className="text-xs text-muted-foreground">
          {BACKEND_LABELS[backendKey] || database.backend} &middot; {database.datasetCount} tables
        </p>
      </div>
      <Badge variant="secondary" className={cn('text-[10px] shrink-0', STATUS_STYLES[database.status])}>
        {STATUS_LABELS[database.status] || database.status}
      </Badge>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </div>
  )
}
