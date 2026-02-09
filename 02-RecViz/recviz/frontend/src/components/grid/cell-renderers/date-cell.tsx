import { format, formatDistanceToNow, parseISO } from 'date-fns'
import type { CustomCellRendererProps } from 'ag-grid-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DateCellParams {
  dateFormat?: string
  showRelative?: boolean
}

export function DateCell(props: CustomCellRendererProps<unknown, string | Date> & DateCellParams) {
  const raw = props.value
  if (!raw) return null

  const date = typeof raw === 'string' ? parseISO(raw) : raw
  const dateFormat = props.dateFormat ?? 'MMM d, yyyy'
  const formatted = format(date, dateFormat)
  const fullDateTime = format(date, 'PPpp')

  if (props.showRelative) {
    const relative = formatDistanceToNow(date, { addSuffix: true })
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default text-muted-foreground text-[13px]">
              {relative}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{fullDateTime}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default text-[13px]">{formatted}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{fullDateTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
