import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { DatasetList } from '@/components/datasets/dataset-list'

export const Route = createFileRoute('/_app/datasets/')({
  component: DatasetsPage,
})

function DatasetsPage() {
  return (
    <motion.div
      className="p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Datasets</h1>
      <DatasetList />
    </motion.div>
  )
}
