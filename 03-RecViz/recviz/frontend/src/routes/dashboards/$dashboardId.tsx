import { createFileRoute } from '@tanstack/react-router'
import { useDashboards } from '@/hooks/use-dashboards'
import { usePrefetch } from '@/hooks/use-prefetch'
import { useFilterStore } from '@/stores/filter-store'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { KpiRow } from '@/components/dashboard/kpi-row'
import { ChartGrid } from '@/components/dashboard/chart-grid'
import type { ChartClickEvent } from '@/types/chart'

export const Route = createFileRoute('/dashboards/$dashboardId')({
  component: DashboardDetail,
})

function DashboardDetail() {
  const { dashboardId } = Route.useParams()
  const { data: dashboards } = useDashboards()
  const addCrossFilter = useFilterStore((s) => s.addCrossFilter)

  usePrefetch()

  const dashboard = dashboards?.find(
    (d) => d.id === dashboardId || d.slug === dashboardId,
  )

  const handleChartClick = (event: ChartClickEvent) => {
    addCrossFilter({
      sourceChartId: event.chartId,
      column: event.column,
      value: event.value,
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {dashboard?.title ?? `Dashboard: ${dashboardId}`}
      </h1>

      <FilterBar />
      <KpiRow />
      <ChartGrid onChartClick={handleChartClick} />
    </div>
  )
}
