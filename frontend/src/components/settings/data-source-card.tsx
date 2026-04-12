import { Database } from 'lucide-react'
import { motion } from 'motion/react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DatabaseInfo, ConnectionStatus, DatabaseBackend } from '@/types/database'
import { AnimatedStatusBadge } from './animated-status-badge'

interface DataSourceCardProps {
  database: DatabaseInfo
  onClick: () => void
}

const BACKEND_LABELS: Record<DatabaseBackend, string> = {
  oracle: 'Oracle',
}

const BACKEND_COLORS: Record<DatabaseBackend, string> = {
  oracle: 'text-red-600 dark:text-red-400',
}

const STATUS_STYLES: Record<ConnectionStatus, string> = {
  connected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  unreachable: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  untested: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  unreachable: 'Unreachable',
  untested: 'Untested',
}

const STATUS_BORDER_COLORS: Record<ConnectionStatus, string> = {
  connected: 'border-l-emerald-500',
  unreachable: 'border-l-red-500',
  untested: 'border-l-amber-500',
}

export { BACKEND_LABELS, BACKEND_COLORS, STATUS_STYLES, STATUS_LABELS, STATUS_BORDER_COLORS }

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
