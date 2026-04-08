import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { DatasetEditor } from '@/components/datasets/dataset-editor'

export const Route = createFileRoute('/_app/datasets/new')({
  component: DatasetNewPage,
})

function DatasetNewPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <DatasetEditor mode="create" />
    </motion.div>
  )
}
