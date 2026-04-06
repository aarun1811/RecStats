import { useCallback, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ChartBuilder } from '@/components/charts/chart-builder'
import { ChartBuilderPreview } from '@/components/charts/chart-builder-preview'
import type { BuilderPreviewState } from '@/components/charts/chart-builder'

export const Route = createFileRoute('/_app/charts/new')({
  component: ChartNewPage,
})

function ChartNewPage() {
  const [previewState, setPreviewState] = useState<BuilderPreviewState>({
    step: 'dataset',
    dataset: null,
    chartType: null,
    columnMapping: null,
    appearance: null,
    previewDataLoading: false,
    previewData: null,
  })

  const handlePreviewChange = useCallback((state: BuilderPreviewState) => {
    setPreviewState(state)
  }, [])

  const handlePreviewData = useCallback(() => {
    // Preview data fetch handled inside ChartBuilderPreview
  }, [])

  return (
    <motion.div
      className="flex h-full flex-col p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="mb-6 flex items-center gap-3">
        <Link to="/charts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New Chart</h1>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        <div className="w-[380px] shrink-0 overflow-y-auto">
          <ChartBuilder
            mode="create"
            onPreviewChange={handlePreviewChange}
          />
        </div>
        <div className="flex-1 min-w-[50%]">
          <ChartBuilderPreview
            state={previewState}
            onPreviewData={handlePreviewData}
          />
        </div>
      </div>
    </motion.div>
  )
}
