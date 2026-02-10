import { createFileRoute } from '@tanstack/react-router'
import { useKpiData } from '@/hooks/use-kpi-data'
import { usePrefetch } from '@/hooks/use-prefetch'

export const Route = createFileRoute('/dashboards/$dashboardId')({
  component: DashboardDetail,
})

function DashboardDetail() {
  const { dashboardId } = Route.useParams()
  const { data: kpi, isLoading } = useKpiData()

  usePrefetch()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        Dashboard: {dashboardId}
      </h1>

      {isLoading ? (
        <p className="text-muted-foreground">Loading KPIs...</p>
      ) : kpi ? (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg border p-4 text-center">
            <div className="text-sm text-muted-foreground">Total Breaks</div>
            <div className="text-2xl font-bold">{kpi.totalBreaks.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-sm text-muted-foreground">Resolution Rate</div>
            <div className="text-2xl font-bold">{kpi.resolutionRate}%</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-sm text-muted-foreground">Match Rate</div>
            <div className="text-2xl font-bold">{kpi.matchRate}%</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-sm text-muted-foreground">SLA Breaches</div>
            <div className="text-2xl font-bold">{kpi.slaBreaches.toLocaleString()}</div>
          </div>
        </div>
      ) : null}

      <p className="text-muted-foreground">Chart grid will be built in Phase 11.</p>
    </div>
  )
}
