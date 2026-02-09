import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardListPage,
})

function DashboardListPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboards</h1>
      <p className="text-muted-foreground">
        Select a dashboard to view reconciliation analytics.
      </p>
    </div>
  )
}
