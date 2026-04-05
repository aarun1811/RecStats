import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ChartFullscreenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chartTitle: string
  children: ReactNode
  toolbarSlot?: ReactNode
}

/**
 * Fullscreen chart dialog. Renders a live chart component at large size inside
 * a Radix Dialog overlay. Cross-filter clicks and drill-down double-clicks
 * work inside fullscreen because the chart receives identical state props.
 *
 * onOpenAutoFocus is prevented to avoid focus trap interfering with chart
 * click events (per research Pitfall 6).
 */
export function ChartFullscreenDialog({
  open,
  onOpenChange,
  chartTitle,
  children,
  toolbarSlot,
}: ChartFullscreenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[90vw] max-h-[85vh] p-6 flex flex-col gap-4"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="relative">
          <DialogTitle>{chartTitle}</DialogTitle>
          {toolbarSlot && (
            <div className="absolute top-0 right-0">
              {toolbarSlot}
            </div>
          )}
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
