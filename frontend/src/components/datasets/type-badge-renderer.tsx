import type { ICellRendererParams } from 'ag-grid-community'

import { cn } from '@/lib/utils'
import { COLUMN_TYPE_STYLES, COLUMN_TYPE_LABELS } from '@/lib/style-constants'

import type { ColumnDataType } from '@/types/managed-dataset'
import type { MergedColumn } from '@/lib/column-merge'

export function TypeBadgeRenderer(params: ICellRendererParams<MergedColumn>) {
  const dataType = params.value as ColumnDataType
  if (!dataType) return null

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-px rounded-full text-[10px] font-semibold',
      COLUMN_TYPE_STYLES[dataType],
    )}>
      {COLUMN_TYPE_LABELS[dataType]}
    </span>
  )
}
