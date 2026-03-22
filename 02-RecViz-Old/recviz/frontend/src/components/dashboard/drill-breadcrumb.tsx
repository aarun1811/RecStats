import { RotateCcw } from 'lucide-react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { useDrillStore } from '@/stores/drill-store'

interface DrillBreadcrumbProps {
  chartId: string
}

export function DrillBreadcrumb({ chartId }: DrillBreadcrumbProps) {
  const drills = useDrillStore((s) => s.drills)
  const drillUp = useDrillStore((s) => s.drillUp)
  const resetDrill = useDrillStore((s) => s.resetDrill)

  const drill = drills[chartId]
  if (!drill || drill.currentLevel < 0) return null

  const visibleLevels = drill.levels.slice(0, drill.currentLevel + 1)

  return (
    <div className="flex items-center gap-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              href="#"
              onClick={(e) => {
                e.preventDefault()
                resetDrill(chartId)
              }}
            >
              Overview
            </BreadcrumbLink>
          </BreadcrumbItem>
          {visibleLevels.map((level, idx) => (
            <BreadcrumbItem key={`${level.label}-${idx}`}>
              <BreadcrumbSeparator />
              {idx < visibleLevels.length - 1 ? (
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    // drill up to this level: we need to call drillUp enough times
                    const timesToDrillUp = drill.currentLevel - idx
                    for (let i = 0; i < timesToDrillUp; i++) {
                      drillUp(chartId)
                    }
                  }}
                >
                  {level.label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{level.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => resetDrill(chartId)}
      >
        <RotateCcw className="mr-1 h-3 w-3" />
        Reset
      </Button>
    </div>
  )
}
