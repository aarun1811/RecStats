import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useDatasetReferences } from '@/hooks/use-managed-datasets'

interface DeleteDatasetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  datasetId: string
  datasetName: string
  onConfirmDelete: () => void
  isDeleting?: boolean
}

export function DeleteDatasetDialog({
  open,
  onOpenChange,
  datasetId,
  datasetName,
  onConfirmDelete,
  isDeleting = false,
}: DeleteDatasetDialogProps) {
  const { data: refs, isLoading } = useDatasetReferences(open ? datasetId : null)

  const canDelete = refs?.canDelete ?? true
  const referencingCharts = refs?.referencingCharts ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : canDelete ? (
          <>
            <DialogHeader>
              <DialogTitle>Delete &ldquo;{datasetName}&rdquo;?</DialogTitle>
              <DialogDescription>
                This will permanently remove the dataset and its column metadata. This cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
                Keep Dataset
              </Button>
              <Button variant="destructive" onClick={onConfirmDelete} disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Dataset'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Cannot delete &ldquo;{datasetName}&rdquo;</DialogTitle>
              <DialogDescription>
                This dataset is referenced by the following charts. Remove chart references first:
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-1 px-1 py-2">
              {referencingCharts.map((chart) => (
                <li key={chart.id} className="text-sm text-muted-foreground">
                  &bull; {chart.name}
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
