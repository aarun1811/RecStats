import { useCallback } from 'react'

import { Pencil } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DrillHierarchyEditor } from '@/components/builder/drill-hierarchy-editor'
import { useBuilderStore } from '@/stores/builder-store'
import type { BuilderItem } from '@/types/builder'

interface PanelConfigPopoverProps {
  item: BuilderItem
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

/**
 * Panel configuration dialog — centered modal matching the global filter
 * configuration pattern.
 *
 * Previously a Popover, but Radix Popover mis-positions inside
 * react-grid-layout's CSS transform context (top: -800px bug).
 * Dialog uses fixed centered positioning and avoids this entirely.
 *
 * The `children` prop (trigger button) is rendered inline — the Dialog
 * is controlled via the `open` / `onOpenChange` props from the parent.
 */
export function PanelConfigPopover({
  item,
  open,
  onOpenChange,
  children,
}: PanelConfigPopoverProps) {
  const navigate = useNavigate()
  const updateItemConfig = useBuilderStore((s) => s.updateItemConfig)

  const title =
    item.chart?.title ?? item.kpi?.title ?? item.grid?.title ?? ''

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      updateItemConfig(item.id, { title: newTitle })
    },
    [item.id, updateItemConfig],
  )

  return (
    <>
      {children}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Panel Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Common: Title override */}
            <div>
              <Label className="text-xs font-medium uppercase text-muted-foreground">
                Title
              </Label>
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Panel title"
                className="mt-1 h-8 text-sm"
              />
            </div>

            {/* Chart-specific sections */}
            {item.type === 'chart' && item.chart && (
              <>
                {/* Cross-filter toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">
                    Cross-filtering
                  </Label>
                  <Switch
                    checked={item.chart.crossFilter}
                    onCheckedChange={(checked) =>
                      updateItemConfig(item.id, { crossFilter: checked })
                    }
                  />
                </div>

                {/* Drill hierarchy (D-27 column picker) */}
                <DrillHierarchyEditor
                  datasetId={item.chart.datasetId}
                  hierarchy={item.chart.drillHierarchy}
                  drillDetailDataSourceId={
                    item.chart.drillDetailDataSourceId
                  }
                  onHierarchyChange={(h) =>
                    updateItemConfig(item.id, { drillHierarchy: h })
                  }
                  onDetailDataSourceChange={(id) =>
                    updateItemConfig(item.id, {
                      drillDetailDataSourceId: id,
                    })
                  }
                />

                {/* Refresh interval */}
                <div>
                  <Label className="text-xs font-medium uppercase text-muted-foreground">
                    Refresh Interval
                  </Label>
                  <Select
                    value={String(item.chart.refreshInterval ?? 'none')}
                    onValueChange={(v) =>
                      updateItemConfig(item.id, {
                        refreshInterval: v === 'none' ? null : Number(v),
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="60000">1 minute</SelectItem>
                      <SelectItem value="300000">5 minutes</SelectItem>
                      <SelectItem value="600000">10 minutes</SelectItem>
                      <SelectItem value="1800000">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Open in Chart Builder */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full text-xs"
                  onClick={() =>
                    navigate({
                      to: '/charts/$chartId/edit',
                      params: { chartId: item.chart!.chartId },
                    })
                  }
                >
                  <Pencil className="mr-1.5 size-3" />
                  Open in Chart Builder
                </Button>
              </>
            )}

            {/* KPI-specific sections */}
            {item.type === 'kpi' && item.kpi && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 w-full text-xs"
                onClick={() =>
                  navigate({
                    to: '/kpis/$kpiId/edit',
                    params: { kpiId: item.kpi!.kpiId },
                  })
                }
              >
                <Pencil className="mr-1.5 size-3" />
                Open in KPI Builder
              </Button>
            )}

            {/* Grid-specific sections */}
            {item.type === 'grid' && item.grid && (
              <>
                {/* Row limit */}
                <div>
                  <Label className="text-xs font-medium uppercase text-muted-foreground">
                    Row Limit
                  </Label>
                  <Select
                    value={String(item.grid.rowLimit)}
                    onValueChange={(v) =>
                      updateItemConfig(item.id, { rowLimit: Number(v) })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 rows</SelectItem>
                      <SelectItem value="100">100 rows</SelectItem>
                      <SelectItem value="500">500 rows</SelectItem>
                      <SelectItem value="1000">1000 rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Default sort column */}
                <div>
                  <Label className="text-xs font-medium uppercase text-muted-foreground">
                    Default Sort Column
                  </Label>
                  <Input
                    value={item.grid.defaultSortColumn ?? ''}
                    onChange={(e) =>
                      updateItemConfig(item.id, {
                        defaultSortColumn: e.target.value || null,
                      })
                    }
                    placeholder="Column name"
                    className="mt-1 h-8 text-sm"
                  />
                </div>

                {/* Default sort direction */}
                <div>
                  <Label className="text-xs font-medium uppercase text-muted-foreground">
                    Sort Direction
                  </Label>
                  <Select
                    value={item.grid.defaultSortDirection}
                    onValueChange={(v) =>
                      updateItemConfig(item.id, {
                        defaultSortDirection: v as 'asc' | 'desc',
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
