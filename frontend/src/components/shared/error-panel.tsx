import { useState } from 'react'

import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorPanelProps {
  message: string
  detail?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}

export function ErrorPanel({ message, detail, onRetry, className, compact = false }: ErrorPanelProps) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center',
        compact && 'gap-1 p-2',
        className,
      )}
    >
      <AlertCircle className={cn('text-destructive', compact ? 'h-4 w-4' : 'h-6 w-6')} />
      <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        {message}
      </p>
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        )}
        {detail && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetail(!showDetail)}
          >
            Details
            {showDetail ? (
              <ChevronUp className="ml-1 h-3 w-3" />
            ) : (
              <ChevronDown className="ml-1 h-3 w-3" />
            )}
          </Button>
        )}
      </div>
      {showDetail && detail && (
        <pre className="mt-2 max-h-32 w-full overflow-auto rounded bg-muted p-2 text-left font-mono text-xs text-muted-foreground">
          {detail}
        </pre>
      )}
    </div>
  )
}
