import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { DatasetList } from '@/components/datasets/dataset-list'

export const Route = createFileRoute('/_app/datasets/')({
  component: DatasetsPage,
})

function DatasetsPage() {
  return (
    <div className="p-6">
      <motion.h1
        className="mb-6 text-2xl font-semibold tracking-tight"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        Datasets
      </motion.h1>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2, ease: 'easeOut' }}
      >
        <DatasetList />
      </motion.div>
    </div>
  )
}
