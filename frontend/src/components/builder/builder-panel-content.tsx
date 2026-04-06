import { useMemo } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { ChartFactory } from '@/components/charts/chart-factory'
import { KpiPreviewCard } from '@/components/kpis/kpi-preview-card'
import { useDataSourceQuery } from '@/hooks/use-data-source-query'
import { useManagedKpi } from '@/hooks/use-managed-kpis'
import type { BuilderChartRef, BuilderGridRef, BuilderItem, BuilderKpiRef } from '@/types/builder'
import type { ChartConfig, ChartDataResponse } from '@/types/chart'

interface BuilderPanelContentProps {
  item: BuilderItem
}

export function BuilderPanelContent({ item }: BuilderPanelContentProps) {
  switch (item.type) {
    case 'chart':
      return <BuilderChartContent chartRef={item.chart!} itemId={item.id} />
    case 'kpi':
      return <BuilderKpiContent kpiRef={item.kpi!} />
    case 'grid':
      return <BuilderGridContent gridRef={item.grid!} />
    default:
      return null
  }
}

/** Renders a live chart in the builder via ChartFactory. */
function BuilderChartContent({
  chartRef,
  itemId,
}: {
  chartRef: BuilderChartRef
  itemId: string
}) {
  const {
    data: queryResponse,
    isLoading,
    isError,
    error,
  } = useDataSourceQuery(chartRef.datasetId, {}, true)

  const chartConfig: ChartConfig = useMemo(
    () => ({
      id: itemId,
      name: chartRef.title,
      vizType: chartRef.chartType,
      datasourceId: 0,
      metricColumns: [],
    }),
    [itemId, chartRef.title, chartRef.chartType],
  )

  const chartData: ChartDataResponse | undefined = useMemo(() => {
    if (!queryResponse) return undefined
    // Normalize columns: can be objects ({column_name, name, type}) or strings
    const columns = queryResponse.columns.map((c: unknown) =>
      typeof c === 'string'
        ? c
        : ((c as Record<string, string>).name ??
          (c as Record<string, string>).column_name),
    )
    return {
      chartId: itemId,
      columns,
      data: queryResponse.rows,
      rowCount: queryResponse.rowCount,
    }
  }, [queryResponse, itemId])

  if (isLoading) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <ChartFactory
      chartId={itemId}
      config={chartConfig}
      data={chartData}
      isLoading={isLoading}
      error={isError ? (error as Error) : null}
      className="h-full w-full"
    />
  )
}

/** Renders a live KPI preview in the builder via KpiPreviewCard. */
function BuilderKpiContent({ kpiRef }: { kpiRef: BuilderKpiRef }) {
  const { data: kpi, isLoading: kpiLoading } = useManagedKpi(kpiRef.kpiId)
  const { data: queryResponse, isLoading: dataLoading } = useDataSourceQuery(
    kpi?.datasetId ?? '',
    {},
    !!kpi,
  )

  const isLoading = kpiLoading || dataLoading

  // Compute the metric value from query data
  const computedValue = useMemo(() => {
    if (!kpi || !queryResponse || queryResponse.rows.length === 0) return 0
    const firstRow = queryResponse.rows[0]
    const rawValue = firstRow[kpi.metricColumn]
    return typeof rawValue === 'number' ? rawValue : Number(rawValue) || 0
  }, [kpi, queryResponse])

  if (!kpi) {
    return (
      <KpiPreviewCard
        name={kpiRef.title}
        value={0}
        isLoading={true}
        format={{ type: 'number', decimals: null, abbreviate: false, currencyCode: null }}
        className="h-full border-0 p-3"
      />
    )
  }

  return (
    <KpiPreviewCard
      name={kpiRef.title}
      value={computedValue}
      isLoading={isLoading}
      format={kpi.config.format}
      trend={kpi.config.trend}
      trendPercentage={null}
      thresholds={kpi.config.thresholds}
      subtitle={kpi.config.subtitle}
      className="h-full border-0 p-3"
    />
  )
}

/** Renders a lightweight data grid preview in the builder. */
function BuilderGridContent({ gridRef }: { gridRef: BuilderGridRef }) {
  const { data: queryResponse, isLoading } = useDataSourceQuery(
    gridRef.datasetId,
    {},
    true,
  )

  if (isLoading) {
    return <Skeleton className="h-full w-full" />
  }

  if (!queryResponse) {
    return null
  }

  // Normalize columns
  const columns = queryResponse.columns.map((c: unknown) =>
    typeof c === 'string'
      ? c
      : ((c as Record<string, string>).name ??
        (c as Record<string, string>).column_name),
  )

  const displayCols = columns.slice(0, 6)
  const displayRows = queryResponse.rows
    .slice(0, Math.min(gridRef.rowLimit, 10))

  return (
    <div className="h-full w-full overflow-auto">
      <div className="text-xs">
        <div className="sticky top-0 flex gap-px bg-muted/80 backdrop-blur">
          {displayCols.map((col) => (
            <div
              key={col}
              className="min-w-[100px] truncate px-2 py-1.5 font-medium text-muted-foreground"
            >
              {col}
            </div>
          ))}
        </div>
        {displayRows.map((row, i) => (
          <div key={i} className="flex gap-px border-t">
            {displayCols.map((col) => (
              <div key={col} className="min-w-[100px] truncate px-2 py-1">
                {String(row[col] ?? '')}
              </div>
            ))}
          </div>
        ))}
        {queryResponse.rowCount > 10 && (
          <div className="px-2 py-1 text-muted-foreground">
            {queryResponse.rowCount} total rows
          </div>
        )}
      </div>
    </div>
  )
}
