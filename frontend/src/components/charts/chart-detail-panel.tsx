import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Calendar, Database, FileText, Layers, LayoutDashboard, Pencil, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { useManagedChart, useChartReferences } from '@/hooks/use-managed-charts'
import { useManagedDataset } from '@/hooks/use-managed-datasets'
import { ChartTypeIcon, CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import { ChartFactory } from '@/components/charts/chart-factory'
import { CHART_TYPE_BORDER_COLORS } from '@/lib/style-constants'
import { DeleteChartDialog } from './delete-chart-dialog'
import type { ChartConfig, ChartDataResponse } from '@/types/chart'

interface ChartDetailPanelProps {
  chartId: string | null
  datasetName: string
  onClose: () => void
}

export function ChartDetailPanel({ chartId, datasetName, onClose }: ChartDetailPanelProps) {
  const navigate = useNavigate()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { data: chart, isLoading: chartLoading } = useManagedChart(chartId)
  const { data: dataset } = useManagedDataset(chart?.datasetId ?? null)
  const { data: references } = useChartReferences(chartId)

  const { data: rawResult, isLoading: isDataLoading } = useQuery({
    queryKey: ['chart-preview-data', chart?.datasetId, dataset?.updatedAt],
    queryFn: () =>
      api.post<{ columns: unknown[]; data: Record<string, unknown>[] }>(
        '/api/sql/execute',
        {
          database_id: dataset?.databaseId,
          sql: dataset?.sql,
          limit: 1000,
        },
      ),
    enabled: chart !== undefined && dataset !== undefined,
  })

  const previewConfig: ChartConfig | null = chart
    ? {
        id: chart.id,
        name: chart.name,
        vizType: chart.chartType,
        datasourceId: 0,
        metricColumns: chart.config.columnMapping.metricColumns,
        categoryColumn: chart.config.columnMapping.categoryColumn ?? undefined,
        appearance: { showLegend: false, typeSpecific: chart.config.appearance.typeSpecific },
      }
    : null

  const previewData = useMemo<ChartDataResponse | undefined>(() => {
    if (!rawResult?.data?.length) return undefined
    const columns = (rawResult.columns ?? Object.keys(rawResult.data[0]))
      .map((col: unknown) =>
        typeof col === 'string'
          ? col
          : (col as Record<string, string>).column_name ??
            (col as Record<string, string>).name ??
            String(col),
      )
    return {
      chartId: chart?.id ?? '',
      columns,
      data: rawResult.data,
      rowCount: rawResult.data.length,
    }
  }, [rawResult, chart?.id])

  const referencingDashboards = references?.referencingDashboards ?? []
  const displayType = chart ? (CHART_DISPLAY_NAMES[chart.chartType] ?? chart.chartType) : ''

  // Resolve column names to display names from dataset metadata
  const resolveDisplayName = (colName: string) => {
    const meta = dataset?.columns.find((c) => c.name === colName)
    return meta?.displayName || colName
  }
  const columnSummary = chart
    ? [
        chart.config.columnMapping.categoryColumn,
        ...chart.config.columnMapping.metricColumns,
      ]
        .filter(Boolean)
        .map((col) => resolveDisplayName(col as string))
        .join(' × ')
    : ''

  return (
    <>
      <Sheet
        open={chartId !== null}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      >
        <SheetContent
          side="right"
          className={cn(
            'w-[640px] sm:max-w-[640px] p-0 gap-0 flex flex-col',
            chart ? `border-l-2 ${CHART_TYPE_BORDER_COLORS[chart.chartType]}` : 'border-l-0'
          )}
        >
          {chartLoading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-[360px] w-full rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : chart ? (
            <>
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex-1 overflow-y-auto flex flex-col"
            >
              {/* Header */}
              <SheetHeader className="px-6 pt-6 pb-2">
                <SheetTitle className="text-lg font-semibold truncate pr-8">
                  {chart.name}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-1.5 text-xs">
                  <ChartTypeIcon chartType={chart.chartType} size={12} className="shrink-0" />
                  {displayType}
                  <span className="opacity-40">&middot;</span>
                  {datasetName}
                </SheetDescription>
              </SheetHeader>


              {/* Live chart — contained in a card */}
              <div className="mx-6 rounded-lg overflow-hidden bg-muted/5">
                <div className="h-[360px]">
                  {isDataLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : previewConfig && previewData ? (
                    <ChartFactory
                      chartId={chart.id}
                      config={previewConfig}
                      data={previewData}
                      isLoading={false}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-xs text-muted-foreground">
                        Preview unavailable
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-6 py-5">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Database className="size-3 text-primary/60" />
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Dataset</span>
                  </div>
                  <p className="text-sm truncate">{datasetName}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Layers className="size-3 text-primary/60" />
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Columns</span>
                  </div>
                  <p className="text-sm font-mono truncate">{columnSummary}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="size-3 text-primary/60" />
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Created</span>
                  </div>
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(chart.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="size-3 text-primary/60" />
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Updated</span>
                  </div>
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(chart.updatedAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {/* Dashboards section */}
              <div className="border-t px-6 py-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <LayoutDashboard className="size-3 text-primary/60" />
                  <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Used in Dashboards
                  </h4>
                </div>
                {referencingDashboards.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {referencingDashboards.map((dashboard) => (
                      <Badge key={dashboard.id} variant="outline" className="text-xs">
                        {dashboard.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Not used in any dashboards yet
                  </p>
                )}
              </div>

              {chart.description && (
                <div className="border-t px-6 py-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileText className="size-3 text-primary/60" />
                    <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Description
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{chart.description}</p>
                </div>
              )}
            </motion.div>

            {/* Fixed bottom bar */}
            <div className="shrink-0 border-t px-6 py-3 flex items-center gap-2">
              <Button
                className="flex-1 h-9"
                onClick={() =>
                  navigate({
                    to: '/charts/$chartId/edit',
                    params: { chartId: chart.id },
                  })
                }
              >
                <Pencil className="mr-1.5 size-3.5" />
                Edit Chart
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {chart && (
        <DeleteChartDialog
          chart={chart}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onDeleted={onClose}
        />
      )}
    </>
  )
}
