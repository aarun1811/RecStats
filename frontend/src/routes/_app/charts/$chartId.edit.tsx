import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { ChartBuilder } from '@/components/charts/chart-builder'
import { useManagedChart } from '@/hooks/use-managed-charts'
import { useManagedDataset } from '@/hooks/use-managed-datasets'

export const Route = createFileRoute('/_app/charts/$chartId/edit')({
  component: ChartEditPage,
})

function ChartEditPage() {
  const { chartId } = Route.useParams()
  const { data: chart, isLoading: chartLoading } = useManagedChart(chartId)
  const { data: dataset, isLoading: datasetLoading } = useManagedDataset(
    chart?.datasetId ?? null,
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <ChartBuilder
        mode="edit"
        initialChart={chart}
        initialDataset={dataset}
        isLoading={chartLoading || datasetLoading}
      />
    </motion.div>
  )
}
