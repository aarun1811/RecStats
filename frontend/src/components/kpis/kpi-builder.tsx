import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check, Loader2, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCreateKpi, useUpdateKpi, useDeleteKpi } from '@/hooks/use-managed-kpis'
import { StepDataset } from './builder/step-dataset'
import { StepColumn } from './builder/step-column'
import { StepFormat } from './builder/step-format'
import { StepTrend } from './builder/step-trend'
import { StepThresholds } from './builder/step-thresholds'
import { KpiBuilderPreview } from './kpi-builder-preview'
import type { KpiBuilderStep } from './kpi-builder-preview'
import type { RecvizKpi, AggregationType, KpiFormatConfig, TrendConfig, ThresholdConfig } from '@/types/managed-kpi'
import type { RecvizDataset } from '@/types/managed-dataset'

const STEP_ORDER = ['dataset', 'column', 'format', 'trend', 'thresholds'] as const
type StepKey = (typeof STEP_ORDER)[number]

const STEP_LABELS: Record<StepKey, string> = {
  dataset: '1. Dataset',
  column: '2. Metric & Aggregation',
  format: '3. Format',
  trend: '4. Trend Comparison',
  thresholds: '5. Thresholds',
}

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

  const isEditMode = editKpi !== null && editKpi !== undefined

  const [state, setState] = useState<BuilderState>(() =>
    createInitialState(editKpi, editDataset),
  )
  const [activeStep, setActiveStep] = useState<string>(
    isEditMode ? '' : 'dataset',
  )
  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(
    () =>
      isEditMode && editKpi
        ? new Set(STEP_ORDER.slice() as StepKey[])
        : new Set<StepKey>(),
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editInitialized, setEditInitialized] = useState(false)

  // Re-initialize state when editKpi finishes loading (async)
  useEffect(() => {
    if (editKpi && !editInitialized) {
      setState(createInitialState(editKpi, editDataset))
      setCompletedSteps(new Set(STEP_ORDER.slice() as StepKey[]))
      setEditInitialized(true)
    }
  }, [editKpi, editDataset, editInitialized])

  // Sync dataset when editDataset loads after editKpi
  useEffect(() => {
    if (editDataset && editKpi && !state.dataset) {
      setState((prev) => ({ ...prev, dataset: editDataset }))
    }
  }, [editDataset, editKpi, state.dataset])

  const completeStep = useCallback((step: StepKey, nextStep: StepKey) => {
    setCompletedSteps((prev) => new Set([...prev, step]))
    setActiveStep(nextStep)
  }, [])

  const resetFromStep = useCallback((step: StepKey) => {
    const idx = STEP_ORDER.indexOf(step)
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      for (let i = idx; i < STEP_ORDER.length; i++) {
        next.delete(STEP_ORDER[i])
      }
      return next
    })
  }, [])

  const isStepLocked = useCallback(
    (step: StepKey): boolean => {
      const idx = STEP_ORDER.indexOf(step)
      if (idx === 0) return false
      // Column step requires dataset
      if (step === 'column') return !state.datasetId
      // Format, trend, thresholds require column
      return !completedSteps.has('column')
    },
    [completedSteps, state.datasetId],
  )

  function handleAccordionChange(value: string) {
    if (!value) {
      setActiveStep('')
      return
    }
    const step = value as StepKey
    if (!isStepLocked(step)) {
      setActiveStep(value)
    }
  }

  function handleDatasetSelect(dataset: RecvizDataset) {
    const isChange = state.datasetId !== dataset.id
    setState((prev) => ({
      ...prev,
      datasetId: dataset.id,
      dataset,
      ...(isChange ? { metricColumn: null } : {}),
    }))
    if (isChange) {
      resetFromStep('dataset')
    }
  }

  function handleDatasetContinue() {
    completeStep('dataset', 'column')
  }

  function handleColumnContinue() {
    completeStep('column', 'format')
  }

  function handleFormatContinue() {
    completeStep('format', 'trend')
  }

  function handleTrendContinue() {
    completeStep('trend', 'thresholds')
  }

  function handleThresholdsDone() {
    setCompletedSteps((prev) => new Set([...prev, 'thresholds']))
    setActiveStep('')
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

  function getStepSummary(step: StepKey): string | null {
    if (!completedSteps.has(step)) return null
    switch (step) {
      case 'dataset':
        return state.dataset
          ? `${state.dataset.name} · ${state.dataset.columns.length} cols`
          : null
      case 'column':
        return state.metricColumn
          ? `${state.aggregation}(${state.metricColumn})`
          : null
      case 'format':
        return state.format.type + (state.format.abbreviate ? ', abbreviated' : '')
      case 'trend':
        return state.trend ? state.trend.mode.replace('_', ' ') : 'None'
      case 'thresholds':
        return state.thresholds
          ? `Green ≥ ${state.thresholds.greenAbove}`
          : 'None'
    }
  }

  // Loading skeleton (edit mode)
  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <div className="px-6 pt-4 pb-4 shrink-0 space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-96" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="flex gap-4 flex-1 min-h-0 px-6 pb-4">
          <div className="w-[380px] shrink-0 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="flex-1 min-h-[320px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="px-6 pt-4 pb-4 shrink-0 space-y-3">
        {/* Top bar: back + actions */}
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

        {/* Description */}
        <Input
          className="h-8 text-sm"
          placeholder="Add a description..."
          value={state.description}
          onChange={(e) =>
            setState((prev) => ({ ...prev, description: e.target.value }))
          }
        />

        {/* Metadata badges */}
        {(state.dataset || state.metricColumn) && (
          <div className="flex items-center gap-2">
            {state.dataset && (
              <Badge variant="outline">
                {state.dataset.name}
              </Badge>
            )}
            {state.metricColumn && (
              <Badge variant="outline" className="gap-1 font-mono">
                {state.aggregation}({state.metricColumn})
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Side-by-side panels */}
      <div className="flex gap-4 flex-1 min-h-0 px-6 pb-4">
        {/* Left: Steps */}
        <div className="w-[380px] shrink-0 rounded-lg border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center px-3 h-9 border-b bg-muted/30 shrink-0">
            <span className="text-sm font-semibold tracking-tight">Steps</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Accordion
              type="single"
              collapsible
              value={activeStep}
              onValueChange={handleAccordionChange}
            >
              {STEP_ORDER.map((step) => {
                const locked = isStepLocked(step)
                const completed = completedSteps.has(step)
                const summary = getStepSummary(step)
                const isActive = activeStep === step

                return (
                  <AccordionItem
                    key={step}
                    value={step}
                    disabled={locked}
                    className={cn(
                      'border-b last:border-b-0',
                      locked && 'opacity-50',
                      isActive && 'border-l-2 border-l-primary',
                    )}
                  >
                    <AccordionTrigger
                      className={cn(
                        'py-2.5 px-3',
                        locked && 'cursor-not-allowed hover:no-underline',
                      )}
                    >
                      <div className="flex flex-1 flex-col items-start gap-0.5">
                        <div className="flex items-center gap-2">
                          {completed && !isActive && (
                            <Check className="size-4 text-primary" />
                          )}
                          <span className="text-sm font-semibold">
                            {STEP_LABELS[step]}
                          </span>
                        </div>
                        {summary && !isActive && (
                          <span className="text-sm text-muted-foreground">
                            {summary}
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="p-4 pt-0">
                      {step === 'dataset' && (
                        <div className="space-y-3">
                          <StepDataset
                            datasetId={state.datasetId}
                            onSelect={handleDatasetSelect}
                          />
                          {state.dataset && (
                            <div className="flex justify-end">
                              <Button size="sm" onClick={handleDatasetContinue}>
                                Continue
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      {step === 'column' && (
                        <div className="space-y-3">
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
                          {state.metricColumn && (
                            <div className="flex justify-end">
                              <Button size="sm" onClick={handleColumnContinue}>
                                Continue
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      {step === 'format' && (
                        <div className="space-y-3">
                          <StepFormat
                            format={state.format}
                            onChange={(format) =>
                              setState((prev) => ({ ...prev, format }))
                            }
                          />
                          <div className="flex justify-end">
                            <Button size="sm" onClick={handleFormatContinue}>
                              Continue
                            </Button>
                          </div>
                        </div>
                      )}
                      {step === 'trend' && (
                        <div className="space-y-3">
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
                          <div className="flex justify-end">
                            <Button size="sm" onClick={handleTrendContinue}>
                              Continue
                            </Button>
                          </div>
                        </div>
                      )}
                      {step === 'thresholds' && (
                        <div className="space-y-3">
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
                          <div className="flex justify-end">
                            <Button size="sm" onClick={handleThresholdsDone}>
                              Done
                            </Button>
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 min-w-0 rounded-lg border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center px-3 h-9 border-b bg-muted/30 shrink-0">
            <span className="text-sm font-semibold tracking-tight">Preview</span>
          </div>
          <div className="flex-1 min-h-0 p-4">
            <KpiBuilderPreview
              step={(activeStep || '') as KpiBuilderStep}
              datasetId={state.datasetId}
              dataset={state.dataset}
              metricColumn={state.metricColumn}
              aggregation={state.aggregation}
              format={state.format}
              trend={state.trend}
              thresholds={state.thresholds}
              subtitle={state.subtitle}
              name={state.name}
              allComplete={STEP_ORDER.every((s) => completedSteps.has(s))}
            />
          </div>
        </div>
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
