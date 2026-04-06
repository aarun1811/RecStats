import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { Card, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/_app/kpis/$kpiId/edit')({
  component: EditKpiPage,
})

function EditKpiPage() {
  return (
    <motion.div
      className="p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit KPI</h1>
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Edit KPI coming soon</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default EditKpiPage
