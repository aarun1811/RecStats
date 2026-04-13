import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useQueryClient } from '@tanstack/react-query'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartFactory } from '@/components/charts/chart-factory'
import { ErrorPanel } from '@/components/shared/error-panel'
import { DrillBreadcrumb } from '@/components/dashboard/drill-breadcrumb'
import { DrillDetailGrid } from '@/components/dashboard/drill-detail-grid'
import { ChartToolbar } from '@/components/dashboard/chart-toolbar'
import { ChartFullscreenDialog } from '@/components/dashboard/chart-fullscreen-dialog'
import { useDataSourceQuery } from '@/hooks/use-data-source-query'
import { useCrossFilter } from '@/hooks/use-cross-filter'
import { useDrillDown, applyDrillFilters } from '@/hooks/use-drill-down'
import { useFilterStore } from '@/stores/filter-store'
import { ApiError } from '@/lib/api-client'
import type { DashboardChartConfig, KpiResult } from '@/types/dashboard-config'
import type { ChartClickEvent, ChartConfig, ChartDataResponse, ChartSelection, ChartRef } from '@/types/chart'

interface ConfigChartGridProps {
  charts: DashboardChartConfig[]
  kpiResults?: KpiResult[]
  crossFilterEnabled?: boolean
  drillDownEnabled?: boolean
  dashboardHasFilters?: boolean
  onRefreshKpis?: () => void
  isRefreshingKpis?: boolean
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
  const metricColumns: string[] = []
  for (const source of chart.sources ?? []) {
    if (source.metric) metricColumns.push(source.metric)
  }
  return {
    id: chart.id,
    name: chart.title,
    vizType: chart.type,
    datasourceId: 0, // unused -- config-driven charts resolve via datasetId
    metricColumns,
    // categoryColumn intentionally omitted — resolved at render time as first non-metric string column
    ...(chart.appearance ? { appearance: chart.appearance } : {}),
  }
}

/**
 * Renders a single query-sourced chart with cross-filter and drill-down support.
 * Returns a Fragment containing:
 *   1. The chart card (with breadcrumb when drilling)
 *   2. Conditionally, a full-width detail grid below the chart row
 */
