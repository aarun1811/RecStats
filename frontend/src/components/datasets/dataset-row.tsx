import { useMemo } from 'react'
import { ChevronRight, Database } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'motion/react'

import { cn } from '@/lib/utils'
import {
  BACKEND_COLORS,
  BACKEND_BORDER_COLORS,
  COLUMN_ROLE_SHORT_LABELS,
} from '@/lib/style-constants'
import type { RecvizDataset } from '@/types/managed-dataset'
import type { ColumnRole } from '@/types/managed-dataset'
import type { DatabaseBackend } from '@/types/database'

interface DatasetRowProps {
  dataset: RecvizDataset
  databaseName?: string
  backendType?: string
  onClick: () => void
  index: number
}

export function DatasetRow({ dataset, databaseName, backendType, onClick, index }: DatasetRowProps) {
  const backendKey = (backendType ?? 'oracle') as DatabaseBackend
  const iconColor = BACKEND_COLORS[backendKey] ?? 'text-muted-foreground'

  const roleSummary = useMemo(() => {
    const counts: Partial<Record<ColumnRole, number>> = {}
    for (const col of dataset.columns) {
      counts[col.role] = (counts[col.role] ?? 0) + 1
    }
    const parts: string[] = []
    for (const [role, count] of Object.entries(counts)) {
      if (role !== 'none' && count) {
        parts.push(`${count} ${count > 1 ? COLUMN_ROLE_SHORT_LABELS[role as ColumnRole].plural : COLUMN_ROLE_SHORT_LABELS[role as ColumnRole].singular}`)
      }
    }
    return parts.length > 0 ? parts.join(' \u00b7 ') : `${dataset.columns.length} cols`
  }, [dataset.columns])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2, ease: 'easeOut' }}
      whileHover={{ y: -1 }}
    >
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-l-2 p-3 cursor-pointer transition-colors hover:bg-muted/50',
          BACKEND_BORDER_COLORS[backendKey] ?? 'border-l-muted',
        )}
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
        <div className="bg-muted rounded-md p-1">
          <Database className={cn('size-5', iconColor)} />
        </div>
        <div className="flex items-baseline gap-2 flex-1 min-w-0">
          <p className="text-sm font-semibold truncate shrink-0">{dataset.name}</p>
          {dataset.description && (
            <p className="text-xs text-muted-foreground truncate">
              {dataset.description}
            </p>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {databaseName ?? backendType ?? 'Database'} &middot; {roleSummary}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(dataset.updatedAt), { addSuffix: true })}
        </span>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
      </div>
    </motion.div>
  )
}
