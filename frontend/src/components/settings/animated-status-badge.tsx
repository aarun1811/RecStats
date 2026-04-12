import { motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConnectionStatus } from '@/types/database'

interface AnimatedStatusBadgeProps {
  status: ConnectionStatus
  size?: 'default' | 'large'
}

const STATUS_BADGE_STYLES: Record<ConnectionStatus, string> = {
  connected: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  unreachable: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  untested: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
}

const STATUS_DOT_COLORS: Record<ConnectionStatus, string> = {
  connected: 'bg-emerald-500',
  unreachable: 'bg-red-500',
  untested: 'bg-amber-500',
}

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  unreachable: 'Unreachable',
  untested: 'Untested',
}

export function AnimatedStatusBadge({ status, size = 'default' }: AnimatedStatusBadgeProps) {
  const isConnected = status === 'connected'
  const sizeClasses = size === 'large' ? 'h-6 text-xs' : 'h-5 text-[10px]'

  return (
    <Badge
      variant="ghost"
      className={cn(
        'rounded-full px-2 font-medium gap-1.5 border-transparent',
        sizeClasses,
        STATUS_BADGE_STYLES[status],
      )}
    >
      {isConnected ? (
        <motion.span
          className={cn('size-1.5 rounded-full', STATUS_DOT_COLORS[status])}
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <span className={cn('size-1.5 rounded-full', STATUS_DOT_COLORS[status])} />
      )}
      {STATUS_TEXT[status]}
    </Badge>
  )
}
