import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { DatasetEditor } from '@/components/datasets/dataset-editor'
import { useManagedDataset } from '@/hooks/use-managed-datasets'

export const Route = createFileRoute('/_app/datasets/$datasetId/edit')({
  component: DatasetEditPage,
})

function DatasetEditPage() {
  const { datasetId } = Route.useParams()
  const { data, isLoading } = useManagedDataset(datasetId)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <DatasetEditor mode="edit" dataset={data} isLoading={isLoading} />
    </motion.div>
  )
}
