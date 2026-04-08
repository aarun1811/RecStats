import { BarChart3, Gauge, GripVertical, Pencil, Table2, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { BuilderItem, BuilderItemType } from '@/types/builder'

interface BuilderPanelProps {
  item: BuilderItem
  onEdit: (itemId: string) => void
  onRemove: (itemId: string) => void
  children: React.ReactNode
  /** Optional wrapper for the edit button (e.g. PanelConfigPopover trigger) */
  editButtonWrapper?: (button: React.ReactNode) => React.ReactNode
}

const TYPE_META: Record<
  BuilderItemType,
  { icon: LucideIcon; label: string; accent: string }
> = {
  chart: { icon: BarChart3, label: 'CHART', accent: 'text-primary/70' },
  kpi: { icon: Gauge, label: 'KPI', accent: 'text-primary' },
  grid: { icon: Table2, label: 'GRID', accent: 'text-muted-foreground' },
}

export function BuilderPanel({
  item,
  onEdit,
  onRemove,
  children,
  editButtonWrapper,
}: BuilderPanelProps) {
  const title =
    item.chart?.title ?? item.kpi?.title ?? item.grid?.title ?? 'Untitled'
  const meta = TYPE_META[item.type]
  const Icon = meta.icon

  const editButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(item.id)
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        Edit Panel Settings
      </TooltipContent>
    </Tooltip>
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'group relative flex h-full flex-col overflow-hidden rounded-lg border bg-card',
          'transition-all duration-200',
          'hover:border-primary/30 hover:shadow-md hover:shadow-primary/5',
        )}
      >
        {/* Header — distinctive with type icon + mono label + title */}
        <div className="drag-handle relative flex cursor-grab items-center gap-2.5 border-b bg-card px-3 py-2 active:cursor-grabbing">
          {/* Grip — subtle, appears on hover */}
          <GripVertical className="size-3.5 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground/70" />

          {/* Type badge */}
          <div className="flex items-center gap-1.5">
            <Icon className={cn('size-3.5', meta.accent)} />
            <span
              className={cn(
                'font-mono text-[9px] uppercase tracking-[0.15em]',
                meta.accent,
              )}
            >
              {meta.label}
            </span>
          </div>

          {/* Vertical separator */}
          <div className="h-3 w-px bg-border/70" />

          {/* Title */}
          <span className="flex-1 truncate text-sm font-medium text-foreground">
            {title}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-0.5">
            {editButtonWrapper ? editButtonWrapper(editButton) : editButton}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(item.id)
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Remove from Dashboard
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-3">{children}</div>
      </div>
    </TooltipProvider>
  )
}
