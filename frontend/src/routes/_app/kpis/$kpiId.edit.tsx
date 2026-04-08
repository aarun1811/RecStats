import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { KpiBuilder } from '@/components/kpis/kpi-builder'
import { useManagedKpi } from '@/hooks/use-managed-kpis'
import { useManagedDataset } from '@/hooks/use-managed-datasets'

export const Route = createFileRoute('/_app/kpis/$kpiId/edit')({
  component: EditKpiPage,
})

function EditKpiPage() {
  const { kpiId } = Route.useParams()
  const { data: kpi, isLoading: kpiLoading } = useManagedKpi(kpiId)
  const { data: dataset, isLoading: datasetLoading } = useManagedDataset(
    kpi?.datasetId ?? null,
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <KpiBuilder
        editKpi={kpi}
        editDataset={dataset}
        isLoading={kpiLoading || datasetLoading}
      />
    </motion.div>
  )
}

export default EditKpiPage
