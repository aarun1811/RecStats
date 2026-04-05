import { type ReactNode, useEffect, useRef, useState } from 'react'

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
 * Uses deferred rendering: children mount after the dialog is fully open so
 * AG Charts reads the correct container dimensions (not the pre-animation 0px).
 */
export function ChartFullscreenDialog({
  open,
  onOpenChange,
  chartTitle,
  children,
  toolbarSlot,
}: ChartFullscreenDialogProps) {
  // Defer chart rendering until dialog animation completes so AG Charts
  // reads the final container size, not the mid-animation 0px.
  const [ready, setReady] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (open) {
      timerRef.current = setTimeout(() => setReady(true), 150)
    } else {
      setReady(false)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[90vw] h-[85vh] p-6 flex flex-col gap-4"
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
          {ready ? children : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
