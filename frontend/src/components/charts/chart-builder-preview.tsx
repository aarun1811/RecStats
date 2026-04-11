import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartTypeIcon, CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import { ChartFactory } from '@/components/charts/chart-factory'
import type { ChartConfig, ChartDataResponse } from '@/types/chart'
import type { BuilderPreviewState } from './chart-builder'

const CHART_TYPE_DESCRIPTIONS: Record<string, string> = {
  'bar': 'Compare values across categories',
  'stacked-bar': 'Compare composition across categories',
  'line': 'Show trends over time or ordered categories',
  'area': 'Visualize cumulative totals over time',
  'pie': 'Show proportions of a whole',
  'donut': 'Show proportions with a center space for context',
  'scatter': 'Explore relationships between two measures',
  'heatmap': 'Visualize intensity across two dimensions',
  'treemap': 'Show hierarchical data as nested rectangles',
  'waterfall': 'Show cumulative effect of sequential values',
  'bullet': 'Compare a measure against a target',
  'box-plot': 'Show distribution of values across categories',
  'combo': 'Combine multiple chart types on one axis',
  'sankey': 'Show flow between nodes',
  'sunburst': 'Visualize hierarchical data as concentric rings',
  'radar': 'Compare multiple variables on a radial grid',
  'graph': 'Show relationships in a network',
  'gauge': 'Display a single value within a range',
  'parallel': 'Compare items across multiple dimensions',
  'funnel': 'Show progressive reduction through stages',
}

interface ChartBuilderPreviewProps {
  state: BuilderPreviewState
  onPreviewData: () => void
  allComplete?: boolean
}

