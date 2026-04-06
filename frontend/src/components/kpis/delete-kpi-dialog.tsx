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
import { Skeleton } from '@/components/ui/skeleton'
import { useKpiReferences, useDeleteKpi } from '@/hooks/use-managed-kpis'

interface DeleteKpiDialogProps {
  kpiId: string | null
  kpiName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteKpiDialog({
  kpiId,
  kpiName,
  open,
  onOpenChange,
  onDeleted,
}: DeleteKpiDialogProps) {
  const { data: refs, isLoading } = useKpiReferences(open ? kpiId : null)
  const deleteKpi = useDeleteKpi()

  const canDelete = refs?.canDelete ?? true
  const referencingDashboards = refs?.referencingDashboards ?? []

  const handleDelete = () => {
    if (!kpiId) return
    deleteKpi.mutate(kpiId, {
      onSuccess: () => {
        toast.success('KPI deleted')
        onDeleted()
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {isLoading ? (
          <div className="flex flex-col gap-3 py-6">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : canDelete ? (
          <>
            <DialogHeader>
              <DialogTitle>Delete &ldquo;{kpiName}&rdquo;?</DialogTitle>
              <DialogDescription>
                This will permanently delete &lsquo;{kpiName}&rsquo;. Any
                dashboards using this KPI will lose it. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={deleteKpi.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteKpi.isPending}
              >
                {deleteKpi.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                Cannot delete &ldquo;{kpiName}&rdquo;
              </DialogTitle>
              <DialogDescription>
                This KPI is used in the following dashboards. Remove it from
                those dashboards first:
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-1 px-1 py-2">
              {referencingDashboards.map((dashboard) => (
                <li
                  key={dashboard.id}
                  className="text-sm text-muted-foreground"
                >
                  &bull; {dashboard.name}
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Keep KPI
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
