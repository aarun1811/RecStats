import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { DashboardList } from '@/components/dashboard/dashboard-list'

export const Route = createFileRoute('/_app/dashboards/')({
  component: DashboardListPage,
})

function DashboardListPage() {
  return (
    <div className="p-6">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-2xl font-semibold tracking-tight mb-6"
      >
        Dashboards
      </motion.h1>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <DashboardList />
      </motion.div>
    </div>
  )
}
