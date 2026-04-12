import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { ChartLibraryList } from '@/components/charts/chart-library-list'

export const Route = createFileRoute('/_app/charts/')({
  component: ChartsPage,
})

function ChartsPage() {
  return (
    <div className="p-6">
      <motion.h1
        className="mb-6 text-2xl font-semibold tracking-tight"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        Charts
      </motion.h1>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.2, ease: 'easeOut' }}
      >
        <ChartLibraryList />
      </motion.div>
    </div>
  )
}
