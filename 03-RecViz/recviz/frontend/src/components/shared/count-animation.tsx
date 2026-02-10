import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { motion, useMotionValue, useTransform, animate } from 'motion/react'

interface CountAnimationProps {
  number: number
  className?: string
  duration?: number
  format?: 'number' | 'currency' | 'percent' | 'decimal'
  decimals?: number
  prefix?: string
  suffix?: string
}

const formatNumber = (
  value: number,
  format: CountAnimationProps['format'],
  decimals?: number,
) => {
  switch (format) {
    case 'currency':
      return value.toLocaleString('en-US', {
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 0,
      })
    case 'percent':
      return value.toFixed(decimals ?? 1)
    case 'decimal':
      return value.toFixed(decimals ?? 1)
    default:
      return Math.round(value).toLocaleString()
  }
}

export function CountAnimation({
  number: target,
  className,
  duration = 1.5,
  format = 'number',
  decimals,
  prefix = '',
  suffix = '',
}: CountAnimationProps) {
  const count = useMotionValue(0)
  const display = useTransform(count, (v) => {
    return `${prefix}${formatNumber(v, format, decimals)}${suffix}`
  })

  useEffect(() => {
    const animation = animate(count, target, { duration })
    return animation.stop
  }, [count, target, duration])

  return <motion.span className={cn(className)}>{display}</motion.span>
}

export default CountAnimation
