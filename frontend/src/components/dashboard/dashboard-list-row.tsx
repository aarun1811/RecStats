import { ChevronRight, LayoutDashboard, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ManagedDashboard } from '@/types/managed-dashboard'

interface DashboardListRowProps {
  dashboard: ManagedDashboard
  onClick: () => void
  onDelete?: () => void
}

export function DashboardListRow({ dashboard, onClick, onDelete }: DashboardListRowProps) {
  const timeAgo = formatDistanceToNow(new Date(dashboard.updatedAt), {
    addSuffix: true,
  })

  return (
    <div
      className={cn(
        'group flex items-center gap-4 rounded-lg border px-4 py-3',
        'cursor-pointer transition-all duration-150',
        'hover:border-primary/20 hover:bg-muted/30',
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
      <div className="flex items-center justify-center size-9 rounded-md bg-muted/50 shrink-0">
        <LayoutDashboard className="size-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate leading-snug">
          {dashboard.name}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {dashboard.description || 'No description'}
        </p>
      </div>

      <div className="shrink-0 w-28 text-right">
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>

      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
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
