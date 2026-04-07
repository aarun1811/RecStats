import { Plus } from 'lucide-react'
import { motion } from 'motion/react'

import { Button } from '@/components/ui/button'

interface BuilderEmptyStateProps {
  onAddContent: () => void
}

export function BuilderEmptyState({ onAddContent }: BuilderEmptyStateProps) {
  return (
    <motion.div
      className="relative flex min-h-[480px] items-center justify-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        {/* Blueprint illustration — stylized dashboard layout preview */}
        <div className="relative">
          <svg
            width="160"
            height="100"
            viewBox="0 0 160 100"
            className="text-primary/50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer frame */}
            <rect
              x="2"
              y="2"
              width="156"
              height="96"
              rx="3"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 3"
              className="text-primary/30"
            />

            {/* KPI row — 4 small rectangles */}
            <rect x="10" y="10" width="30" height="14" rx="1" fill="currentColor" fillOpacity="0.5" />
            <rect x="44" y="10" width="30" height="14" rx="1" fill="currentColor" fillOpacity="0.5" />
            <rect x="78" y="10" width="30" height="14" rx="1" fill="currentColor" fillOpacity="0.5" />
            <rect x="112" y="10" width="38" height="14" rx="1" fill="currentColor" fillOpacity="0.5" />

            {/* Chart panels */}
            <rect
              x="10"
              y="32"
              width="70"
              height="32"
              rx="1"
              stroke="currentColor"
              strokeWidth="1"
              fill="currentColor"
              fillOpacity="0.08"
            />
            {/* Chart trend line */}
            <polyline
              points="16,56 26,48 36,52 46,42 56,38 66,32 76,36"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              className="text-primary/80"
            />

            <rect
              x="84"
              y="32"
              width="66"
              height="32"
              rx="1"
              stroke="currentColor"
              strokeWidth="1"
              fill="currentColor"
              fillOpacity="0.08"
            />
            {/* Chart bars */}
            <rect x="90" y="50" width="6" height="12" fill="currentColor" fillOpacity="0.6" />
            <rect x="100" y="44" width="6" height="18" fill="currentColor" fillOpacity="0.6" />
            <rect x="110" y="48" width="6" height="14" fill="currentColor" fillOpacity="0.6" />
            <rect x="120" y="38" width="6" height="24" fill="currentColor" fillOpacity="0.6" />
            <rect x="130" y="42" width="6" height="20" fill="currentColor" fillOpacity="0.6" />
            <rect x="140" y="46" width="6" height="16" fill="currentColor" fillOpacity="0.6" />

            {/* Grid panel (stripes) */}
            <rect
              x="10"
              y="72"
              width="140"
              height="18"
              rx="1"
              stroke="currentColor"
              strokeWidth="1"
              fill="currentColor"
              fillOpacity="0.04"
            />
            <line x1="14" y1="77" x2="146" y2="77" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.5" />
            <line x1="14" y1="81" x2="146" y2="81" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.5" />
            <line x1="14" y1="85" x2="146" y2="85" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.5" />

            {/* Corner ticks — blueprint marks */}
            <line x1="0" y1="6" x2="5" y2="6" stroke="currentColor" strokeWidth="1" className="text-primary/60" />
            <line x1="6" y1="0" x2="6" y2="5" stroke="currentColor" strokeWidth="1" className="text-primary/60" />
            <line x1="155" y1="6" x2="160" y2="6" stroke="currentColor" strokeWidth="1" className="text-primary/60" />
            <line x1="154" y1="0" x2="154" y2="5" stroke="currentColor" strokeWidth="1" className="text-primary/60" />
            <line x1="0" y1="94" x2="5" y2="94" stroke="currentColor" strokeWidth="1" className="text-primary/60" />
            <line x1="6" y1="95" x2="6" y2="100" stroke="currentColor" strokeWidth="1" className="text-primary/60" />
            <line x1="155" y1="94" x2="160" y2="94" stroke="currentColor" strokeWidth="1" className="text-primary/60" />
            <line x1="154" y1="95" x2="154" y2="100" stroke="currentColor" strokeWidth="1" className="text-primary/60" />
          </svg>
        </div>

        {/* Caption — architectural labels */}
        <div className="flex flex-col items-center gap-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/60">
            / start blueprint
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            An empty canvas awaits
          </h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Add charts, KPIs, data grids, and filters from your library to
            compose a dashboard.
          </p>
        </div>

        <Button
          size="default"
          onClick={onAddContent}
          className="shadow-sm shadow-primary/20"
        >
          <Plus className="mr-1.5 size-4" />
          Add Your First Panel
        </Button>
      </div>
    </motion.div>
  )
}
