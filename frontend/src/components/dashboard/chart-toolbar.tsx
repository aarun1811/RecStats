import { Download, Maximize2, RefreshCw, Image, FileImage, FileSpreadsheet, ClipboardCopy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { exportFilename } from '@/lib/chart-export'
import type { ChartRef } from '@/types/chart'

interface ChartToolbarProps {
  chartRef: React.RefObject<ChartRef | null>
  chartTitle: string
  onFullscreen: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
  isInsideFullscreen?: boolean
}

export function ChartToolbar({
  chartRef,
  chartTitle,
  onFullscreen,
  onRefresh,
  isRefreshing,
  isInsideFullscreen,
}: ChartToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 rounded-md bg-background/80 backdrop-blur-sm px-1 py-0.5">
        {/* Export dropdown — no Tooltip wrapper; Radix Tooltip steals focus and kills the dropdown */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 p-0" title="Export chart">
              <Download className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Image</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() =>
                chartRef.current?.downloadImage('png', exportFilename(chartTitle, 'png'))
              }
            >
              <Image className="mr-2 size-4" />
              PNG Image
            </DropdownMenuItem>
            {chartRef.current?.supportsSVG && (
              <DropdownMenuItem
                onClick={() =>
                  chartRef.current?.downloadImage('svg', exportFilename(chartTitle, 'svg'))
                }
              >
                <FileImage className="mr-2 size-4" />
                SVG Image
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Data</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() =>
                chartRef.current?.exportCSV(exportFilename(chartTitle, 'csv'))
              }
            >
              <FileSpreadsheet className="mr-2 size-4" />
              CSV Data
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => chartRef.current?.copyToClipboard()}
            >
              <ClipboardCopy className="mr-2 size-4" />
              Copy to Clipboard
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Fullscreen button (hidden when already in fullscreen) */}
        {!isInsideFullscreen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 p-0"
                onClick={onFullscreen}
              >
                <Maximize2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View fullscreen</TooltipContent>
          </Tooltip>
        )}

        {/* Refresh button */}
        {onRefresh && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 p-0"
                onClick={onRefresh}
              >
                <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh data</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
