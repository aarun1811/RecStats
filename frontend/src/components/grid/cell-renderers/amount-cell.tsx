import type { CustomCellRendererProps } from 'ag-grid-react'

import { cn } from '@/lib/utils'
import { formatValue } from '@/lib/formatters'

export function AmountCell({ value, data }: CustomCellRendererProps) {
  if (value == null) return null
  const num = Number(value)
  const currency = data?.currency as string | undefined
  const formatted = formatValue(Math.abs(num), {
    type: 'currency',
    currencyCode: currency,
    decimals: 2,
  })

  return (
    <span className={cn('tabular-nums', num < 0 && 'text-destructive')}>
      {num < 0 ? `-${formatted}` : formatted}
    </span>
  )
}
