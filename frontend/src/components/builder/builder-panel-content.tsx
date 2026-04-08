import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Skeleton } from '@/components/ui/skeleton'
import { ChartFactory } from '@/components/charts/chart-factory'
import { KpiPreviewCard } from '@/components/kpis/kpi-preview-card'
import { api } from '@/lib/api-client'
import { useManagedChart } from '@/hooks/use-managed-charts'
import { useManagedDataset } from '@/hooks/use-managed-datasets'
import { useManagedKpi } from '@/hooks/use-managed-kpis'
import type { BuilderChartRef, BuilderGridRef, BuilderItem, BuilderKpiRef } from '@/types/builder'
import type { ChartConfig, ChartDataResponse } from '@/types/chart'

interface BuilderPanelContentProps {
  item: BuilderItem
}

interface SqlExecuteResult {
  columns: unknown[]
  data: Record<string, unknown>[]
}

/** Hook that fetches a managed dataset's SQL and executes it. */
function useDatasetPreview(datasetId: string | null, limit = 1000) {
  const { data: dataset } = useManagedDataset(datasetId)
  const query = useQuery({
    queryKey: ['builder-dataset-preview', datasetId, limit],
    queryFn: () =>
      api.post<SqlExecuteResult>('/api/sql/execute', {
        database_id: dataset?.databaseId,
        sql: dataset?.sql,
        limit,
      }),
    enabled: dataset !== undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
  return { dataset, ...query }
}

/** Normalize column names returned by /api/sql/execute (may be strings or {column_name, name}). */
function normalizeColumns(columns: unknown[], fallback?: Record<string, unknown>): string[] {
  if (columns.length === 0 && fallback) {
    return Object.keys(fallback)
  }
  return columns.map((col) =>
    typeof col === 'string'
      ? col
      : ((col as Record<string, string>).name ??
        (col as Record<string, string>).column_name ??
        String(col)),
  )
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
  // 1. Fetch the managed chart to get columnMapping + chartType
  const { data: chart, isLoading: chartLoading } = useManagedChart(chartRef.chartId)
  // 2. Fetch dataset + execute SQL
  const {
    data: rawResult,
    isLoading: dataLoading,
    isError,
    error,
  } = useDatasetPreview(chart?.datasetId ?? null, 1000)

  const isLoading = chartLoading || dataLoading

  const chartConfig = useMemo<ChartConfig | null>(() => {
    if (!chart) return null
    return {
      id: itemId,
      name: chartRef.title,
      vizType: chart.chartType,
      datasourceId: 0,
      metricColumns: chart.config.columnMapping.metricColumns,
      categoryColumn: chart.config.columnMapping.categoryColumn ?? undefined,
      appearance: { showLegend: true },
    }
  }, [chart, itemId, chartRef.title])

  const chartData = useMemo<ChartDataResponse | undefined>(() => {
    if (!rawResult?.data?.length) return undefined
    const columns = normalizeColumns(rawResult.columns ?? [], rawResult.data[0])
    return {
      chartId: itemId,
      columns,
      data: rawResult.data,
      rowCount: rawResult.data.length,
    }
  }, [rawResult, itemId])

  if (isLoading || !chartConfig) {
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
  const { data: rawResult, isLoading: dataLoading } = useDatasetPreview(
    kpi?.datasetId ?? null,
    100,
  )

  const isLoading = kpiLoading || dataLoading

  // Compute the metric value from query data
  const computedValue = useMemo(() => {
    if (!kpi || !rawResult?.data?.length) return 0
    const firstRow = rawResult.data[0]
    const rawValue = firstRow[kpi.metricColumn]
    return typeof rawValue === 'number' ? rawValue : Number(rawValue) || 0
  }, [kpi, rawResult])

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
  const { data: rawResult, isLoading } = useDatasetPreview(
    gridRef.datasetId,
    Math.max(gridRef.rowLimit, 50),
  )

  if (isLoading) {
    return <Skeleton className="h-full w-full" />
  }

  if (!rawResult?.data?.length) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    )
  }

  const columns = normalizeColumns(rawResult.columns ?? [], rawResult.data[0])
  const displayCols = columns.slice(0, 6)
  const displayRows = rawResult.data.slice(0, Math.min(gridRef.rowLimit, 10))

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
        {rawResult.data.length > 10 && (
          <div className="px-2 py-1 text-muted-foreground">
            {rawResult.data.length} total rows
          </div>
        )}
      </div>
    </div>
  )
}
