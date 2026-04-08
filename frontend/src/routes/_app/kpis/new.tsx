import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { KpiBuilder } from '@/components/kpis/kpi-builder'

export const Route = createFileRoute('/_app/kpis/new')({
  component: NewKpiPage,
})

function NewKpiPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <KpiBuilder />
    </motion.div>
  )
}

export default NewKpiPage
