import { ArrowLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { DrillLevel } from '@/types/filter'

interface DrillBreadcrumbProps {
  levels: DrillLevel[]
  onNavigate: (level: number) => void
  onBack: () => void
  onReset: () => void
}

export function DrillBreadcrumb({ levels, onNavigate, onBack, onReset }: DrillBreadcrumbProps) {
  if (levels.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="size-7" onClick={onBack}>
        <ArrowLeft className="size-4" />
      </Button>

      <Breadcrumb>
        <BreadcrumbList>
          {/* Root level — "All Data" */}
          <AnimatePresence mode="popLayout">
            <motion.div
              key="root"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="inline-flex items-center"
            >
              <BreadcrumbItem>
                <BreadcrumbLink
                  className="cursor-pointer"
                  onClick={() => onReset()}
                >
                  All Data
                </BreadcrumbLink>
              </BreadcrumbItem>
            </motion.div>

            {levels.map((level, idx) => {
              const isLast = idx === levels.length - 1
              return (
                <motion.div
                  key={`${level.column}-${level.value}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: idx * 0.05 }}
                  className="inline-flex items-center gap-1.5"
                >
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="font-semibold">
                        {level.value}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        className="cursor-pointer"
                        onClick={() => onNavigate(idx + 1)}
                      >
                        {level.value}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
