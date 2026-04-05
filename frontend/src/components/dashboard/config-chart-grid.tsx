import { useCallback, useMemo } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartFactory } from '@/components/charts/chart-factory'
import { ErrorPanel } from '@/components/shared/error-panel'
import { useDataSourceQuery } from '@/hooks/use-data-source-query'
import { useCrossFilter } from '@/hooks/use-cross-filter'
import { useFilterStore } from '@/stores/filter-store'
import { ApiError } from '@/lib/api-client'
import type { DashboardChartConfig, KpiResult } from '@/types/dashboard-config'
import type { ChartClickEvent, ChartConfig, ChartDataResponse, ChartSelection } from '@/types/chart'

interface ConfigChartGridProps {
  charts: DashboardChartConfig[]
  kpiResults?: KpiResult[]
  crossFilterEnabled?: boolean
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
function QueryChartItem({
  chart,
  crossFilterEnabled,
}: {
  chart: DashboardChartConfig
  crossFilterEnabled?: boolean
}) {
  const appliedFilters = useFilterStore((s) => s.applied)
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const addCrossFilter = useFilterStore((s) => s.addCrossFilter)

  // For query-sourced charts, the first source's dataSourceId drives the query.
  const dataSourceId = chart.sources?.[0]?.dataSourceId ?? ''
  const { data: queryResponse, isLoading, isError, error, refetch } = useDataSourceQuery(
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

  // Apply cross-filtering to chart data (column-name matching, self-exclusion)
  const crossFilteredData = useCrossFilter(chart.id, chartData)

  // Build active selection for source chart highlighting
  const activeSelection: ChartSelection | undefined = useMemo(() => {
    if (!crossFilterEnabled) return undefined
    const myFilter = crossFilters.find((f) => f.sourceChartId === chart.id)
    if (!myFilter) return undefined
    return { column: myFilter.column, value: myFilter.value }
  }, [crossFilters, chart.id, crossFilterEnabled])

  // Click handler: dispatch cross-filter (D-01 toggle, D-06 opt-out)
  const handleChartClick = useCallback(
    (event: ChartClickEvent) => {
      if (!crossFilterEnabled) return
      if (chart.crossFilter === false) return // D-06 opt-out
      addCrossFilter({
        sourceChartId: event.chartId,
        column: event.column,
        value: event.value,
      })
    },
    [crossFilterEnabled, chart.crossFilter, addCrossFilter],
  )

  const config = useMemo(() => toChartConfig(chart), [chart])

  if (isLoading) {
    return <ChartItemSkeleton title={chart.title} />
  }

  if (isError) {
    const apiError = error instanceof ApiError ? error : null
    return (
      <Card className="flex flex-col py-4 gap-2">
        <CardHeader className="px-4 py-0">
          <CardTitle className="text-sm font-medium">{chart.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 px-3 pb-2">
          <ErrorPanel
            message={apiError?.userMessage ?? 'Failed to load chart data'}
            detail={apiError?.detail}
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col py-4 gap-2">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-sm font-medium">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-3 pb-2">
        <ChartFactory
          chartId={chart.id}
          config={config}
          data={crossFilteredData}
          isLoading={false}
          onChartClick={crossFilterEnabled ? handleChartClick : undefined}
          activeSelection={activeSelection}
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
  crossFilterEnabled,
}: {
  chart: DashboardChartConfig
  kpiResults: KpiResult[]
  crossFilterEnabled?: boolean
}) {
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const addCrossFilter = useFilterStore((s) => s.addCrossFilter)

  const chartData = useMemo(
    () => buildKpiChartData(chart, kpiResults),
    [chart, kpiResults],
  )

  // Apply cross-filtering to KPI chart data
  const crossFilteredData = useCrossFilter(chart.id, chartData)

  // Build active selection for source chart highlighting
  const activeSelection: ChartSelection | undefined = useMemo(() => {
    if (!crossFilterEnabled) return undefined
    const myFilter = crossFilters.find((f) => f.sourceChartId === chart.id)
    if (!myFilter) return undefined
    return { column: myFilter.column, value: myFilter.value }
  }, [crossFilters, chart.id, crossFilterEnabled])

  // Click handler for KPI-values charts (e.g., donut showing KPI breakdown)
  const handleChartClick = useCallback(
    (event: ChartClickEvent) => {
      if (!crossFilterEnabled) return
      if (chart.crossFilter === false) return
      addCrossFilter({
        sourceChartId: event.chartId,
        column: event.column,
        value: event.value,
      })
    },
    [crossFilterEnabled, chart.crossFilter, addCrossFilter],
  )

  const config = useMemo(() => toChartConfig(chart), [chart])

  return (
    <Card className="flex flex-col py-4 gap-2">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-sm font-medium">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-3 pb-2">
        <ChartFactory
          chartId={chart.id}
          config={config}
          data={crossFilteredData}
          isLoading={false}
          onChartClick={crossFilterEnabled ? handleChartClick : undefined}
          activeSelection={activeSelection}
        />
      </CardContent>
    </Card>
  )
}

function ChartItemSkeleton({ title }: { title?: string }) {
  return (
    <Card className="py-4 gap-2">
      <CardHeader className="px-4 py-0">
        {title ? (
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        ) : (
          <Skeleton className="h-4 w-32" />
        )}
      </CardHeader>
      <CardContent className="px-3 pb-2">
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
 * - `"kpi_values"` -- transforms already-fetched KPI results (zero extra queries)
 * - `"query"` -- fetches data via `useDataSourceQuery`
 */
export function ConfigChartGrid({ charts, kpiResults, crossFilterEnabled }: ConfigChartGridProps) {
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
              crossFilterEnabled={crossFilterEnabled}
            />
          ) : (
            <QueryChartItem
              chart={chart}
              crossFilterEnabled={crossFilterEnabled}
            />
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
