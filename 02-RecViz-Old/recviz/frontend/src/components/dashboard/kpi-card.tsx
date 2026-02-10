import { useEffect, useRef, useState } from 'react'

import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatNumber, formatPercent, formatCurrency } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: number
  previousValue: number
  format: 'number' | 'percent' | 'currency' | 'days'
  invertTrend?: boolean
  loading?: boolean
  index?: number
}

function useAnimatedCounter(target: number, duration = 800) {
  const [current, setCurrent] = useState(0)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const from = 0

    function animate(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(from + (target - from) * eased)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [target, duration])

  return current
}

function formatValue(value: number, format: KpiCardProps['format']): string {
  switch (format) {
    case 'number':
      return formatNumber(Math.round(value))
    case 'percent':
      return formatPercent(value)
    case 'currency':
      return formatCurrency(value)
    case 'days':
      return `${value.toFixed(1)}d`
  }
}

function computeTrend(value: number, previousValue: number) {
  if (previousValue === 0) return { percentage: 0, direction: 'up' as const }
  const change = ((value - previousValue) / previousValue) * 100
  return {
    percentage: Math.abs(change),
    direction: change >= 0 ? ('up' as const) : ('down' as const),
  }
}

export function KpiCard({
  title,
  value,
  previousValue,
  format,
  invertTrend = false,
  loading = false,
  index = 0,
}: KpiCardProps) {
  const animatedValue = useAnimatedCounter(loading ? 0 : value)
  const trend = computeTrend(value, previousValue)
  const isPositive = invertTrend
    ? trend.direction === 'down'
    : trend.direction === 'up'

  if (loading) {
    return (
      <Card className="min-h-[100px]">
        <CardContent className="p-6">
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="mb-2 h-9 w-32" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
      <Card className="min-h-[100px] transition-shadow hover:shadow-md">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {formatValue(animatedValue, format)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <span
              className={cn(
                'flex items-center gap-0.5 font-medium',
                isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )}
            >
              {trend.direction === 'up' ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" />
              )}
              {trend.percentage.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs prior period</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
