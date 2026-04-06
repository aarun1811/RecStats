import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { useManagedChart, useChartReferences } from '@/hooks/use-managed-charts'
import { useManagedDataset } from '@/hooks/use-managed-datasets'
import { ChartTypeIcon, CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import { ChartFactory } from '@/components/charts/chart-factory'
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

  const { data: chartData, isLoading: isDataLoading } = useQuery({
    queryKey: ['chart-preview-data', chart?.datasetId],
    queryFn: () =>
      api.post<{ columns: string[]; data: Record<string, unknown>[] }>(
        '/api/sql/execute',
        {
          database_id: dataset?.databaseId,
          sql: dataset?.sql,
          limit: 1000,
        },
      ),
    enabled: chart !== undefined && dataset !== undefined,
  })

  const previewConfig: ChartConfig | null =
    chart
      ? {
          id: chart.id,
          name: chart.config.appearance.title || chart.name,
          vizType: chart.chartType,
          datasourceId: 0,
          metricColumns: chart.config.columnMapping.metricColumns,
          categoryColumn:
            chart.config.columnMapping.categoryColumn ?? undefined,
        }
      : null

  const previewData: ChartDataResponse | undefined =
    chartData
      ? {
          chartId: chart?.id ?? '',
          columns:
            chartData.columns ??
            (chartData.data?.length > 0
              ? Object.keys(chartData.data[0])
              : []),
          data: chartData.data ?? [],
          rowCount: chartData.data?.length ?? 0,
        }
      : undefined

  const referencingDashboards = references?.referencingDashboards ?? []

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
          className="w-[500px] sm:max-w-[500px] overflow-y-auto"
        >
          {chartLoading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-[300px] w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : chart ? (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle className="text-lg font-semibold">
                    {chart.name}
                  </SheetTitle>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate({
                          to: '/charts/$chartId/edit',
                          params: { chartId: chart.id },
                        })
                      }
                    >
                      <Pencil className="mr-1.5 size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <SheetDescription className="text-xs text-muted-foreground">
                  {CHART_DISPLAY_NAMES[chart.chartType] ?? chart.chartType}{' '}
                  &middot; {datasetName}
                </SheetDescription>
              </SheetHeader>

              {/* Live chart render */}
              <div className="h-[300px] mx-4">
                {isDataLoading ? (
                  <Skeleton className="h-full w-full rounded-lg" />
                ) : previewConfig && previewData ? (
                  <ChartFactory
                    chartId={chart.id}
                    config={previewConfig}
                    data={previewData}
                    isLoading={false}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Preview unavailable
                    </p>
                  </div>
                )}
              </div>

              {/* Metadata section */}
              <div className="space-y-3 px-4">
                <div>
                  <p className="text-xs text-muted-foreground">Dataset</p>
                  <p className="text-sm">{datasetName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Chart Type</p>
                  <div className="flex items-center gap-2">
                    <ChartTypeIcon
                      chartType={chart.chartType}
                      size={16}
                      className="text-muted-foreground"
                    />
                    <p className="text-sm">
                      {CHART_DISPLAY_NAMES[chart.chartType] ?? chart.chartType}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Columns</p>
                  <p className="text-sm">
                    {chart.config.columnMapping.categoryColumn
                      ? `${chart.config.columnMapping.categoryColumn} x `
                      : ''}
                    {chart.config.columnMapping.metricColumns.join(', ')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(chart.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(chart.updatedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>

              <Separator className="mx-4" />

              {/* Used in Dashboards */}
              <div className="space-y-2 px-4 pb-4">
                <h4 className="text-sm font-semibold">Used in Dashboards</h4>
                {referencingDashboards.length > 0 ? (
                  <ul className="space-y-1">
                    {referencingDashboards.map((dashboard) => (
                      <li key={dashboard.id} className="text-sm">
                        &bull; {dashboard.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not used in any dashboards yet
                  </p>
                )}
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
