import type { CustomCellRendererProps } from 'ag-grid-react'

import { cn } from '@/lib/utils'
import { formatCurrency, formatCompactNumber } from '@/lib/utils'

interface AmountCellParams {
  format?: 'currency' | 'compact' | 'raw'
  currency?: string
}

export function AmountCell(props: CustomCellRendererProps<unknown, number> & AmountCellParams) {
  const value = props.value
  if (value == null) return null

  const format = props.format ?? 'currency'
  const isNegative = value < 0

  let formatted: string
  switch (format) {
    case 'currency':
      formatted = formatCurrency(value, props.currency)
      break
    case 'compact':
      formatted = formatCompactNumber(value)
      break
    case 'raw':
      formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
      break
  }

  return (
    <span
      className={cn(
        'tabular-nums text-right block w-full font-mono text-[13px]',
        isNegative && 'text-red-600 dark:text-red-400',
      )}
    >
      {formatted}
    </span>
  )
}
