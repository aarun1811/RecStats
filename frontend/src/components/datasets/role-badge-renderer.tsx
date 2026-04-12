import type { ICellRendererParams } from 'ag-grid-community'

import { cn } from '@/lib/utils'
import { COLUMN_ROLE_STYLES, COLUMN_ROLE_LABELS } from '@/lib/style-constants'

import type { ColumnRole } from '@/types/managed-dataset'
import type { MergedColumn } from '@/lib/column-merge'

export function RoleBadgeRenderer(params: ICellRendererParams<MergedColumn>) {
  const role = params.value as ColumnRole
  if (!role) return null

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold min-w-[60px] justify-center',
      COLUMN_ROLE_STYLES[role],
    )}>
      {COLUMN_ROLE_LABELS[role]}
    </span>
  )
}