export function ChartBuilderPreview({ state, onPreviewData, allComplete }: ChartBuilderPreviewProps) {
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<ChartDataResponse | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState<string | null>(null)

  // Reset sample data when dataset changes
  useEffect(() => {
    setPreviewData(null)
    setPreviewError(null)
  }, [state.dataset?.id])

  // Fetch chart data for live preview when mapping is configured
  useEffect(() => {
    const shouldFetchChart =
      (state.step === 'mapping' || state.step === 'appearance') &&
      state.dataset &&
      state.chartType &&
      state.columnMapping &&
      state.columnMapping.metricColumns.length > 0

    if (!shouldFetchChart || !state.dataset) {
      setChartData(null)
      return
    }

    let cancelled = false
    setChartLoading(true)
    setChartError(null)

    const dataset = state.dataset
    const fetchData = async () => {
      try {
        const result = await api.post<{
          columns: string[]
          data: Record<string, unknown>[]
        }>('/api/sql/execute', {
          database_id: dataset.databaseId,
          sql: dataset.sql,
          limit: 500,
        })

        if (cancelled) return

        const rawData = result.data ?? []
        const rawColumns = (result.columns ?? (rawData.length > 0 ? Object.keys(rawData[0]) : []))
          .map((col: unknown) =>
            typeof col === 'string' ? col : (col as Record<string, string>).column_name ?? (col as Record<string, string>).name ?? String(col),
          )

        setChartData({
          chartId: 'builder-preview',
          columns: rawColumns,
          data: rawData,
          rowCount: rawData.length,
        })
      } catch {
        if (!cancelled) {
          setChartError('Preview unavailable. Check your column mapping and try again.')
        }
      } finally {
        if (!cancelled) setChartLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [state.step, state.dataset, state.chartType, state.columnMapping])

  const handlePreviewData = useCallback(async () => {
    if (!state.dataset) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const result = await api.post<{
        columns: string[]
        data: Record<string, unknown>[]
      }>('/api/sql/execute', {
        database_id: state.dataset.databaseId,
        sql: state.dataset.sql,
        limit: 50,
      })
      setPreviewData(result.data ?? [])
    } catch {
      setPreviewError('Could not load preview data.')
    } finally {
      setPreviewLoading(false)
    }
    onPreviewData()
  }, [state.dataset, onPreviewData])

  return (
    <div className="flex flex-1 flex-col">
      {/* No dataset selected */}
      {!state.dataset && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Select a dataset to get started
          </p>
        </div>
      )}

      {/* Step 1: Dataset selected -- show column metadata + sample data */}
      {state.dataset && state.step === 'dataset' && (
        <div className="flex flex-1 flex-col">
          {/* Column metadata */}
          <div className="mb-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Columns</h4>
            <div className="overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-1.5 text-left font-medium">Name</th>
                    <th className="px-3 py-1.5 text-left font-medium">Type</th>
                    <th className="px-3 py-1.5 text-left font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {state.dataset.columns.map((col) => (
                    <tr key={col.name} className="border-b last:border-b-0">
                      <td className="px-3 py-1.5 font-mono">{col.name}</td>
                      <td className="px-3 py-1.5">{col.dataType}</td>
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className="text-xs">
                          {col.role}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sample data */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sample Data</h4>
              {!previewData && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handlePreviewData}
                  disabled={previewLoading}
                >
                  {previewLoading ? 'Loading...' : 'Load'}
                </Button>
              )}
            </div>

            {previewError && (
              <p className="text-xs text-destructive">{previewError}</p>
            )}

            {previewLoading && (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            )}

            {!previewData && !previewLoading && !previewError && (
              <p className="text-xs text-muted-foreground">Click Load to see sample rows</p>
            )}

            {previewData && previewData.length > 0 && (
              <div className="overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {Object.keys(previewData[0]).map((col) => (
                        <th key={col} className="px-3 py-1.5 text-left font-medium font-mono">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-b last:border-b-0">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-1.5 font-mono">
                            {val === null ? 'null' : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Chart type selected -- show type description */}
      {state.dataset && state.step === 'type' && state.chartType && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <ChartTypeIcon chartType={state.chartType} size={40} className="text-muted-foreground" />
          <h4 className="text-lg font-semibold">
            {CHART_DISPLAY_NAMES[state.chartType]}
          </h4>
          <p className="text-sm text-muted-foreground">
            {CHART_TYPE_DESCRIPTIONS[state.chartType] ?? ''}
          </p>
        </div>
      )}

      {/* Step 2: No chart type yet -- show placeholder */}
      {state.dataset && state.step === 'type' && !state.chartType && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Choose a chart type
          </p>
        </div>
      )}

      {/* Steps 3-4: Live chart preview */}
      {state.dataset &&
        (state.step === 'mapping' || state.step === 'appearance') && (
          <div className="flex flex-1 flex-col">
            {chartLoading && (
              <div className="flex flex-1 items-center justify-center">
                <Skeleton className="h-48 w-full" />
              </div>
            )}

            {chartError && !chartLoading && (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">{chartError}</p>
              </div>
            )}

            {chartData && !chartLoading && !chartError && state.chartType && state.columnMapping && (
              <div className="flex-1 min-h-0">
                <ChartFactory
                  chartId="builder-preview"
                  config={buildPreviewConfig(state)}
                  data={chartData}
                  isLoading={false}
                />
              </div>
            )}

            {!chartData && !chartLoading && !chartError && (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Map columns to see a live preview
                </p>
              </div>
            )}

            {allComplete && (
              <div className="mt-3 shrink-0 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-center">
                <p className="text-sm font-medium">Ready to save</p>
                <p className="text-xs text-muted-foreground">Name your chart above and click Save Chart</p>
              </div>
            )}
          </div>
        )}
    </div>
  )
}

export function buildPreviewConfig(state: BuilderPreviewState): ChartConfig {
  return {
    id: 'builder-preview',
    name: state.appearance?.title || 'Preview',
    vizType: state.chartType ?? 'bar',
    datasourceId: 0,
    metricColumns: state.columnMapping?.metricColumns ?? [],
    categoryColumn: state.columnMapping?.categoryColumn ?? undefined,
    appearance: state.appearance
      ? {
          showLegend: state.appearance.showLegend,
          legendPosition: state.appearance.legendPosition,
          showXLabel: state.appearance.showXLabel,
          showYLabel: state.appearance.showYLabel,
        }
      : undefined,
  }
}
