import { useCallback } from 'react'

import {
  ArrowDownUp,
  BarChart3,
  Filter,
  Gauge,
  Layers,
  Pencil,
  RefreshCw,
  Table2,
  Type,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { DrillHierarchyEditor } from '@/components/builder/drill-hierarchy-editor'
import { useBuilderStore } from '@/stores/builder-store'
import type { BuilderItem } from '@/types/builder'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PanelConfigPopoverProps {
  item: BuilderItem
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

const PANEL_TYPE_META: Record<string, { icon: typeof BarChart3; label: string }> = {
  chart: { icon: BarChart3, label: 'Chart' },
  kpi: { icon: Gauge, label: 'KPI' },
  grid: { icon: Table2, label: 'Data Grid' },
}

interface SectionProps {
  icon: typeof BarChart3
  title: string
  hint: string
  children: React.ReactNode
  className?: string
}

function Section({ icon: Icon, title, hint, children, className }: SectionProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center size-5 rounded bg-primary/10">
          <Icon className="size-3 text-primary" />
        </div>
        <span className="text-xs font-semibold tracking-wide uppercase text-foreground">
          {title}
        </span>
      </div>
      {children}
      <p className="text-[11px] leading-relaxed text-muted-foreground/70">
        {hint}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  const meta = PANEL_TYPE_META[item.type] ?? PANEL_TYPE_META.chart
  const TypeIcon = meta.icon

  return (
    <>
      {children}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[640px] gap-0 p-0 overflow-hidden">
          {/* ── Header ── */}
          <DialogHeader className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 border border-primary/20">
                <TypeIcon className="size-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold">
                  Panel Settings
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Configure {meta.label.toLowerCase()} panel behavior
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Separator />

          {/* ── Body ── */}
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Title — always shown */}
            <Section
              icon={Type}
              title="Display"
              hint="Override the panel's display title on this dashboard."
            >
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Panel title"
                className="h-8 text-sm bg-muted/30 border-border/50 focus-visible:bg-background"
              />
            </Section>

            {/* ── Chart-specific ── */}
            {item.type === 'chart' && item.chart && (
              <>
                <Separator className="opacity-50" />

                <Section
                  icon={Filter}
                  title="Cross-filtering"
                  hint="When enabled, clicking a data point on this chart filters other charts and KPIs on the dashboard."
                >
                  <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                    <span className="text-sm text-foreground">
                      {item.chart.crossFilter ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={item.chart.crossFilter}
                      onCheckedChange={(checked) =>
                        updateItemConfig(item.id, { crossFilter: checked })
                      }
                    />
                  </div>
                </Section>

                <Separator className="opacity-50" />

                <Section
                  icon={Layers}
                  title="Drill-down"
                  hint="Define columns users can drill into, from summary to detail. The detail data source provides the row-level grid at the deepest level."
                >
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
                </Section>

                <Separator className="opacity-50" />

                <Section
                  icon={RefreshCw}
                  title="Refresh"
                  hint="Auto-refresh this chart independently of the dashboard-level refresh."
                >
                  <Select
                    value={String(item.chart.refreshInterval ?? 'none')}
                    onValueChange={(v) =>
                      updateItemConfig(item.id, {
                        refreshInterval: v === 'none' ? null : Number(v),
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm bg-muted/30 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="60000">Every 1 minute</SelectItem>
                      <SelectItem value="300000">Every 5 minutes</SelectItem>
                      <SelectItem value="600000">Every 10 minutes</SelectItem>
                      <SelectItem value="1800000">Every 30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </Section>
              </>
            )}

            {/* ── Grid-specific ── */}
            {item.type === 'grid' && item.grid && (
              <>
                <Separator className="opacity-50" />

                <Section
                  icon={Table2}
                  title="Row Limit"
                  hint="Maximum rows fetched from the database for this grid panel."
                >
                  <Select
                    value={String(item.grid.rowLimit)}
                    onValueChange={(v) =>
                      updateItemConfig(item.id, { rowLimit: Number(v) })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm bg-muted/30 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 rows</SelectItem>
                      <SelectItem value="100">100 rows</SelectItem>
                      <SelectItem value="500">500 rows</SelectItem>
                      <SelectItem value="1000">1,000 rows</SelectItem>
                    </SelectContent>
                  </Select>
                </Section>

                <Separator className="opacity-50" />

                <Section
                  icon={ArrowDownUp}
                  title="Default Sort"
                  hint="Column to sort by when the grid first loads. Users can change this by clicking column headers."
                >
                  <div className="flex gap-2">
                    <Input
                      value={item.grid.defaultSortColumn ?? ''}
                      onChange={(e) =>
                        updateItemConfig(item.id, {
                          defaultSortColumn: e.target.value || null,
                        })
                      }
                      placeholder="Column name"
                      className="h-8 text-sm flex-1 bg-muted/30 border-border/50 focus-visible:bg-background"
                    />
                    <Select
                      value={item.grid.defaultSortDirection}
                      onValueChange={(v) =>
                        updateItemConfig(item.id, {
                          defaultSortDirection: v as 'asc' | 'desc',
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm w-28 bg-muted/30 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">A → Z</SelectItem>
                        <SelectItem value="desc">Z → A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Section>
              </>
            )}
          </div>

          {/* ── Footer ── */}
          {(item.type === 'chart' || item.type === 'kpi') && (
            <>
              <Separator />
              <div className="px-5 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={() => {
                    if (item.type === 'chart' && item.chart) {
                      navigate({
                        to: '/charts/$chartId/edit',
                        params: { chartId: item.chart.chartId },
                      })
                    } else if (item.type === 'kpi' && item.kpi) {
                      navigate({
                        to: '/kpis/$kpiId/edit',
                        params: { kpiId: item.kpi.kpiId },
                      })
                    }
                  }}
                >
                  <Pencil className="mr-1.5 size-3" />
                  Open in {meta.label} Builder
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
