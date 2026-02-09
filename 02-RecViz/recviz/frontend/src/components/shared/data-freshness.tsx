import { formatDistanceToNow } from 'date-fns'
import { RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DataFreshnessProps {
  lastUpdated: Date
  isRefreshing?: boolean
  onRefresh?: () => void
  className?: string
}

export function DataFreshness({
  lastUpdated,
  isRefreshing = false,
  onRefresh,
  className,
}: DataFreshnessProps) {
  const timeAgo = formatDistanceToNow(lastUpdated, { addSuffix: true })

  return (
    <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <span>Updated {timeAgo}</span>
      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={cn(
              'h-3 w-3',
              isRefreshing && 'animate-spin',
            )}
          />
          <span className="sr-only">Refresh</span>
        </Button>
      )}
    </div>
  )
}
