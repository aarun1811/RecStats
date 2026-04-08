import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { KpiLibraryList } from '@/components/kpis/kpi-library-list'

export const Route = createFileRoute('/_app/kpis/')({
  component: KpisPage,
})

function KpisPage() {
  return (
    <motion.div
      className="p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">KPI Library</h1>
      <KpiLibraryList />
    </motion.div>
  )
}

export default KpisPage
