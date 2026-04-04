import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CountAnimation } from '@/components/shared/count-animation'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: number
  icon: LucideIcon
  format?: 'number' | 'currency' | 'percent' | 'decimal'
  decimals?: number
  prefix?: string
  suffix?: string
  trend?: {
    value: number
    isPositive: boolean
  }
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  format = 'number',
  decimals,
  prefix,
  suffix,
  trend,
}: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          <CountAnimation
            number={value}
            format={format}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
          />
        </div>
        {trend && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            {trend.isPositive ? (
              <TrendingUp className="size-3 text-green-600" />
            ) : (
              <TrendingDown className="size-3 text-red-600" />
            )}
            <span
              className={cn(
                'font-medium',
                trend.isPositive ? 'text-green-600' : 'text-red-600',
              )}
            >
              {trend.isPositive ? '+' : ''}
              {trend.value}%
            </span>
            <span className="text-muted-foreground">vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function KpiCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-3 w-20" />
      </CardContent>
    </Card>
  )
}
