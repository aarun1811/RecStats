import { createFileRoute } from '@tanstack/react-router'
import { useDashboards } from '@/hooks/use-dashboards'
import { usePrefetch } from '@/hooks/use-prefetch'
import { useFilterStore } from '@/stores/filter-store'
import { useDrillStore } from '@/stores/drill-store'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { KpiRow } from '@/components/dashboard/kpi-row'
import { ChartGrid } from '@/components/dashboard/chart-grid'
import { CrossFilterBar } from '@/components/dashboard/cross-filter-bar'
import { DrillBreadcrumb } from '@/components/dashboard/drill-breadcrumb'
import { DataGrid } from '@/components/grid/data-grid'
import type { ChartClickEvent } from '@/types/chart'

export const Route = createFileRoute('/_app/dashboards/$dashboardId')({
  component: DashboardDetail,
})

function DashboardDetail() {
  const { dashboardId } = Route.useParams()
  const { data: dashboards } = useDashboards()
  const addCrossFilter = useFilterStore((s) => s.addCrossFilter)
  const drillLevels = useDrillStore((s) => s.levels)
  const drillUp = useDrillStore((s) => s.drillUp)
  const drillToLevel = useDrillStore((s) => s.drillToLevel)
  const resetDrill = useDrillStore((s) => s.resetDrill)

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

  const isDetailMode = drillLevels.length >= 3

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {dashboard?.title ?? `Dashboard: ${dashboardId}`}
      </h1>

      <FilterBar />
      <KpiRow />
      <CrossFilterBar />

      {/* At level 3+, charts hide and grid shows detail records.
          The breadcrumb stays visible so the user can navigate back. */}
      {isDetailMode && (
        <DrillBreadcrumb
          levels={drillLevels}
          onNavigate={drillToLevel}
          onBack={drillUp}
          onReset={resetDrill}
        />
      )}

      <ChartGrid onChartClick={handleChartClick} />
      <DataGrid />
    </div>
  )
}
