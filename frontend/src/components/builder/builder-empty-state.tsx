import { LayoutDashboard, Plus } from 'lucide-react'
import { motion } from 'motion/react'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

interface BuilderEmptyStateProps {
  onAddContent: () => void
}

export function BuilderEmptyState({ onAddContent }: BuilderEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Empty className="border-none py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutDashboard />
          </EmptyMedia>
          <EmptyTitle>Start building your dashboard</EmptyTitle>
          <EmptyDescription>
            Click + Add to place charts, KPIs, and data grids on the canvas.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onAddContent}>
            <Plus className="mr-2 size-4" />
            Add Content
          </Button>
        </EmptyContent>
      </Empty>
    </motion.div>
  )
}
