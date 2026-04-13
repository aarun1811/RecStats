import { Database } from 'lucide-react'
import { motion } from 'motion/react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  BACKEND_LABELS,
  BACKEND_COLORS,
  STATUS_BORDER_COLORS,
} from '@/lib/style-constants'
import type { DatabaseInfo } from '@/types/database'
import { AnimatedStatusBadge } from './animated-status-badge'

interface DataSourceCardProps {
  database: DatabaseInfo
  onClick: () => void
}

export function DataSourceCard({ database, onClick }: DataSourceCardProps) {
  const backendKey = database.backend

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <Card
        className={cn(
          'cursor-pointer transition-shadow hover:shadow-md p-4 border-l-2',
          STATUS_BORDER_COLORS[database.status],
        )}
        onClick={onClick}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="bg-muted rounded-lg p-1.5">
              <Database className={cn('size-8', BACKEND_COLORS[backendKey] || 'text-muted-foreground')} />
            </div>
            <AnimatedStatusBadge status={database.status} />
          </div>
          <div>
            <p className="text-sm font-medium truncate">{database.databaseName}</p>
            <p className="text-xs text-muted-foreground">
              {BACKEND_LABELS[backendKey] || database.backend}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
