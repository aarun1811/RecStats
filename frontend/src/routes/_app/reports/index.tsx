import { createFileRoute } from '@tanstack/react-router'
import { FileBarChart } from 'lucide-react'

export const Route = createFileRoute('/_app/reports/')({
  component: Reports,
})

function Reports() {
  return (
    <div className="flex flex-col items-center justify-center py-20 p-6">
      <FileBarChart className="size-16 mb-4 text-muted-foreground/40" />
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Reports</h1>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Scheduled exports and on-demand report generation are coming soon.
        This feature will include PDF and Excel exports with configurable schedules.
      </p>
    </div>
  )
}
