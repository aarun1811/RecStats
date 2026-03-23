import { TrendingDown, TrendingUp } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CountAnimation } from '@/components/shared/count-animation'
import { useDashboardKpis } from '@/hooks/use-dashboard-kpis'
import { useFilterStore } from '@/stores/filter-store'
import { cn } from '@/lib/utils'
import type { KpiConfig } from '@/types/dashboard-config'

interface ConfigKpiRowProps {
  dashboardId: string
  kpis: KpiConfig[]
}

function KpiSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-8 w-32" />
        <Skeleton className="mt-2 h-3 w-24" />
      </CardContent>
    </Card>
  )
}

export function ConfigKpiRow({ dashboardId, kpis }: ConfigKpiRowProps) {
  const appliedFilters = useFilterStore((s) => s.applied)
  const { data, isLoading } = useDashboardKpis(dashboardId, appliedFilters)

  if (isLoading || !data) {
    return (
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${kpis.length || 4}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: kpis.length || 4 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    )
  }

  const kpiResultsMap = new Map(
    data?.kpis.map((result) => [result.id, result]),
  )

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))` }}
    >
      {kpis.map((kpi) => {
        const result = kpiResultsMap.get(kpi.id)
        const value = result?.value ?? 0
        const percentage = result?.percentage
        const hasTrend = kpi.trend !== undefined && percentage !== undefined

        return (
          <Card key={kpi.id}>
            <CardContent className="pt-6">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {kpi.label}
              </p>
              <div className="mt-2 text-2xl font-bold">
                <CountAnimation
                  number={value}
                  format={kpi.format}
                  suffix={kpi.format === 'percent' ? '%' : undefined}
                  decimals={kpi.format === 'percent' ? 1 : undefined}
                />
              </div>
              {hasTrend && (
                <div className="mt-1 flex items-center gap-1 text-xs">
                  {percentage >= 0 ? (
                    <TrendingUp className="size-3 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="size-3 text-red-600 dark:text-red-400" />
                  )}
                  <span
                    className={cn(
                      'font-medium',
                      percentage >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {percentage >= 0 ? '+' : ''}
                    {percentage.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">vs last period</span>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
