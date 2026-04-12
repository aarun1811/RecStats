import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar,
  Database,
  Gauge,
  Hash,
  Pencil,
  Settings2,
  Trash2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'motion/react'

import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { CountAnimation } from '@/components/shared/count-animation'
import { useManagedKpi } from '@/hooks/use-managed-kpis'
import {
  computeAggregation,
  getThresholdLevel,
  getTrendSubtitle,
  THRESHOLD_STYLES,
} from '@/lib/kpi-utils'
import { THRESHOLD_BORDER_COLORS } from '@/lib/style-constants'
import { DeleteKpiDialog } from './delete-kpi-dialog'
import type { RecvizDataset } from '@/types/managed-dataset'
import type { FormatNumberOptions } from '@/types/formatting'

interface KpiDetailPanelProps {
  kpiId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  datasetMap: Map<string, { name: string; dataset: RecvizDataset }>
}

export function KpiDetailPanel({
  kpiId,
  open,
  onOpenChange,
  datasetMap,
}: KpiDetailPanelProps) {
  const navigate = useNavigate()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { data: kpi, isLoading: kpiLoading } = useManagedKpi(kpiId)

  const dsEntry = kpi ? datasetMap.get(kpi.datasetId) : undefined
  const dsName = dsEntry?.name ?? 'Unknown'
  const dataset = dsEntry?.dataset

  const { data: rawResult, isLoading: isDataLoading } = useQuery({
    queryKey: ['kpi-detail-value', kpi?.id, kpi?.datasetId],
    queryFn: () =>
      api.post<{ columns: unknown[]; data: Record<string, unknown>[] }>(
        '/api/sql/execute',
        {
          database_id: dataset?.databaseId,
          sql: dataset?.sql,
          limit: 10000,
        },
      ),
    enabled: kpi !== undefined && dataset !== undefined,
    staleTime: 5 * 60 * 1000,
  })

  const computedValue = useMemo(() => {
    if (!kpi || !rawResult?.data?.length) return 0
    const values = rawResult.data
      .map((row) => Number(row[kpi.metricColumn]))
      .filter((v) => !isNaN(v))
    return computeAggregation(values, kpi.aggregation)
  }, [rawResult, kpi])

  const trendDescription =
    getTrendSubtitle(kpi?.config.trend ?? null) || 'Not configured'

  const formatDescription = kpi
    ? kpi.config.format.type +
      (kpi.config.format.currencyCode
        ? ` (${kpi.config.format.currencyCode})`
        : '')
    : ''

  const thresholdLevel = kpi
    ? getThresholdLevel(computedValue, kpi.config.thresholds)
    : 'none'
  const thresholdColor = THRESHOLD_STYLES[thresholdLevel]

  const formatOptions: FormatNumberOptions | undefined = kpi
    ? {
        type: kpi.config.format.type,
        decimals: kpi.config.format.decimals ?? undefined,
        abbreviate: kpi.config.format.abbreviate,
        currencyCode: kpi.config.format.currencyCode ?? undefined,
      }
    : undefined

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            'w-[500px] sm:max-w-[500px] p-0 gap-0 flex flex-col border-l-2',
            kpiLoading || !kpi
              ? 'border-l-muted'
              : THRESHOLD_BORDER_COLORS[thresholdLevel],
          )}
        >
          {kpiLoading ? (
            <div className="space-y-4 p-6">
              <SheetHeader className="sr-only">
                <SheetTitle>Loading KPI</SheetTitle>
                <SheetDescription>Loading KPI details</SheetDescription>
              </SheetHeader>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-[200px] w-full rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : kpi ? (
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex-1 overflow-hidden flex flex-col"
            >
              <div className="flex-1 overflow-y-auto flex flex-col">
                {/* Header */}
                <SheetHeader className="px-6 pt-6 pb-2">
                  <SheetTitle className="text-lg font-semibold truncate pr-8">
                    {kpi.name}
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-1.5 text-xs">
                    <Gauge size={12} className="shrink-0" />
                    KPI
                    <span className="opacity-40">&middot;</span>
                    {dsName}
                  </SheetDescription>
                </SheetHeader>

                {/* Hero KPI value — full-width, no inner card */}
                <div className="mx-6 mt-2 rounded-lg overflow-hidden bg-muted/5">
                  <div className="h-[200px] flex flex-col items-center justify-center relative">
                    {/* Subtle radial glow behind value */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.04)_0%,transparent_70%)]" />

                    {isDataLoading ? (
                      <Skeleton className="h-12 w-36 rounded" />
                    ) : (
                      <div className="relative flex flex-col items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium tracking-wide"
                        >
                          {kpi.aggregation}
                        </Badge>
                        <CountAnimation
                          number={computedValue}
                          duration={0.8}
                          formatOptions={formatOptions}
                          className={cn(
                            'text-5xl font-bold tabular-nums tracking-tighter',
                            thresholdColor,
                          )}
                        />
                        {kpi.config.subtitle && (
                          <p className="text-xs text-muted-foreground">
                            {kpi.config.subtitle}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-6 py-5">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Database className="size-3 text-primary/60" />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Dataset
                      </span>
                    </div>
                    <p className="text-sm truncate">{dsName}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Hash className="size-3 text-primary/60" />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Metric Column
                      </span>
                    </div>
                    <p className="text-sm font-mono truncate">
                      {kpi.metricColumn}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Settings2 className="size-3 text-primary/60" />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Format
                      </span>
                    </div>
                    <p className="text-sm">{formatDescription}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className="size-3 text-primary/60" />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Created
                      </span>
                    </div>
                    <p className="text-sm">
                      {formatDistanceToNow(new Date(kpi.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>

                {/* Trend */}
                <div className="border-t px-6 py-4">
                  <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Trend
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {trendDescription}
                  </p>
                </div>

                {/* Thresholds */}
                <div className="border-t px-6 py-4">
                  <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Thresholds
                  </h4>
                  {kpi.config.thresholds ? (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-green-500" />
                        {`>= ${kpi.config.thresholds.greenAbove}`}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-amber-500" />
                        {`>= ${kpi.config.thresholds.amberAbove}`}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-red-500" />
                        {`< ${kpi.config.thresholds.amberAbove}`}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Not configured
                    </p>
                  )}
                </div>

                {/* Description */}
                {kpi.description && (
                  <div className="border-t px-6 py-4">
                    <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Description
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {kpi.description}
                    </p>
                  </div>
                )}

                {/* Used in Dashboards */}
                <div className="border-t px-6 py-4">
                  <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Used in Dashboards
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Not used in any dashboards yet
                  </p>
                </div>
              </div>

              {/* Fixed bottom bar */}
              <div className="shrink-0 border-t px-6 py-3 flex items-center gap-2">
                <Button
                  className="flex-1 h-9"
                  onClick={() =>
                    navigate({
                      to: '/kpis/$kpiId/edit',
                      params: { kpiId: kpi.id },
                    })
                  }
                >
                  <Pencil className="mr-1.5 size-3.5" />
                  Edit KPI
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  aria-label="Delete KPI"
                  title="Delete KPI"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </motion.div>
          ) : null}
        </SheetContent>
      </Sheet>

      {kpi && (
        <DeleteKpiDialog
          kpiId={kpi.id}
          kpiName={kpi.name}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onDeleted={() => onOpenChange(false)}
        />
      )}
    </>
  )
}
