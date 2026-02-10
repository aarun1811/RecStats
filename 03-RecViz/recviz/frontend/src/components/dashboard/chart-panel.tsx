import { useState, useRef, useCallback } from 'react'
import {
  Download,
  ImageIcon,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  RefreshCw,
  TableIcon,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartFactory } from '@/components/charts/chart-factory'
import type { ChartConfig, ChartDataResponse, ChartClickEvent, ChartSelection } from '@/types/chart'
import { cn } from '@/lib/utils'

interface ChartPanelProps {
  chartId: string
  config: ChartConfig
  data?: ChartDataResponse
  isLoading?: boolean
  error?: Error | null
  onChartClick?: (event: ChartClickEvent) => void
  activeSelection?: ChartSelection
  onRefresh?: () => void
  className?: string
}

export function ChartPanel({
  chartId,
  config,
  data,
  isLoading,
  error,
  onChartClick,
  activeSelection,
  onRefresh,
  className,
}: ChartPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const toggleFullscreen = useCallback(() => {
    if (!panelRef.current) return
    if (!document.fullscreenElement) {
      panelRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  const exportAsPng = useCallback(() => {
    const canvas = panelRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${config.name ?? chartId}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [chartId, config.name])

  const exportAsCsv = useCallback(() => {
    if (!data?.columns || !data?.data) return
    const header = data.columns.join(',')
    const rows = data.data.map((row) =>
      data.columns.map((col) => {
        const val = row[col]
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`
        return String(val ?? '')
      }).join(','),
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const link = document.createElement('a')
    link.download = `${config.name ?? chartId}.csv`
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }, [data, chartId, config.name])

  const copyToClipboard = useCallback(() => {
    if (!data?.columns || !data?.data) return
    const header = data.columns.join('\t')
    const rows = data.data.map((row) =>
      data.columns.map((col) => String(row[col] ?? '')).join('\t'),
    )
    const text = [header, ...rows].join('\n')
    navigator.clipboard.writeText(text)
  }, [data])

  return (
    <Card
      ref={panelRef}
      className={cn(
        'flex flex-col',
        isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-sm font-medium">{config.name}</CardTitle>
          {config.description && (
            <CardDescription className="text-xs">
              {config.description}
            </CardDescription>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7">
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportAsPng}>
                <ImageIcon className="mr-2 size-4" />
                Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportAsCsv}>
                <TableIcon className="mr-2 size-4" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyToClipboard}>
                <Download className="mr-2 size-4" />
                Copy to clipboard
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-3 pb-0">
        <ChartFactory
          chartId={chartId}
          config={config}
          data={data}
          isLoading={isLoading}
          error={error}
          onChartClick={onChartClick}
          activeSelection={activeSelection}
          className={isFullscreen ? 'h-[calc(100vh-140px)]' : undefined}
        />
      </CardContent>

      <CardFooter className="px-4 py-2">
        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
          <span>
            {data?.rowCount != null
              ? `${data.rowCount.toLocaleString()} rows`
              : '\u00A0'}
          </span>
          <span>Dataset #{config.datasourceId}</span>
        </div>
      </CardFooter>
    </Card>
  )
}

export function ChartPanelSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-1 h-3 w-48" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="size-7" />
          <Skeleton className="size-7" />
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-0">
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </CardContent>
      <CardFooter className="px-4 py-2">
        <Skeleton className="h-3 w-20" />
      </CardFooter>
    </Card>
  )
}
