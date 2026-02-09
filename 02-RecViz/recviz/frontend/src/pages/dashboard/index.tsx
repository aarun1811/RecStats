import { useState, useEffect } from 'react'

import { ChartGrid } from '@/components/dashboard/chart-grid'
import { CrossFilterIndicator } from '@/components/dashboard/cross-filter-indicator'
import { DrillBreadcrumb } from '@/components/dashboard/drill-breadcrumb'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { KpiRow } from '@/components/dashboard/kpi-row'
import { MOCK_DASHBOARD_CONFIG } from '@/lib/mock/dashboard-config'
import { useFilterStore } from '@/stores/filter-store'
import type { ChartClickEvent } from '@/types/chart'

export default function DashboardPage() {
  const [kpiLoading, setKpiLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(true)

  const setCrossFilter = useFilterStore((s) => s.setCrossFilter)

  const config = MOCK_DASHBOARD_CONFIG

  // Simulate progressive loading: KPIs first, then charts
  useEffect(() => {
    const kpiTimer = setTimeout(() => setKpiLoading(false), 400)
    const chartTimer = setTimeout(() => setChartLoading(false), 900)
    return () => {
      clearTimeout(kpiTimer)
      clearTimeout(chartTimer)
    }
  }, [])

  function handleChartNodeClick(chartId: string, event: ChartClickEvent) {
    const rule = config.crossFilterRules.find(
      (r) => r.sourceChartId === chartId,
    )
    if (rule) {
      setCrossFilter(chartId, event.field, String(event.value))
    }
  }

  return (
    <div className="flex flex-col">
      <FilterBar />
      <div className="space-y-6 p-6">
        <CrossFilterIndicator />
        {/* Drill breadcrumbs — show for each chart that has drill state */}
        {config.charts.map((c) => (
          <DrillBreadcrumb key={c.id} chartId={c.id} />
        ))}
        <KpiRow loading={kpiLoading} />
        <ChartGrid
          config={config}
          loading={chartLoading}
          onChartNodeClick={handleChartNodeClick}
        />
      </div>
    </div>
  )
}
