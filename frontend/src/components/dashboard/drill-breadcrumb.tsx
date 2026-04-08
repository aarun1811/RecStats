import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { DrillLevel } from '@/types/filter'

interface DrillBreadcrumbProps {
  levels: DrillLevel[]
  onNavigate: (levelIndex: number) => void
  onReset: () => void
}

/**
 * Per-chart breadcrumb navigation for drill-down levels.
 * Renders inside the chart card header area.
 *
 * - Root level is "Overview" -- clicking calls onReset() to clear all drill state
 * - Intermediate levels are clickable links -- clicking calls onNavigate(levelIndex) to truncate
 * - Last level is BreadcrumbPage (current location, not clickable)
 */
export function DrillBreadcrumb({ levels, onNavigate, onReset }: DrillBreadcrumbProps) {
  if (levels.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Root level -- clicking returns to overview */}
        <BreadcrumbItem>
          <BreadcrumbLink
            href="#"
            onClick={(e) => {
              e.preventDefault()
              onReset()
            }}
            className="text-sm"
          >
            Overview
          </BreadcrumbLink>
        </BreadcrumbItem>

        {levels.map((level, index) => {
          const isLast = index === levels.length - 1
          return (
            <BreadcrumbItem key={`${level.column}-${level.value}`}>
              <BreadcrumbSeparator />
              {isLast ? (
                <BreadcrumbPage className="text-sm">
                  {level.label ?? level.value}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onNavigate(index + 1)
                  }}
                  className="text-sm"
                >
                  {level.label ?? level.value}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
