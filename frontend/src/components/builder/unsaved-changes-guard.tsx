import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface UnsavedChangesGuardProps {
  isDirty: boolean
  onConfirmLeave: () => void
  onCancelLeave: () => void
  open: boolean
}

export function UnsavedChangesGuard({
  isDirty,
  onConfirmLeave,
  onCancelLeave,
  open,
}: UnsavedChangesGuardProps) {
  // Browser tab close guard
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancelLeave() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. Leave without saving?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancelLeave}>
            Keep Editing
          </Button>
          <Button variant="destructive" onClick={onConfirmLeave}>
            Leave Without Saving
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
