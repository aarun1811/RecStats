import { ChevronRight, Database } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { cn } from '@/lib/utils'
import { BACKEND_COLORS } from '@/components/settings/data-source-card'
import type { RecvizDataset } from '@/types/managed-dataset'
import type { DatabaseBackend } from '@/types/database'

interface DatasetRowProps {
  dataset: RecvizDataset
  databaseName?: string
  backendType?: string
  onClick: () => void
}

export function DatasetRow({ dataset, databaseName, backendType, onClick }: DatasetRowProps) {
  const backendKey = (backendType ?? 'postgresql') as DatabaseBackend
  const iconColor = BACKEND_COLORS[backendKey] ?? 'text-muted-foreground'

  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50"
      onClick={onClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <Database className={cn('size-5 shrink-0', iconColor)} />
      <div className="flex items-baseline gap-2 flex-1 min-w-0">
        <p className="text-sm font-semibold truncate shrink-0">{dataset.name}</p>
        {dataset.description && (
          <p className="text-xs text-muted-foreground truncate">
            {dataset.description}
          </p>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {databaseName ?? backendType ?? 'Database'} &middot; {dataset.columns.length} cols
      </span>
      <span className="text-xs text-muted-foreground shrink-0">
        {formatDistanceToNow(new Date(dataset.updatedAt), { addSuffix: true })}
      </span>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </div>
  )
}
