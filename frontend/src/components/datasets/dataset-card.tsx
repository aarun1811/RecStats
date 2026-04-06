import { Database } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { BACKEND_COLORS } from '@/components/settings/data-source-card'
import type { RecvizDataset } from '@/types/managed-dataset'
import type { DatabaseBackend } from '@/types/database'

interface DatasetCardProps {
  dataset: RecvizDataset
  databaseName?: string
  backendType?: string
  onClick: () => void
}

export function DatasetCard({ dataset, databaseName, backendType, onClick }: DatasetCardProps) {
  const backendKey = (backendType ?? 'postgresql') as DatabaseBackend
  const iconColor = BACKEND_COLORS[backendKey] ?? 'text-muted-foreground'

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 p-4"
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
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <Database className={cn('size-8', iconColor)} />
          {dataset.syncStatus !== 'synced' && (
            <Badge
              variant="outline"
              className="text-[10px] border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            >
              {dataset.syncStatus === 'error' ? 'Sync Error' : 'Unsynced'}
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold truncate">{dataset.name}</p>
          {dataset.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {dataset.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {databaseName ?? backendType ?? 'Database'} &middot; {dataset.columns.length} columns
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(dataset.updatedAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Card>
  )
}
