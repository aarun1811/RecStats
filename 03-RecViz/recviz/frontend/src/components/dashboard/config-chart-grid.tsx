import { useMemo } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartFactory } from '@/components/charts/chart-factory'
import { useDataSourceQuery } from '@/hooks/use-data-source-query'
import { useFilterStore } from '@/stores/filter-store'
import type { DashboardChartConfig, KpiResult } from '@/types/dashboard-config'
import type { ChartConfig, ChartDataResponse } from '@/types/chart'

interface ConfigChartGridProps {
  charts: DashboardChartConfig[]
  kpiResults?: KpiResult[]
}

/** Builds a ChartDataResponse from KPI results for a kpi_values chart (e.g. donut). */
function buildKpiChartData(
  chart: DashboardChartConfig,
  kpiResults: KpiResult[],
): ChartDataResponse {
  const segments = chart.kpiSegments ?? []
  return {
    chartId: chart.id,
    columns: ['category', 'value'],
    data: segments.map((seg) => ({
      category: seg.label,
      value: kpiResults.find((k) => k.id === seg.kpiId)?.value ?? 0,
    })),
    rowCount: segments.length,
  }
}

/** Converts a DashboardChartConfig to the ChartConfig shape expected by ChartPanel / ChartFactory. */
function toChartConfig(chart: DashboardChartConfig): ChartConfig {
  return {
    id: chart.id,
    name: chart.title,
    vizType: chart.type,
    datasourceId: 0, // config-driven charts don't use Superset datasource IDs
  }
}

/**
 * Renders a single chart whose data comes from a backend data-source query.
 * Uses its own `useDataSourceQuery` hook so each chart fetches independently.
 */
function QueryChartItem({ chart }: { chart: DashboardChartConfig }) {
  const appliedFilters = useFilterStore((s) => s.applied)

  // For query-sourced charts, the first source's dataSourceId drives the query.
  const dataSourceId = chart.sources?.[0]?.dataSourceId ?? ''
  const { data: queryResponse, isLoading } = useDataSourceQuery(
    dataSourceId,
    appliedFilters,
    !!dataSourceId,
  )

  const chartData: ChartDataResponse | undefined = useMemo(() => {
    if (!queryResponse) return undefined
    return {
      chartId: chart.id,
      columns: queryResponse.columns,
      data: queryResponse.rows,
      rowCount: queryResponse.rowCount,
    }
  }, [queryResponse, chart.id])

  const config = useMemo(() => toChartConfig(chart), [chart])

  if (isLoading) {
    return <ChartItemSkeleton title={chart.title} />
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-3 pb-3">
        <ChartFactory
          chartId={chart.id}
          config={config}
          data={chartData}
          isLoading={isLoading}
        />
      </CardContent>
    </Card>
  )
}

/**
 * Renders a single chart whose data is derived from already-fetched KPI results.
 * No additional network call required.
 */
function KpiValuesChartItem({
  chart,
  kpiResults,
}: {
  chart: DashboardChartConfig
  kpiResults: KpiResult[]
}) {
  const chartData = useMemo(
    () => buildKpiChartData(chart, kpiResults),
    [chart, kpiResults],
  )

  const config = useMemo(() => toChartConfig(chart), [chart])

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-3 pb-3">
        <ChartFactory
          chartId={chart.id}
          config={config}
          data={chartData}
          isLoading={false}
        />
      </CardContent>
    </Card>
  )
}

function ChartItemSkeleton({ title }: { title?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        {title ? (
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        ) : (
          <Skeleton className="h-4 w-32" />
        )}
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

/**
 * Config-driven chart grid.
 *
 * Renders charts from a dashboard config using a 12-column CSS grid.
 * Each chart's `sourceType` determines where data comes from:
 * - `"kpi_values"` — transforms already-fetched KPI results (zero extra queries)
 * - `"query"` — fetches data via `useDataSourceQuery`
 */
export function ConfigChartGrid({ charts, kpiResults }: ConfigChartGridProps) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      }}
    >
      {charts.map((chart) => (
        <div
          key={chart.id}
          style={{
            gridColumn: `span ${chart.layout.width}`,
            gridRow: `span ${chart.layout.height}`,
          }}
        >
          {chart.sourceType === 'kpi_values' ? (
            <KpiValuesChartItem
              chart={chart}
              kpiResults={kpiResults ?? []}
            />
          ) : (
            <QueryChartItem chart={chart} />
          )}
        </div>
      ))}
    </div>
  )
}

export function ConfigChartGridSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ gridColumn: 'span 6' }}>
          <ChartItemSkeleton />
        </div>
      ))}
    </div>
  )
}
