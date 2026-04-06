import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'

export const Route = createFileRoute('/_app/charts/new')({
  component: ChartNewPage,
})

function ChartNewPage() {
  return (
    <motion.div
      className="p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New Chart</h1>
      <div className="text-sm text-muted-foreground">Chart builder coming soon</div>
    </motion.div>
  )
}
