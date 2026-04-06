import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { ChartBuilder } from '@/components/charts/chart-builder'

export const Route = createFileRoute('/_app/charts/new')({
  component: ChartNewPage,
})

function ChartNewPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <ChartBuilder mode="create" />
    </motion.div>
  )
}
