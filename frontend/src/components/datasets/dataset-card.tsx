import { Database } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Card } from '@/components/ui/card'
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
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{dataset.name}</p>
            {dataset.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {dataset.description}
              </p>
            )}
          </div>
          <Database className={cn('size-8 shrink-0 ml-3', iconColor)} />
        </div>
        <p className="text-xs text-muted-foreground">
          {databaseName ?? backendType ?? 'Database'}
          {dataset.syncStatus !== 'synced' && (
            <span className="text-amber-600 dark:text-amber-400 ml-2">
              &middot; {dataset.syncStatus === 'error' ? 'Sync Error' : 'Unsynced'}
            </span>
          )}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{dataset.columns.length} columns</span>
          <span>{formatDistanceToNow(new Date(dataset.updatedAt), { addSuffix: true })}</span>
        </div>
      </div>
    </Card>
  )
}
