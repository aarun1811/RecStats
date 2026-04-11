import { ChevronRight, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DatabaseInfo } from '@/types/database'
import { BACKEND_LABELS, BACKEND_COLORS, STATUS_LABELS, StatusDot } from './data-source-card'

interface DataSourceRowProps {
  database: DatabaseInfo
  onClick: () => void
}

export function DataSourceRow({ database, onClick }: DataSourceRowProps) {
  const backendKey = database.backend

  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      <Database className={cn('size-5 shrink-0', BACKEND_COLORS[backendKey] || 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{database.databaseName}</p>
        <p className="text-xs text-muted-foreground">
          {BACKEND_LABELS[backendKey] || database.backend}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <StatusDot status={database.status} />
        <span className="text-[10px] text-muted-foreground">{STATUS_LABELS[database.status]}</span>
      </div>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </div>
  )
}
