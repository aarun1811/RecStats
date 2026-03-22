import type { CustomCellRendererProps } from 'ag-grid-react'
import { cn } from '@/lib/utils'

export function AmountCell({ value, data }: CustomCellRendererProps) {
  if (value == null) return null
  const num = Number(value)
  const currency = (data?.currency as string) ?? 'USD'
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num))

  return (
    <span className={cn('tabular-nums', num < 0 && 'text-destructive')}>
      {num < 0 ? `-${formatted}` : formatted}
    </span>
  )
}
