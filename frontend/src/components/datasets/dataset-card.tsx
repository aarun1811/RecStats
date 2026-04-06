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
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <Database className={cn('size-8', iconColor)} />
          {dataset.syncStatus !== 'synced' && (
            <div className="flex items-center gap-1.5">
              <span className={cn('inline-block size-2 rounded-full', dataset.syncStatus === 'error' ? 'bg-amber-500' : 'bg-gray-400')} />
              <span className="text-[10px] text-muted-foreground">
                {dataset.syncStatus === 'error' ? 'Sync Error' : 'Unsynced'}
              </span>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium truncate">{dataset.name}</p>
          {dataset.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {dataset.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {databaseName ?? backendType ?? 'Database'} &middot; {dataset.columns.length} columns &middot; {formatDistanceToNow(new Date(dataset.updatedAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </Card>
  )
}
