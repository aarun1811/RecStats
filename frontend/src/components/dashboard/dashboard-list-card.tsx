import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { BarChart3, Gauge, LayoutDashboard, Table2, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DashboardMiniMap } from './dashboard-mini-map'
import type { ManagedDashboard } from '@/types/managed-dashboard'

interface DashboardListCardProps {
  dashboard: ManagedDashboard
  onClick: () => void
  onDelete?: () => void
}

interface PanelCounts {
  kpis: number
  charts: number
  grids: number
}

function countPanels(config: unknown): PanelCounts {
  const cfg = (config ?? {}) as Record<string, unknown>
  const len = (key: string) =>
    Array.isArray(cfg[key]) ? (cfg[key] as unknown[]).length : 0
  return { kpis: len('kpis'), charts: len('charts'), grids: len('grids') }
}

export function DashboardListCard({
  dashboard,
  onClick,
  onDelete,
}: DashboardListCardProps) {
  const timeAgo = formatDistanceToNow(new Date(dashboard.updatedAt), {
    addSuffix: true,
  })

  const counts = useMemo(
    () => countPanels(dashboard.config),
    [dashboard.config],
  )
  const totalPanels = counts.kpis + counts.charts + counts.grids

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border bg-card',
        'cursor-pointer transition-all duration-200',
        'hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
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
      {/* Hero — layout silhouette */}
      <div className="relative h-[180px] overflow-hidden">
        <DashboardMiniMap config={dashboard.config as unknown as Record<string, unknown> | undefined} />

        {/* Bottom fade — masks the silhouette edge into the metadata strip */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />

        {/* Composition pill — top right. Per-type counts with matching builder
            icons (Gauge=KPI, BarChart3=chart, Table2=grid). Zero counts hidden.
            Empty dashboards fall back to a single LayoutDashboard glyph. */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm border border-border/50 tabular-nums">
          {totalPanels === 0 ? (
            <LayoutDashboard size={10} />
          ) : (
            <>
              {counts.kpis > 0 && (
                <span className="flex items-center gap-0.5">
                  <Gauge size={10} />
                  {counts.kpis}
                </span>
              )}
              {counts.charts > 0 && (
                <span className="flex items-center gap-0.5">
                  <BarChart3 size={10} />
                  {counts.charts}
                </span>
              )}
              {counts.grids > 0 && (
                <span className="flex items-center gap-0.5">
                  <Table2 size={10} />
                  {counts.grids}
                </span>
              )}
            </>
          )}
        </div>

        {/* Hover-revealed delete button — top left so it doesn't fight the pill */}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 left-2 z-10 size-7 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
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

      {/* Metadata — matches chart/KPI library cards.
          Subtitle row uses flex so the description shrinks/truncates first
          while the dot+timestamp stay pinned to the right. */}
      <div className="flex flex-col gap-0.5 px-3.5 py-3">
        <p className="text-sm font-semibold truncate leading-snug">{dashboard.name}</p>
        <div className="flex items-center text-[11px] text-muted-foreground min-w-0">
          <p className="truncate min-w-0">
            {dashboard.description || (
              <span className="italic text-muted-foreground/50">No description</span>
            )}
          </p>
          <span className="mx-1.5 opacity-40 shrink-0">&middot;</span>
          <span className="shrink-0">{timeAgo}</span>
        </div>
      </div>
    </div>
  )
}
