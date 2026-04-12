import type { IHeaderParams } from 'ag-grid-community'
import { Info } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const HEADER_TOOLTIPS: Record<string, string> = {
  Type: 'Data type determines how values are parsed and formatted. Affects chart axis behavior.',
  Role: 'Column role controls how the field is used in charts: dimensions group data, measures are aggregated.',
  Aggregation: 'Default aggregation function applied when this column is used as a measure in charts.',
  Format: 'Display format applied to cell values in grids and chart tooltips.',
}

interface ColumnHeaderWithTooltipProps extends IHeaderParams {
  tooltipField?: string
}

export function ColumnHeaderWithTooltip(params: ColumnHeaderWithTooltipProps) {
  const headerName = params.displayName
  const tooltipText = HEADER_TOOLTIPS[params.tooltipField ?? headerName]

  return (
    <div className="flex items-center gap-1">
      <span>{headerName}</span>
      {tooltipText && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="size-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[250px]">
              <p className="text-xs">{tooltipText}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
