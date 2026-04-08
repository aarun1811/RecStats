import { useMemo } from 'react'
import {
  BarChart3,
  ChevronRight,
  Filter as FilterIcon,
  Gauge,
  LayoutDashboard,
  Table2,
  Trash2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ManagedDashboard } from '@/types/managed-dashboard'

interface DashboardListRowProps {
  dashboard: ManagedDashboard
  onClick: () => void
  onDelete?: () => void
}

function countPanels(config: unknown) {
  const cfg = (config ?? {}) as Record<string, unknown>
  const arr = (key: string) => (Array.isArray(cfg[key]) ? (cfg[key] as unknown[]).length : 0)
  return {
    charts: arr('charts'),
    kpis: arr('kpis'),
    grids: arr('grids'),
    filters: arr('filters'),
  }
}

export function DashboardListRow({ dashboard, onClick, onDelete }: DashboardListRowProps) {
  const timeAgo = formatDistanceToNow(new Date(dashboard.updatedAt), {
    addSuffix: true,
  })
  const stats = useMemo(() => countPanels(dashboard.config), [dashboard.config])

  return (
    <div
      className={cn(
        'group flex items-center gap-4 rounded-lg border bg-card px-4 py-3',
        'cursor-pointer transition-all duration-150',
        'hover:border-primary/30 hover:shadow-sm hover:shadow-primary/5',
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
      {/* Icon with subtle accent */}
      <div className="relative flex items-center justify-center size-9 rounded-md bg-primary/5 border border-primary/10 shrink-0">
        <LayoutDashboard className="size-4 text-primary/70" />
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate leading-snug">
          {dashboard.name}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {dashboard.description || 'No description'}
        </p>
      </div>

      {/* Stats — hidden on narrow widths */}
      <div className="hidden lg:flex items-center gap-3 shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground">
        <span
          className={cn(
            'inline-flex items-center gap-1',
            stats.charts > 0 ? 'text-foreground/70' : 'text-muted-foreground/30',
          )}
          title={`${stats.charts} charts`}
        >
          <BarChart3 className="size-3" />
          {stats.charts}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1',
            stats.kpis > 0 ? 'text-foreground/70' : 'text-muted-foreground/30',
          )}
          title={`${stats.kpis} KPIs`}
        >
          <Gauge className="size-3" />
          {stats.kpis}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1',
            stats.grids > 0 ? 'text-foreground/70' : 'text-muted-foreground/30',
          )}
          title={`${stats.grids} grids`}
        >
          <Table2 className="size-3" />
          {stats.grids}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1',
            stats.filters > 0 ? 'text-foreground/70' : 'text-muted-foreground/30',
          )}
          title={`${stats.filters} filters`}
        >
          <FilterIcon className="size-3" />
          {stats.filters}
        </span>
      </div>

      {/* Time */}
      <div className="shrink-0 w-28 text-right">
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>

      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="Delete dashboard"
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}

      <ChevronRight
        size={14}
        className="shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
      />
    </div>
  )
}
