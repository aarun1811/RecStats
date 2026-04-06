import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/dashboards/$dashboardId/edit')({
  component: EditDashboardPage,
})

function EditDashboardPage() {
  const { dashboardId } = Route.useParams()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Edit Dashboard: {dashboardId}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Builder canvas will be added in Plan 03.
      </p>
    </div>
  )
}

export default EditDashboardPage
