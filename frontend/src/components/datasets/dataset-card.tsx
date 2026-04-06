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
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 px-4 py-3"
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
      <div className="flex items-start gap-3">
        <Database className={cn('size-5 mt-0.5 shrink-0', iconColor)} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{dataset.name}</p>
            {dataset.syncStatus !== 'synced' && (
              <Badge
                variant="outline"
                className="text-[10px] shrink-0 border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              >
                {dataset.syncStatus === 'error' ? 'Sync Error' : 'Unsynced'}
              </Badge>
            )}
          </div>
          {dataset.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {dataset.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{databaseName ?? backendType ?? 'Database'}</span>
            <span>&middot;</span>
            <span>{dataset.columns.length} columns</span>
            <span>&middot;</span>
            <span>{formatDistanceToNow(new Date(dataset.updatedAt), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
