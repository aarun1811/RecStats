import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/$dashboardId')({
  component: DashboardPage,
})

function DashboardPage() {
  const { dashboardId } = Route.useParams()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Dashboard: {dashboardId}
      </h1>
      <p className="text-muted-foreground">
        Dashboard content will be rendered here by Agent 03.
      </p>
    </div>
  )
}
