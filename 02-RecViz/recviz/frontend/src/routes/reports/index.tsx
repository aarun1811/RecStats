import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/reports/')({
  component: ReportsPage,
})

function ReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <p className="text-muted-foreground">
        Scheduled and on-demand report exports will appear here.
      </p>
    </div>
  )
}
