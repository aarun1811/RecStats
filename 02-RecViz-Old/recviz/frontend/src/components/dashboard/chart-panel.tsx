import { useState } from 'react'

import { Download, Expand, Image, RefreshCw, Table } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChartConfig, ChartClickEvent } from '@/types/chart'

interface ChartPanelProps {
  chartConfig: ChartConfig
  loading?: boolean
  lastUpdated?: Date
  onNodeClick?: (event: ChartClickEvent) => void
  onRefresh?: () => void
  children?: React.ReactNode
}

export function ChartPanel({
  chartConfig,
  loading = false,
  lastUpdated,
  onNodeClick: _onNodeClick,
  onRefresh,
  children,
}: ChartPanelProps) {
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <>
      <Card className="flex min-h-[300px] flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-semibold">{chartConfig.title}</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRefresh}
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setFullscreen(true)}
              title="Fullscreen"
            >
              <Expand className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Export"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Image className="mr-2 h-4 w-4" />
                  Export PNG
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Table className="mr-2 h-4 w-4" />
                  Export CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-6 pt-0">
          {loading ? (
            <div className="flex h-full flex-col gap-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="flex-1" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : children ? (
            children
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Chart: {chartConfig.type} ({chartConfig.library})
            </div>
          )}
        </CardContent>
        {lastUpdated && (
          <CardFooter className="border-t px-6 py-2">
            <p className="text-xs text-muted-foreground">
              Last updated{' '}
              {lastUpdated.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </CardFooter>
        )}
      </Card>

      {/* Fullscreen Dialog */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="h-[85vh] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>{chartConfig.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {children ?? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Chart: {chartConfig.type} ({chartConfig.library})
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
