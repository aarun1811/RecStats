import { useMemo } from 'react'
import { Database } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'motion/react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  BACKEND_COLORS,
  BACKEND_BORDER_COLORS,
  COLUMN_ROLE_STYLES,
  COLUMN_ROLE_SHORT_LABELS,
} from '@/lib/style-constants'
import type { RecvizDataset } from '@/types/managed-dataset'
import type { ColumnRole } from '@/types/managed-dataset'
import type { DatabaseBackend } from '@/types/database'

interface DatasetCardProps {
  dataset: RecvizDataset
  databaseName?: string
  backendType?: string
  onClick: () => void
  index: number
}

export function DatasetCard({ dataset, databaseName, backendType, onClick, index }: DatasetCardProps) {
  const backendKey = (backendType ?? 'oracle') as DatabaseBackend
  const iconColor = BACKEND_COLORS[backendKey] ?? 'text-muted-foreground'

  const roleCounts = useMemo(() => {
    const counts: Partial<Record<ColumnRole, number>> = {}
    for (const col of dataset.columns) {
      counts[col.role] = (counts[col.role] ?? 0) + 1
    }
    return counts
  }, [dataset.columns])

  const nonNoneRoles = Object.entries(roleCounts).filter(([role]) => role !== 'none')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
    >
      <Card
        className={cn(
          'cursor-pointer transition-shadow hover:shadow-md p-4 border-l-2',
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
            <div className="bg-muted rounded-lg p-1.5">
              <Database className={cn('size-8', iconColor)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {databaseName ?? backendType ?? 'Database'}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {nonNoneRoles.length > 0 ? (
              <div className="flex items-center gap-1 flex-wrap">
                {nonNoneRoles.map(([role, count]) => (
                  <span
                    key={role}
                    className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                      COLUMN_ROLE_STYLES[role as ColumnRole],
                    )}
                  >
                    {count} {(count as number) > 1 ? COLUMN_ROLE_SHORT_LABELS[role as ColumnRole].plural : COLUMN_ROLE_SHORT_LABELS[role as ColumnRole].singular}
                  </span>
                ))}
              </div>
            ) : (
              <span>{dataset.columns.length} columns</span>
            )}
            <span>{formatDistanceToNow(new Date(dataset.updatedAt), { addSuffix: true })}</span>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
