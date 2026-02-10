import type { CustomCellRendererProps } from 'ag-grid-react'
import { CheckCircle2, XCircle } from 'lucide-react'

export function SlaCell({ value }: CustomCellRendererProps) {
  if (value == null) return null
  const breached = Boolean(value)
  return breached ? (
    <XCircle className="size-4 text-destructive" />
  ) : (
    <CheckCircle2 className="size-4 text-emerald-500" />
  )
}
