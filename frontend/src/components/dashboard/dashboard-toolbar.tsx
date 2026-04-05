import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AutoRefreshControl } from '@/components/dashboard/auto-refresh-control'

interface DashboardToolbarProps {
  onRefresh: () => void
  isRefreshing: boolean
  autoRefreshIntervalMs: number
  onAutoRefreshIntervalChange: (intervalMs: number) => void
  autoRefreshRemainingMs: number
  autoRefreshIsActive: boolean
}

export function DashboardToolbar({
  onRefresh,
  isRefreshing,
  autoRefreshIntervalMs,
  onAutoRefreshIntervalChange,
  autoRefreshRemainingMs,
  autoRefreshIsActive,
}: DashboardToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={isRefreshing ? 'Refreshing...' : 'Refresh all dashboard data'}
              aria-busy={isRefreshing}
            >
              <RefreshCw
                className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isRefreshing ? 'Refreshing...' : 'Refresh all dashboard data'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <AutoRefreshControl
        intervalMs={autoRefreshIntervalMs}
        onIntervalChange={onAutoRefreshIntervalChange}
        remainingMs={autoRefreshRemainingMs}
        isActive={autoRefreshIsActive}
      />
    </div>
  )
}
