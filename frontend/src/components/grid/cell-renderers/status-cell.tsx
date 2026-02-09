import type { CustomCellRendererProps } from 'ag-grid-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusConfig: Record<string, { label: string; className: string }> = {
  open: {
    label: 'Open',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  pending: {
    label: 'Pending',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  escalated: {
    label: 'Escalated',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
}

export function StatusCell(props: CustomCellRendererProps) {
  const value = props.value as string | undefined
  if (!value) return null

  const key = value.toLowerCase()
  const config = statusConfig[key]

  if (!config) {
    return (
      <Badge variant="outline" className="text-xs">
        {value}
      </Badge>
    )
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        'border-none text-xs font-medium',
        config.className,
      )}
    >
      {config.label}
    </Badge>
  )
}
