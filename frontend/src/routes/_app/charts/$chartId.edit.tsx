import { useCallback, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ArrowLeft, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartBuilder } from '@/components/charts/chart-builder'
import { ChartBuilderPreview } from '@/components/charts/chart-builder-preview'
import { useManagedChart } from '@/hooks/use-managed-charts'
import { useManagedDataset } from '@/hooks/use-managed-datasets'
import type { BuilderPreviewState } from '@/components/charts/chart-builder'

export const Route = createFileRoute('/_app/charts/$chartId/edit')({
  component: ChartEditPage,
})

function ChartEditPage() {
  const { chartId } = Route.useParams()
  const { data: chart, isLoading: chartLoading } = useManagedChart(chartId)
  const { data: dataset, isLoading: datasetLoading } = useManagedDataset(
    chart?.datasetId ?? null,
  )

  const [previewState, setPreviewState] = useState<BuilderPreviewState>({
    step: 'dataset',
    dataset: null,
    chartType: null,
    columnMapping: null,
    appearance: null,
    previewDataLoading: false,
    previewData: null,
  })

  const handlePreviewChange = useCallback((state: BuilderPreviewState) => {
    setPreviewState(state)
  }, [])

  const handlePreviewData = useCallback(() => {
    // Preview data fetch handled inside ChartBuilderPreview
  }, [])

  const isLoading = chartLoading || datasetLoading

  return (
    <motion.div
      className="flex h-full flex-col p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="mb-6 flex items-center gap-3">
        <Link to="/charts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
        </Link>
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">
          Edit Chart
        </h1>
        {chart && (
          <Button variant="ghost" size="sm" className="text-destructive">
            <Trash2 className="mr-1 size-4" />
            Delete
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-1 gap-6 min-h-0">
          <div className="w-[380px] shrink-0 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="flex-1 min-w-[50%]">
            <Skeleton className="h-[320px] w-full rounded-lg" />
          </div>
        </div>
      )}

      {!isLoading && chart && (
        <div className="flex flex-1 gap-6 min-h-0">
          <div className="w-[380px] shrink-0 overflow-y-auto">
            <ChartBuilder
              mode="edit"
              initialChart={chart}
              initialDataset={dataset}
              onPreviewChange={handlePreviewChange}
            />
          </div>
          <div className="flex-1 min-w-[50%]">
            <ChartBuilderPreview
              state={previewState}
              onPreviewData={handlePreviewData}
            />
          </div>
        </div>
      )}

      {!isLoading && !chart && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Chart not found</p>
        </div>
      )}
    </motion.div>
  )
}
