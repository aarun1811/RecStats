import type { CustomCellRendererProps } from 'ag-grid-react'
import { Badge } from '@/components/ui/badge'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Open: 'outline',
  Resolved: 'default',
  Investigating: 'secondary',
  Escalated: 'destructive',
}

export function StatusCell({ value }: CustomCellRendererProps) {
  if (!value) return null
  const variant = STATUS_VARIANT[value as string] ?? 'outline'
  return <Badge variant={variant}>{value as string}</Badge>
}
