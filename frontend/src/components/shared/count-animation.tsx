import { useEffect } from 'react'

import { cn } from '@/lib/utils'
import { formatValue } from '@/lib/formatters'
import { motion, useMotionValue, useTransform, animate } from 'motion/react'
import type { FormatNumberOptions } from '@/types/formatting'

interface CountAnimationProps {
  number: number
  className?: string
  duration?: number
  formatOptions?: FormatNumberOptions
  prefix?: string
  suffix?: string
}

export function CountAnimation({
  number: target,
  className,
  duration = 1.5,
  formatOptions = { type: 'number' },
  prefix = '',
  suffix = '',
}: CountAnimationProps) {
  const count = useMotionValue(0)
  const display = useTransform(count, (v) => {
    return `${prefix}${formatValue(v, formatOptions)}${suffix}`
  })

  useEffect(() => {
    const animation = animate(count, target, { duration })
    return animation.stop
  }, [count, target, duration])

  return <motion.span className={cn(className)}>{display}</motion.span>
}

export default CountAnimation
