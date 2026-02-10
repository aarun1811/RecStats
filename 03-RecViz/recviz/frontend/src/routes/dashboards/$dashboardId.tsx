import { createFileRoute } from '@tanstack/react-router'
import { useDashboards } from '@/hooks/use-dashboards'
import { usePrefetch } from '@/hooks/use-prefetch'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { KpiRow } from '@/components/dashboard/kpi-row'

export const Route = createFileRoute('/dashboards/$dashboardId')({
  component: DashboardDetail,
})

function DashboardDetail() {
  const { dashboardId } = Route.useParams()
  const { data: dashboards } = useDashboards()

  usePrefetch()

  const dashboard = dashboards?.find(
    (d) => d.id === dashboardId || d.slug === dashboardId,
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {dashboard?.title ?? `Dashboard: ${dashboardId}`}
      </h1>

      <FilterBar />
      <KpiRow />

      <p className="text-muted-foreground">
        Chart grid coming in Phase 14.
      </p>
    </div>
  )
}
