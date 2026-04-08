import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { ChartLibraryList } from '@/components/charts/chart-library-list'

export const Route = createFileRoute('/_app/charts/')({
  component: ChartsPage,
})

function ChartsPage() {
  return (
    <motion.div
      className="p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Charts</h1>
      <ChartLibraryList />
    </motion.div>
  )
}
