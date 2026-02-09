import { useEffect, useRef } from 'react'

import { useSpring, useMotionValue, useReducedMotion, motion } from 'framer-motion'

import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatCompactNumber,
} from '@/lib/utils'

type CounterFormat = 'number' | 'percent' | 'currency' | 'compact'

interface AnimatedCounterProps {
  value: number
  duration?: number
  format?: CounterFormat
  className?: string
}

const formatters: Record<CounterFormat, (n: number) => string> = {
  number: formatNumber,
  percent: formatPercent,
  currency: formatCurrency,
  compact: formatCompactNumber,
}

export function AnimatedCounter({
  value,
  duration = 1000,
  format = 'number',
  className,
}: AnimatedCounterProps) {
  const prefersReducedMotion = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)

  const springValue = useSpring(motionValue, {
    duration: prefersReducedMotion ? 0 : duration,
    bounce: 0,
  })

  useEffect(() => {
    motionValue.set(value)
  }, [motionValue, value])

  useEffect(() => {
    const formatter = formatters[format]
    const unsubscribe = springValue.on('change', (latest: number) => {
      if (ref.current) {
        ref.current.textContent = formatter(latest)
      }
    })
    return unsubscribe
  }, [springValue, format])

  const formatter = formatters[format]

  return (
    <motion.span ref={ref} className={className}>
      {formatter(value)}
    </motion.span>
  )
}
