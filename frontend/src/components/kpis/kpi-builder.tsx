import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateKpi, useUpdateKpi, useDeleteKpi } from '@/hooks/use-managed-kpis'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StepDataset } from './builder/step-dataset'
import { StepColumn } from './builder/step-column'
import { StepFormat } from './builder/step-format'
import { StepTrend } from './builder/step-trend'
import { StepThresholds } from './builder/step-thresholds'
import { KpiBuilderPreview } from './kpi-builder-preview'
import type { RecvizKpi, AggregationType, KpiFormatConfig, TrendConfig, ThresholdConfig } from '@/types/managed-kpi'
import type { RecvizDataset } from '@/types/managed-dataset'

interface BuilderState {
  datasetId: string | null
  dataset: RecvizDataset | null
  metricColumn: string | null
  aggregation: AggregationType
  format: KpiFormatConfig
  trend: TrendConfig | null
  thresholds: ThresholdConfig | null
  subtitle: string
  name: string
  description: string
}

const DEFAULT_FORMAT: KpiFormatConfig = {
  type: 'number',
  decimals: null,
  abbreviate: true,
  currencyCode: null,
}

function isKpiComplete(state: BuilderState): boolean {
  return (
    state.datasetId !== null &&
    state.metricColumn !== null &&
    state.name.trim().length > 0
  )
}

function createInitialState(
  editKpi?: RecvizKpi | null,
  editDataset?: RecvizDataset | null,
): BuilderState {
  if (editKpi) {
    return {
      datasetId: editKpi.datasetId,
      dataset: editDataset ?? null,
      metricColumn: editKpi.metricColumn,
      aggregation: editKpi.aggregation,
      format: editKpi.config.format,
      trend: editKpi.config.trend,
      thresholds: editKpi.config.thresholds,
      subtitle: editKpi.config.subtitle,
      name: editKpi.name,
      description: editKpi.description,
    }
  }
  return {
    datasetId: null,
    dataset: null,
    metricColumn: null,
    aggregation: 'SUM',
    format: DEFAULT_FORMAT,
    trend: null,
    thresholds: null,
    subtitle: '',
    name: '',
    description: '',
  }
}

interface KpiBuilderProps {
  editKpi?: RecvizKpi | null
  editDataset?: RecvizDataset | null
  isLoading?: boolean
}