function QueryChartItemWithDrill({
  chart,
  crossFilterEnabled,
  drillDownEnabled,
  dashboardHasFilters,
}: {
  chart: DashboardChartConfig
  crossFilterEnabled?: boolean
  drillDownEnabled?: boolean
  dashboardHasFilters?: boolean
}) {
  const appliedFilters = useFilterStore((s) => s.applied)
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const addCrossFilter = useFilterStore((s) => s.addCrossFilter)

  // ---- Refs for chart export ----
  const chartRef = useRef<ChartRef>(null)
  const fullscreenChartRef = useRef<ChartRef>(null)

  // ---- Hover & fullscreen state ----
  const [hovered, setHovered] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

  // ---- Data fetching ----
  const dataSourceId = chart.sources?.[0]?.dataSourceId ?? ''
  const hasAppliedFilters = Object.keys(appliedFilters).length > 0
  const { data: queryResponse, isLoading, isError, error, refetch, isFetching } = useDataSourceQuery(
    dataSourceId,
    appliedFilters,
    !!dataSourceId && (hasAppliedFilters || !dashboardHasFilters),
  )

  // ---- Per-chart refresh ----
  const queryClient = useQueryClient()
  const handleChartRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['data-source', dataSourceId] })
  }, [queryClient, dataSourceId])

  const chartData: ChartDataResponse | undefined = useMemo(() => {
    if (!queryResponse) return undefined
    // Columns can be objects ({column_name, name, type}) or strings — normalize to strings
    const columns = queryResponse.columns.map((c: unknown) =>
      typeof c === 'string' ? c : (c as Record<string, string>).name ?? (c as Record<string, string>).column_name,
    )
    return {
      chartId: chart.id,
      columns,
      data: queryResponse.rows,
      rowCount: queryResponse.rowCount,
    }
  }, [queryResponse, chart.id])

  // ---- Cross-filtering ----
  const crossFilteredData = useCrossFilter(chart.id, chartData)

  const activeSelection: ChartSelection | undefined = useMemo(() => {
    if (!crossFilterEnabled) return undefined
    const myFilter = crossFilters.find((f) => f.sourceChartId === chart.id)
    if (!myFilter) return undefined
    return { column: myFilter.column, value: myFilter.value }
  }, [crossFilters, chart.id, crossFilterEnabled])

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

  // ---- Drill-down ----
  const {
    levels, depth, hierarchy, isAtDetailLevel,
    canDrill, canGoBack, drill, reset, navigateTo,
  } = useDrillDown(chart.id, drillDownEnabled ? chart.drillHierarchy : undefined)

  const nextHierarchyColumn = hierarchy[depth]

  // Extract metric column names from chart sources (review concern 2):
  // prefer config metadata over brittle runtime `typeof === 'number'` heuristic
  const configMetricColumns = useMemo(() => {
    if (!chart.sources?.length) return undefined
    const metrics = new Set<string>()
    for (const source of chart.sources) {
      if (source.metric) {
        metrics.add(source.metric)
      }
    }
    return metrics.size > 0 ? Array.from(metrics) : undefined
  }, [chart.sources])

  const drilledData = useMemo(
    () => applyDrillFilters(crossFilteredData, levels, nextHierarchyColumn, configMetricColumns),
    [crossFilteredData, levels, nextHierarchyColumn, configMetricColumns],
  )

  // Double-click to drill into next level
  const handleChartDoubleClick = useCallback(
    (event: ChartClickEvent) => {
      if (!drillDownEnabled || !canDrill || isAtDetailLevel) return
      const currentColumn = hierarchy[depth] ?? event.column
      drill(currentColumn, String(event.value))
    },
    [drillDownEnabled, canDrill, isAtDetailLevel, hierarchy, depth, drill],
  )

  const config = useMemo(() => toChartConfig(chart), [chart])

  if (isLoading) {
    return (
      <div
        style={{
          gridColumn: `span ${chart.layout.width}`,
          gridRow: `span ${chart.layout.height}`,
        }}
      >
        <ChartItemSkeleton title={chart.title} />
      </div>
    )
  }

  if (isError) {
    const apiError = error instanceof ApiError ? error : null
    return (
      <div
        style={{
          gridColumn: `span ${chart.layout.width}`,
          gridRow: `span ${chart.layout.height}`,
        }}
      >
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
      </div>
    )
  }

  return (
    <Fragment>
      <div
        style={{
          gridColumn: `span ${chart.layout.width}`,
          gridRow: `span ${chart.layout.height}`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Card className="flex flex-col py-4 gap-2">
          <CardHeader className="relative px-4 py-0 space-y-1">
            <CardTitle className="text-sm font-medium">{chart.title}</CardTitle>
            {canGoBack && (
              <DrillBreadcrumb
                levels={levels}
                onNavigate={navigateTo}
                onReset={reset}
              />
            )}
            <AnimatePresence>
              {hovered && (
                <motion.div
                  className="absolute top-0 right-2 z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <ChartToolbar
                    chartRef={chartRef}
                    chartTitle={chart.title}
                    onFullscreen={() => setFullscreenOpen(true)}
                    onRefresh={handleChartRefresh}
                    isRefreshing={isFetching}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </CardHeader>
          <CardContent className="flex-1 px-3 pb-2">
            <ChartFactory
              ref={chartRef}
              chartId={chart.id}
              config={config}
              data={drilledData ?? crossFilteredData}
              isLoading={false}
              onChartClick={crossFilterEnabled ? handleChartClick : undefined}
              onChartDoubleClick={drillDownEnabled ? handleChartDoubleClick : undefined}
              activeSelection={activeSelection}
            />
          </CardContent>
        </Card>
      </div>

      {/* Fullscreen dialog with IDENTICAL cross-filter state as the dashboard card */}
      <ChartFullscreenDialog
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        chartTitle={chart.title}
        toolbarSlot={
          <ChartToolbar
            chartRef={fullscreenChartRef}
            chartTitle={chart.title}
            onFullscreen={() => {}}
            onRefresh={handleChartRefresh}
            isRefreshing={isFetching}
            isInsideFullscreen
          />
        }
      >
        <ChartFactory
          ref={fullscreenChartRef}
          chartId={chart.id}
          config={config}
          data={drilledData ?? crossFilteredData}
          isLoading={false}
          onChartClick={crossFilterEnabled ? handleChartClick : undefined}
          onChartDoubleClick={drillDownEnabled ? handleChartDoubleClick : undefined}
          activeSelection={activeSelection}
          className="h-[calc(85vh-120px)]"
        />
      </ChartFullscreenDialog>

      <AnimatePresence>
        {isAtDetailLevel && chart.drillDetailDataSourceId && (
          <motion.div
            key={`detail-${chart.id}`}
            style={{ gridColumn: '1 / -1' }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onAnimationComplete={() => {
              // Auto-scroll to detail grid
              const el = document.getElementById(`drill-detail-${chart.id}`)
              el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }}
          >
            <div id={`drill-detail-${chart.id}`}>
              <DrillDetailGrid
                chartTitle={chart.title}
                dataSourceId={chart.drillDetailDataSourceId}
                drillLevels={levels}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Fragment>
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
  onRefresh,
  isRefreshing,
}: {
  chart: DashboardChartConfig
  kpiResults: KpiResult[]
  crossFilterEnabled?: boolean
  onRefresh?: () => void
  isRefreshing?: boolean
}) {
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const addCrossFilter = useFilterStore((s) => s.addCrossFilter)

  // ---- Refs for chart export ----
  const chartRef = useRef<ChartRef>(null)
  const fullscreenChartRef = useRef<ChartRef>(null)

  // ---- Hover & fullscreen state ----
  const [hovered, setHovered] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

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
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Card className="flex flex-col py-4 gap-2">
        <CardHeader className="relative px-4 py-0">
          <CardTitle className="text-sm font-medium">{chart.title}</CardTitle>
          <AnimatePresence>
            {hovered && (
              <motion.div
                className="absolute top-0 right-2 z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChartToolbar
                  chartRef={chartRef}
                  chartTitle={chart.title}
                  onFullscreen={() => setFullscreenOpen(true)}
                  onRefresh={onRefresh}
                  isRefreshing={isRefreshing}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </CardHeader>
        <CardContent className="flex-1 px-3 pb-2">
          <ChartFactory
            ref={chartRef}
            chartId={chart.id}
            config={config}
            data={crossFilteredData}
            isLoading={false}
            onChartClick={crossFilterEnabled ? handleChartClick : undefined}
            activeSelection={activeSelection}
          />
        </CardContent>
      </Card>

      {/* Fullscreen dialog with identical cross-filter state */}
      <ChartFullscreenDialog
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        chartTitle={chart.title}
        toolbarSlot={
          <ChartToolbar
            chartRef={fullscreenChartRef}
            chartTitle={chart.title}
            onFullscreen={() => {}}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            isInsideFullscreen
          />
        }
      >
        <ChartFactory
          ref={fullscreenChartRef}
          chartId={chart.id}
          config={config}
          data={crossFilteredData}
          isLoading={false}
          onChartClick={crossFilterEnabled ? handleChartClick : undefined}
          activeSelection={activeSelection}
          className="h-[calc(85vh-120px)]"
        />
      </ChartFullscreenDialog>
    </div>
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
 *
 * Supports per-chart drill-down: double-click navigates hierarchy levels,
 * breadcrumb shows inside chart header, and a full-width detail grid
 * slides in below the drilled chart row via CSS grid `gridColumn: 1 / -1`.
 */
export function ConfigChartGrid({ charts, kpiResults, crossFilterEnabled, drillDownEnabled, dashboardHasFilters, onRefreshKpis, isRefreshingKpis }: ConfigChartGridProps) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      }}
    >
      {charts.map((chart) => {
        if (chart.sourceType === 'kpi_values') {
          return (
            <div
              key={chart.id}
              style={{
                gridColumn: `span ${chart.layout.width}`,
                gridRow: `span ${chart.layout.height}`,
              }}
            >
              <KpiValuesChartItem
                chart={chart}
                kpiResults={kpiResults ?? []}
                crossFilterEnabled={crossFilterEnabled}
                onRefresh={onRefreshKpis}
                isRefreshing={isRefreshingKpis}
              />
            </div>
          )
        }
        return (
          <QueryChartItemWithDrill
            key={chart.id}
            chart={chart}
            crossFilterEnabled={crossFilterEnabled}
            drillDownEnabled={drillDownEnabled}
            dashboardHasFilters={dashboardHasFilters}
          />
        )
      })}
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
