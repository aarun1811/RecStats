import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  BarChart3,
  Filter as FilterIcon,
  Gauge,
  Table2,
  Trash2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DashboardMiniMap } from './dashboard-mini-map'
import type { ManagedDashboard } from '@/types/managed-dashboard'

interface DashboardListCardProps {
  dashboard: ManagedDashboard
  onClick: () => void
  onDelete?: () => void
}

interface PanelStats {
  charts: number
  kpis: number
  grids: number
  filters: number
}

function countPanels(config: unknown): PanelStats {
  const cfg = (config ?? {}) as Record<string, unknown>
  const arr = (key: string) => (Array.isArray(cfg[key]) ? (cfg[key] as unknown[]).length : 0)
  return {
    charts: arr('charts'),
    kpis: arr('kpis'),
    grids: arr('grids'),
    filters: arr('filters'),
  }
}

export function DashboardListCard({
  dashboard,
  onClick,
  onDelete,
}: DashboardListCardProps) {
  const timeAgo = formatDistanceToNow(new Date(dashboard.updatedAt), {
    addSuffix: true,
  })

  const stats = useMemo(() => countPanels(dashboard.config), [dashboard.config])
  const totalPanels = stats.charts + stats.kpis + stats.grids

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border bg-card',
        'cursor-pointer transition-all duration-200',
        'hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
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
      {/* Blueprint hero — mini-map preview */}
      <div className="relative h-[180px] overflow-hidden bg-gradient-to-br from-background via-card to-muted/20">
        {/* Corner ticks — architectural blueprint marks */}
        <svg
          className="absolute inset-0 z-[1] h-full w-full text-primary/30"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* top-left */}
          <line x1="8" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1" />
          <line x1="8" y1="8" x2="8" y2="18" stroke="currentColor" strokeWidth="1" />
          {/* top-right */}
          <line x1="calc(100% - 8px)" y1="8" x2="calc(100% - 18px)" y2="8" stroke="currentColor" strokeWidth="1" />
          <line x1="calc(100% - 8px)" y1="8" x2="calc(100% - 8px)" y2="18" stroke="currentColor" strokeWidth="1" />
          {/* bottom-left */}
          <line x1="8" y1="calc(100% - 8px)" x2="18" y2="calc(100% - 8px)" stroke="currentColor" strokeWidth="1" />
          <line x1="8" y1="calc(100% - 8px)" x2="8" y2="calc(100% - 18px)" stroke="currentColor" strokeWidth="1" />
          {/* bottom-right */}
          <line
            x1="calc(100% - 8px)"
            y1="calc(100% - 8px)"
            x2="calc(100% - 18px)"
            y2="calc(100% - 8px)"
            stroke="currentColor"
            strokeWidth="1"
          />
          <line
            x1="calc(100% - 8px)"
            y1="calc(100% - 8px)"
            x2="calc(100% - 8px)"
            y2="calc(100% - 18px)"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>

        {/* Mini-map fills the hero */}
        <div className="absolute inset-4">
          <DashboardMiniMap config={dashboard.config} />
        </div>

        {/* Top-right panel count pill */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm border border-border/50">
          <span className="font-mono tabular-nums">{totalPanels}</span>
          <span>{totalPanels === 1 ? 'panel' : 'panels'}</span>
        </div>

        {/* Top-left "DSH" architectural label */}
        <div className="absolute top-2.5 left-2.5 z-10 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">
          DSH / {dashboard.id.slice(0, 6).toUpperCase()}
        </div>

        {/* Bottom fade — connects blueprint to metadata */}
        <div className="absolute inset-x-0 bottom-0 h-8 z-[2] bg-gradient-to-t from-card via-card/60 to-transparent" />
      </div>

      {/* Metadata section */}
      <div className="relative flex flex-col gap-2 px-3.5 py-3">
        {/* Title + description */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate leading-snug">
              {dashboard.name}
            </p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {dashboard.description || 'No description'}
            </p>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
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

        {/* Stats row + time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground/80">
            <StatPill icon={BarChart3} count={stats.charts} label="charts" />
            <StatPill icon={Gauge} count={stats.kpis} label="KPIs" />
            <StatPill icon={Table2} count={stats.grids} label="grids" />
            <StatPill icon={FilterIcon} count={stats.filters} label="filters" />
          </div>
          <p className="text-[10px] text-muted-foreground/70 shrink-0">
            {timeAgo}
          </p>
        </div>
      </div>
    </div>
  )
}

interface StatPillProps {
  icon: React.ComponentType<{ className?: string }>
  count: number
  label: string
}

function StatPill({ icon: Icon, count, label }: StatPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono tabular-nums',
        count > 0 ? 'text-foreground/70' : 'text-muted-foreground/30',
      )}
      title={`${count} ${label}`}
    >
      <Icon className="size-2.5" />
      {count}
    </span>
  )
}
