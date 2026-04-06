import { GripVertical, Pencil, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { BuilderItem } from '@/types/builder'

interface BuilderPanelProps {
  item: BuilderItem
  onEdit: (itemId: string) => void
  onRemove: (itemId: string) => void
  children: React.ReactNode
  /** Optional wrapper for the edit button (e.g. PanelConfigPopover trigger) */
  editButtonWrapper?: (button: React.ReactNode) => React.ReactNode
}

export function BuilderPanel({ item, onEdit, onRemove, children, editButtonWrapper }: BuilderPanelProps) {
  const title =
    item.chart?.title ?? item.kpi?.title ?? item.grid?.title ?? 'Untitled'

  return (
    <TooltipProvider delayDuration={300}>
      <div className="group relative flex h-full flex-col rounded-lg border bg-card transition-all hover:ring-2 hover:ring-primary/20">
        <div className="drag-handle flex cursor-grab items-center justify-between border-b px-3 py-2 active:cursor-grabbing">
          <div className="flex items-center gap-2">
            <GripVertical className="size-4 text-muted-foreground" />
            <span className="flex-1 truncate text-sm font-medium">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {editButtonWrapper ? (
              editButtonWrapper(
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
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
                </Tooltip>,
              )
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
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
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:text-destructive"
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
        <div className="flex-1 overflow-hidden px-3 pb-2">
          {children}
        </div>
      </div>
    </TooltipProvider>
  )
}
