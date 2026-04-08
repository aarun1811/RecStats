import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDeleteDashboard } from '@/hooks/use-managed-dashboards'
import type { ManagedDashboard } from '@/types/managed-dashboard'

interface DeleteDashboardDialogProps {
  dashboard: ManagedDashboard | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteDashboardDialog({
  dashboard,
  open,
  onOpenChange,
  onDeleted,
}: DeleteDashboardDialogProps) {
  const deleteDashboard = useDeleteDashboard()

  const handleDelete = () => {
    if (!dashboard) return
    deleteDashboard.mutate(dashboard.id, {
      onSuccess: () => {
        toast.success('Dashboard deleted')
        onOpenChange(false)
        onDeleted?.()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{dashboard?.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            This will permanently remove the dashboard. Charts and KPIs in the
            library will not be affected. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteDashboard.isPending}
          >
            Keep Dashboard
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteDashboard.isPending}
          >
            {deleteDashboard.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Dashboard'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