export function KpiBuilder({ editKpi, editDataset, isLoading }: KpiBuilderProps) {
  const navigate = useNavigate()
  const createKpi = useCreateKpi()
  const updateKpi = useUpdateKpi()
  const deleteKpi = useDeleteKpi()

  const [state, setState] = useState<BuilderState>(() =>
    createInitialState(editKpi, editDataset),
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editInitialized, setEditInitialized] = useState(false)

  // Re-initialize state when editKpi finishes loading (async)
  useEffect(() => {
    if (editKpi && !editInitialized) {
      setState(createInitialState(editKpi, editDataset))
      setEditInitialized(true)
    }
  }, [editKpi, editDataset, editInitialized])

  // Sync dataset when editDataset loads after editKpi
  useEffect(() => {
    if (editDataset && editKpi && !state.dataset) {
      setState((prev) => ({ ...prev, dataset: editDataset }))
    }
  }, [editDataset, editKpi, state.dataset])

  function handleDatasetSelect(dataset: RecvizDataset) {
    const isChange = state.datasetId !== dataset.id
    setState((prev) => ({
      ...prev,
      datasetId: dataset.id,
      dataset,
      ...(isChange ? { metricColumn: null } : {}),
    }))
  }

  async function handleSave() {
    if (!state.datasetId || !state.metricColumn) return

    const config = {
      format: state.format,
      trend: state.trend,
      thresholds: state.thresholds,
      subtitle: state.subtitle,
    }

    try {
      if (editKpi) {
        await updateKpi.mutateAsync({
          id: editKpi.id,
          data: {
            name: state.name,
            description: state.description,
            metricColumn: state.metricColumn,
            aggregation: state.aggregation,
            config,
          },
        })
        toast.success('KPI saved')
        navigate({ to: '/kpis' })
      } else {
        await createKpi.mutateAsync({
          name: state.name,
          description: state.description,
          datasetId: state.datasetId,
          metricColumn: state.metricColumn,
          aggregation: state.aggregation,
          config,
        })
        toast.success('KPI saved')
        navigate({ to: '/kpis' })
      }
    } catch {
      toast.error('Failed to save KPI')
    }
  }

  function handleDelete() {
    if (!editKpi) return
    deleteKpi.mutate(editKpi.id, {
      onSuccess: () => {
        toast.success('KPI deleted')
        navigate({ to: '/kpis' })
      },
    })
  }

  const isSaving = createKpi.isPending || updateKpi.isPending
  const kpiComplete = isKpiComplete(state)
  const isEditMode = editKpi !== null && editKpi !== undefined

  // Loading skeleton (edit mode)
  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <div className="px-6 pt-4 pb-4 shrink-0 space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-96" />
        </div>
        <div className="flex gap-4 flex-1 min-h-0 px-6 pb-4">
          <Skeleton className="w-[380px] shrink-0 h-full" />
          <Skeleton className="flex-1 h-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="px-6 pt-4 pb-4 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground -ml-2"
            onClick={() => navigate({ to: '/kpis' })}
          >
            <ArrowLeft className="mr-1.5 size-3.5" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {isEditMode && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete KPI
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!kpiComplete || isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 size-3.5" />
              )}
              {isEditMode ? 'Save Changes' : 'Save KPI'}
            </Button>
          </div>
        </div>

        {/* KPI name as editable heading */}
        <input
          className="text-2xl font-semibold tracking-tight bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none w-full placeholder:text-muted-foreground/50 transition-colors pb-1"
          placeholder="Untitled KPI"
          value={state.name}
          onChange={(e) =>
            setState((prev) => ({ ...prev, name: e.target.value }))
          }
        />
      </div>

      {/* Side-by-side panels */}
      <div className="flex-1 min-h-0 px-6 pb-4">
        <ResizablePanelGroup direction="horizontal" className="rounded-lg border">
          {/* Left: Form sections */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <Card className="h-full border-0 rounded-none shadow-none">
              <div className="flex items-center px-3 h-9 border-b bg-muted/30 shrink-0">
                <span className="text-sm font-semibold tracking-tight">
                  Configuration
                </span>
              </div>
              <div className="overflow-y-auto h-[calc(100%-2.25rem)] p-4 space-y-6">
                <StepDataset
                  datasetId={state.datasetId}
                  onSelect={handleDatasetSelect}
                />
                <StepColumn
                  dataset={state.dataset}
                  metricColumn={state.metricColumn}
                  aggregation={state.aggregation}
                  onColumnChange={(col) =>
                    setState((prev) => ({ ...prev, metricColumn: col }))
                  }
                  onAggregationChange={(agg) =>
                    setState((prev) => ({ ...prev, aggregation: agg }))
                  }
                />
                <StepFormat
                  format={state.format}
                  onChange={(format) =>
                    setState((prev) => ({ ...prev, format }))
                  }
                />
                <StepTrend
                  trend={state.trend}
                  subtitle={state.subtitle}
                  onTrendChange={(trend) =>
                    setState((prev) => ({ ...prev, trend }))
                  }
                  onSubtitleChange={(subtitle) =>
                    setState((prev) => ({ ...prev, subtitle }))
                  }
                />
                <StepThresholds
                  thresholds={state.thresholds}
                  name={state.name}
                  description={state.description}
                  onThresholdsChange={(thresholds) =>
                    setState((prev) => ({ ...prev, thresholds }))
                  }
                  onNameChange={(name) =>
                    setState((prev) => ({ ...prev, name }))
                  }
                  onDescriptionChange={(description) =>
                    setState((prev) => ({ ...prev, description }))
                  }
                />
              </div>
            </Card>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Preview */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full flex flex-col">
              <div className="flex items-center px-3 h-9 border-b bg-muted/30 shrink-0">
                <span className="text-sm font-semibold tracking-tight">
                  Preview
                </span>
              </div>
              <div className="flex-1 min-h-0 p-4">
                <KpiBuilderPreview
                  datasetId={state.datasetId}
                  dataset={state.dataset}
                  metricColumn={state.metricColumn}
                  aggregation={state.aggregation}
                  format={state.format}
                  trend={state.trend}
                  thresholds={state.thresholds}
                  subtitle={state.subtitle}
                  name={state.name}
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Delete confirmation dialog */}
      {isEditMode && editKpi && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Delete &ldquo;{editKpi.name}&rdquo;?
              </DialogTitle>
              <DialogDescription>
                This will permanently remove the KPI from the library. Any
                dashboards using this KPI will lose it. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteKpi.isPending}
              >
                Keep KPI
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteKpi.isPending}
              >
                {deleteKpi.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete KPI'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
