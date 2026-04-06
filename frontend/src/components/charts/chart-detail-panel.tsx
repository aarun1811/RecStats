import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

interface ChartDetailPanelProps {
  chartId: string | null
  datasetName: string
  onClose: () => void
}

export function ChartDetailPanel({ chartId, datasetName, onClose }: ChartDetailPanelProps) {
  return (
    <Sheet open={chartId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle>Chart Details</SheetTitle>
          <SheetDescription>{datasetName}</SheetDescription>
        </SheetHeader>
        <div className="p-4 text-sm text-muted-foreground">
          Detail panel placeholder -- Task 2 fills this.
        </div>
      </SheetContent>
    </Sheet>
  )
}
