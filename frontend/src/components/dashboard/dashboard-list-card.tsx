import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DashboardSignature } from './dashboard-signature'
import type { ManagedDashboard } from '@/types/managed-dashboard'

interface DashboardListCardProps {
  dashboard: ManagedDashboard
  onClick: () => void
  onDelete?: () => void
}

function countTotalPanels(config: unknown): number {
  const cfg = (config ?? {}) as Record<string, unknown>
  const len = (key: string) =>
    Array.isArray(cfg[key]) ? (cfg[key] as unknown[]).length : 0
  return len('charts') + len('kpis') + len('grids')
}

export function DashboardListCard({
  dashboard,
  onClick,
  onDelete,
}: DashboardListCardProps) {
  const timeAgo = formatDistanceToNow(new Date(dashboard.updatedAt), {
    addSuffix: true,
  })

  const totalPanels = useMemo(
    () => countTotalPanels(dashboard.config),
    [dashboard.config],
  )

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card',
        'cursor-pointer transition-all duration-300 ease-out',
        'hover:-translate-y-1 hover:border-primary/30',
        'hover:shadow-[0_20px_50px_-20px_hsl(var(--primary)/0.2)]',
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
      {/* Hero — flowing signature art, unique per dashboard */}
      <div className="relative h-[180px] overflow-hidden bg-gradient-to-br from-background via-card to-background">
        <DashboardSignature id={dashboard.id} />

        {/* Bottom fade — subtle, only the last 8 pixels */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />

        {/* Panel count — minimal top-right */}
        <div className="absolute top-4 right-4 z-10 flex items-baseline gap-1 text-muted-foreground">
          <span className="text-[12px] font-semibold tabular-nums tracking-tight text-foreground">
            {totalPanels}
          </span>
          <span className="text-[10px] font-medium lowercase tracking-wide">
            {totalPanels === 1 ? 'panel' : 'panels'}
          </span>
        </div>
      </div>

      {/* Metadata — generous spacing, refined typography */}
      <div className="relative flex flex-col gap-1.5 px-5 pb-5 pt-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex-1 text-[15px] font-semibold tracking-tight text-foreground truncate leading-tight">
            {dashboard.name}
          </h3>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 -mr-1.5 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              title="Delete dashboard"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>

        <p className="text-[12px] text-muted-foreground/80 line-clamp-2 leading-relaxed min-h-[32px]">
          {dashboard.description || (
            <span className="italic text-muted-foreground/40">
              No description
            </span>
          )}
        </p>

        {/* Footer — divider + timestamp */}
        <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
            updated
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            {timeAgo}
          </p>
        </div>
      </div>
    </div>
  )
}
