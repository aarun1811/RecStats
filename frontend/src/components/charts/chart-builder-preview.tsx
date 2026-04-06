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
}

export function ChartBuilderPreview({ state, onPreviewData }: ChartBuilderPreviewProps) {
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<ChartDataResponse | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState<string | null>(null)

  // Fetch chart data for live preview when mapping is configured
  useEffect(() => {
    const shouldFetchChart =
      (state.step === 'mapping' || state.step === 'appearance' || state.step === 'save') &&
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
        const rawColumns = result.columns ?? (rawData.length > 0 ? Object.keys(rawData[0]) : [])

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
    <div className="flex flex-col rounded-lg border bg-card p-6 min-h-[320px]">
      <h3 className="mb-4 text-sm font-semibold">Preview</h3>

      {/* No dataset selected */}
      {!state.dataset && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Select a dataset to get started
          </p>
        </div>
      )}

      {/* Step 1: Dataset selected -- show column metadata */}
      {state.dataset && state.step === 'dataset' && (
        <div className="flex flex-1 flex-col gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Column Metadata</h4>
            <div className="overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Role</th>
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

          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewData}
            disabled={previewLoading}
          >
            {previewLoading ? 'Loading...' : 'Preview Data'}
          </Button>

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

          {previewData && previewData.length > 0 && (
            <div className="overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {Object.keys(previewData[0]).map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-medium font-mono">
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

      {/* Steps 3-5: Live chart preview */}
      {state.dataset &&
        (state.step === 'mapping' || state.step === 'appearance' || state.step === 'save') && (
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
              <div className="flex-1" style={{ minHeight: 280 }}>
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
          </div>
        )}
    </div>
  )
}

function buildPreviewConfig(state: BuilderPreviewState): ChartConfig {
  return {
    id: 'builder-preview',
    name: state.appearance?.title || 'Preview',
    vizType: state.chartType ?? 'bar',
    datasourceId: 0,
    metricColumns: state.columnMapping?.metricColumns ?? [],
    categoryColumn: state.columnMapping?.categoryColumn ?? undefined,
  }
}
