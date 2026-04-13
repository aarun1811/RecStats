import { useCallback, useEffect, useState } from 'react'

import {
  AlertTriangle,
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
import type { BuilderItem, BuilderChartRef, BuilderGridRef } from '@/types/builder'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PanelConfigPopoverProps {
  item: BuilderItem
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

/** Snapshot of editable fields — used for cancel/revert. */
interface ChartDraft {
  title: string
  crossFilter: boolean
  drillHierarchy: string[]
  drillDetailDataSourceId: string | null
  refreshInterval: number | null
}

interface GridDraft {
  title: string
  rowLimit: number
  defaultSortColumn: string | null
  defaultSortDirection: 'asc' | 'desc'
}

type KpiDraft = { title: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function snapshotChart(chart: BuilderChartRef): ChartDraft {
  return {
    title: chart.title,
    crossFilter: chart.crossFilter,
    drillHierarchy: [...chart.drillHierarchy],
    drillDetailDataSourceId: chart.drillDetailDataSourceId,
    refreshInterval: chart.refreshInterval,
  }
}

function snapshotGrid(grid: BuilderGridRef): GridDraft {
  return {
    title: grid.title,
    rowLimit: grid.rowLimit,
    defaultSortColumn: grid.defaultSortColumn,
    defaultSortDirection: grid.defaultSortDirection,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Panel configuration dialog with explicit Apply / Cancel semantics.
 *
 * - Edits are made to local draft state, NOT the builder store.
 * - **Apply** commits the draft to the store (marks dashboard dirty).
 * - **Cancel** (or closing the dialog) reverts to the snapshot taken on open.
 * - **Open in Builder** shows a confirmation before navigating away.
 */
export function PanelConfigPopover({
  item,
  open,
  onOpenChange,
  children,
}: PanelConfigPopoverProps) {
  const navigate = useNavigate()
  const updateItemConfig = useBuilderStore((s) => s.updateItemConfig)

  const meta = PANEL_TYPE_META[item.type] ?? PANEL_TYPE_META.chart
  const TypeIcon = meta.icon

  // ── Local draft state (not committed until Apply) ──

  const [chartDraft, setChartDraft] = useState<ChartDraft | null>(null)
  const [gridDraft, setGridDraft] = useState<GridDraft | null>(null)
  const [kpiDraft, setKpiDraft] = useState<KpiDraft | null>(null)
  const [showNavConfirm, setShowNavConfirm] = useState(false)

  // Snapshot on open
  useEffect(() => {
    if (!open) return
    if (item.type === 'chart' && item.chart) {
      setChartDraft(snapshotChart(item.chart))
    } else if (item.type === 'grid' && item.grid) {
      setGridDraft(snapshotGrid(item.grid))
    } else if (item.type === 'kpi' && item.kpi) {
      setKpiDraft({ title: item.kpi.title })
    }
    setShowNavConfirm(false)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Convenience: current title from whichever draft is active
  const draftTitle =
    chartDraft?.title ?? gridDraft?.title ?? kpiDraft?.title ?? ''

  const setDraftTitle = useCallback((t: string) => {
    setChartDraft((d) => d ? { ...d, title: t } : d)
    setGridDraft((d) => d ? { ...d, title: t } : d)
    setKpiDraft((d) => d ? { ...d, title: t } : d)
  }, [])

  // ── Actions ──

  const handleApply = useCallback(() => {
    if (item.type === 'chart' && chartDraft) {
      updateItemConfig(item.id, chartDraft)
    } else if (item.type === 'grid' && gridDraft) {
      updateItemConfig(item.id, gridDraft)
    } else if (item.type === 'kpi' && kpiDraft) {
      updateItemConfig(item.id, kpiDraft)
    }
    onOpenChange(false)
  }, [item, chartDraft, gridDraft, kpiDraft, updateItemConfig, onOpenChange])

  const handleCancel = useCallback(() => {
    // Just close — draft is discarded, store untouched
    onOpenChange(false)
  }, [onOpenChange])

  const handleNavigateToBuilder = useCallback(() => {
    setShowNavConfirm(true)
  }, [])

  const confirmNavigate = useCallback(() => {
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
  }, [item, navigate])

  return (
    <>
      {children}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
        <DialogContent className="sm:max-w-[640px] gap-0 p-0 overflow-hidden" onInteractOutside={(e) => e.preventDefault()}>

          {/* ── Navigation confirmation overlay ── */}
          {showNavConfirm && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
              <div className="flex flex-col items-center gap-3 px-8 text-center">
                <div className="flex items-center justify-center size-10 rounded-full bg-amber-500/10">
                  <AlertTriangle className="size-5 text-amber-500" />
                </div>
                <p className="text-sm font-medium">Leave Dashboard Builder?</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  You&apos;ll navigate to the {meta.label} Builder. Any unsaved changes to this dashboard will be lost.
                </p>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowNavConfirm(false)}
                  >
                    Stay Here
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-xs"
                    onClick={confirmNavigate}
                  >
                    Leave Builder
                  </Button>
                </div>
              </div>
            </div>
          )}

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
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Panel title"
                className="h-8 text-sm bg-muted/30 border-border/50 focus-visible:bg-background"
              />
            </Section>

            {/* ── Chart-specific ── */}
            {item.type === 'chart' && chartDraft && (
              <>
                <Separator className="opacity-50" />

                <Section
                  icon={Filter}
                  title="Cross-filtering"
                  hint="When enabled, clicking a data point on this chart filters other charts and KPIs on the dashboard."
                >
                  <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                    <span className="text-sm text-foreground">
                      {chartDraft.crossFilter ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={chartDraft.crossFilter}
                      onCheckedChange={(checked) =>
                        setChartDraft((d) => d ? { ...d, crossFilter: checked } : d)
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
                    datasetId={item.chart!.datasetId}
                    hierarchy={chartDraft.drillHierarchy}
                    drillDetailDataSourceId={chartDraft.drillDetailDataSourceId}
                    onHierarchyChange={(h) =>
                      setChartDraft((d) => d ? { ...d, drillHierarchy: h } : d)
                    }
                    onDetailDataSourceChange={(id) =>
                      setChartDraft((d) => d ? { ...d, drillDetailDataSourceId: id } : d)
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
                    value={String(chartDraft.refreshInterval ?? 'none')}
                    onValueChange={(v) =>
                      setChartDraft((d) => d ? {
                        ...d,
                        refreshInterval: v === 'none' ? null : Number(v),
                      } : d)
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
            {item.type === 'grid' && gridDraft && (
              <>
                <Separator className="opacity-50" />

                <Section
                  icon={Table2}
                  title="Row Limit"
                  hint="Maximum rows fetched from the database for this grid panel."
                >
                  <Select
                    value={String(gridDraft.rowLimit)}
                    onValueChange={(v) =>
                      setGridDraft((d) => d ? { ...d, rowLimit: Number(v) } : d)
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
                      value={gridDraft.defaultSortColumn ?? ''}
                      onChange={(e) =>
                        setGridDraft((d) => d ? {
                          ...d,
                          defaultSortColumn: e.target.value || null,
                        } : d)
                      }
                      placeholder="Column name"
                      className="h-8 text-sm flex-1 bg-muted/30 border-border/50 focus-visible:bg-background"
                    />
                    <Select
                      value={gridDraft.defaultSortDirection}
                      onValueChange={(v) =>
                        setGridDraft((d) => d ? {
                          ...d,
                          defaultSortDirection: v as 'asc' | 'desc',
                        } : d)
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
          <Separator />
          <div className="px-5 py-3 flex items-center justify-between gap-2">
            {/* Left: Open in Builder (charts/KPIs only) */}
            {(item.type === 'chart' || item.type === 'kpi') ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 text-muted-foreground"
                onClick={handleNavigateToBuilder}
              >
                <Pencil className="mr-1.5 size-3" />
                Open in {meta.label} Builder
              </Button>
            ) : (
              <div />
            )}

            {/* Right: Cancel + Apply */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs h-8 shadow-sm shadow-primary/20"
                onClick={handleApply}
              >
                Apply Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
