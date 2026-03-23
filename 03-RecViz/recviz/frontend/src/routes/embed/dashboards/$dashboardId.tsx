import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/embed/dashboards/$dashboardId')({
  component: EmbedDashboardPage,
})

function EmbedDashboardPage() {
  const { dashboardId } = Route.useParams()
  return <div>Embed placeholder: {dashboardId}</div>
}
