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
import { useChartReferences, useDeleteChart } from '@/hooks/use-managed-charts'
import type { RecvizChart } from '@/types/managed-chart'

interface DeleteChartDialogProps {
  chart: RecvizChart
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteChartDialog({
  chart,
  open,
  onOpenChange,
  onDeleted,
}: DeleteChartDialogProps) {
  const { data: refs, isLoading } = useChartReferences(open ? chart.id : null)
  const deleteChart = useDeleteChart()

  const canDelete = refs?.canDelete ?? true
  const referencingDashboards = refs?.referencingDashboards ?? []

  const handleDelete = () => {
    deleteChart.mutate(chart.id, {
      onSuccess: () => {
        toast.success('Chart deleted')
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
              <DialogTitle>Delete &ldquo;{chart.name}&rdquo;?</DialogTitle>
              <DialogDescription>
                This will permanently remove the chart from the library. Any
                dashboards using this chart will lose it. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={deleteChart.isPending}
              >
                Keep Chart
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteChart.isPending}
              >
                {deleteChart.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Chart'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                Cannot delete &ldquo;{chart.name}&rdquo;
              </DialogTitle>
              <DialogDescription>
                This chart is used in the following dashboards. Remove it from
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
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
