import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, BookOpen, Check, Loader2, Save, Trash2 } from 'lucide-react'
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
import { getDatasetShape } from '@/lib/chart-compatibility'
import { ChartTypeIcon, CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import { ChartBuilderPreview } from '@/components/charts/chart-builder-preview'
import { ChartBuilderHelpSheet } from '@/components/charts/chart-builder-help-sheet'
import { DeleteChartDialog } from '@/components/charts/delete-chart-dialog'
import { useCreateChart, useUpdateChart } from '@/hooks/use-managed-charts'
import { StepDataset } from './builder/step-dataset'
import { StepType } from './builder/step-type'
import { StepMapping } from './builder/step-mapping'
import { StepAppearance } from './builder/step-appearance'
import type { RecvizChart, LibraryChartType, ChartColumnMapping, ChartAppearance } from '@/types/managed-chart'
import type { RecvizDataset, DatasetColumnMeta } from '@/types/managed-dataset'

const STEP_ORDER = ['dataset', 'type', 'mapping', 'appearance'] as const
type StepKey = (typeof STEP_ORDER)[number]

const STEP_LABELS: Record<StepKey, string> = {
  dataset: '1. Dataset',
  type: '2. Chart Type',
  mapping: '3. Column Mapping',
  appearance: '4. Appearance',
}

interface BuilderState {
  datasetId: string | null
  dataset: RecvizDataset | null
  chartType: LibraryChartType | null
  columnMapping: ChartColumnMapping
  appearance: ChartAppearance
  name: string
  description: string
}

/** Preview state passed to the ChartBuilderPreview component. */
export interface BuilderPreviewState {
  step: StepKey
  dataset: RecvizDataset | null
  chartType: LibraryChartType | null
  columnMapping: ChartColumnMapping | null
  appearance: ChartAppearance | null
  previewDataLoading: boolean
  previewData: Record<string, unknown>[] | null
}

const DEFAULT_COLUMN_MAPPING: ChartColumnMapping = {
  categoryColumn: null,
  metricColumns: [],
  aggregations: {},
}

const DEFAULT_APPEARANCE: ChartAppearance = {
  title: '',
  showLegend: true,
  legendPosition: 'bottom',
  showXLabel: true,
  showYLabel: true,
  typeSpecific: {},
}

function createInitialState(initialChart?: RecvizChart, dataset?: RecvizDataset | null): BuilderState {
  if (initialChart) {
    return {
      datasetId: initialChart.datasetId,
      dataset: dataset ?? null,
      chartType: initialChart.chartType,
      columnMapping: initialChart.config.columnMapping,
      appearance: initialChart.config.appearance,
      name: initialChart.name,
      description: initialChart.description,
    }
  }
  return {
    datasetId: null,
    dataset: null,
    chartType: null,
    columnMapping: DEFAULT_COLUMN_MAPPING,
    appearance: DEFAULT_APPEARANCE,
    name: '',
    description: '',
  }
}

const NEEDS_CATEGORY = new Set<string>([
  'bar', 'stacked-bar', 'line', 'area', 'pie', 'donut',
  'heatmap', 'treemap', 'waterfall', 'bullet', 'box-plot',
  'combo', 'sankey', 'sunburst', 'radar', 'funnel', 'graph', 'parallel',
])

function isChartComplete(state: BuilderState): boolean {
  if (!state.datasetId) return false
  if (!state.chartType) return false
  if (state.columnMapping.metricColumns.length === 0) return false
  if (NEEDS_CATEGORY.has(state.chartType) && !state.columnMapping.categoryColumn) return false
  if (state.chartType === 'scatter' && state.columnMapping.metricColumns.length < 2) return false
  if (state.chartType === 'combo' && state.columnMapping.metricColumns.length < 2) return false
  if (!state.name.trim()) return false
  return true
}

function buildMappingSummary(
  mapping: ChartColumnMapping,
  columns: DatasetColumnMeta[],
): string {
  const category = mapping.categoryColumn ?? ''
  const metrics = mapping.metricColumns.map((col) => {
    const agg = mapping.aggregations[col]
    const colMeta = columns.find((c) => c.name === col)
    const defaultAgg = colMeta?.aggregation ?? 'NONE'
    if (agg && agg !== 'NONE' && agg !== defaultAgg) {
      return `${agg}(${col})`
    }
    return col
  })
  return category ? `${category} × ${metrics.join(', ')}` : metrics.join(', ')
}

interface ChartBuilderProps {
  mode: 'create' | 'edit'
  initialChart?: RecvizChart
  initialDataset?: RecvizDataset | null
  isLoading?: boolean
}

export function ChartBuilder({
  mode,
  initialChart,
  initialDataset,
  isLoading,
}: ChartBuilderProps) {
  const navigate = useNavigate()
  const createChart = useCreateChart()
  const updateChart = useUpdateChart()

  const [state, setState] = useState<BuilderState>(() =>
    createInitialState(initialChart, initialDataset),
  )
  const [activeStep, setActiveStep] = useState<string>(
    mode === 'edit' ? '' : 'dataset',
  )
  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(
    () =>
      mode === 'edit' && initialChart
        ? new Set(STEP_ORDER.slice() as StepKey[])
        : new Set<StepKey>(),
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [helpSheetOpen, setHelpSheetOpen] = useState(false)

  // Sync dataset when initialDataset loads (for edit mode)
  useEffect(() => {
    if (initialDataset && mode === 'edit' && !state.dataset) {
      setState((prev) => ({ ...prev, dataset: initialDataset }))
    }
  }, [initialDataset, mode, state.dataset])

  const datasetShape = useMemo(
    () => (state.dataset ? getDatasetShape(state.dataset.columns) : { dimensions: 0, measures: 0 }),
    [state.dataset],
  )

  // Build preview state from builder state
  // When all steps are done and accordion is collapsed, keep showing the live chart
  const allStepsComplete = STEP_ORDER.every((s) => completedSteps.has(s))
  const effectiveStep: StepKey = (activeStep as StepKey) || (allStepsComplete ? 'appearance' : 'dataset')

  const previewState = useMemo<BuilderPreviewState>(
    () => ({
      step: effectiveStep,
      dataset: state.dataset,
      chartType: state.chartType,
      columnMapping: state.columnMapping.metricColumns.length > 0 ? state.columnMapping : null,
      appearance: state.appearance,
      previewDataLoading: false,
      previewData: null,
    }),
    [effectiveStep, state.dataset, state.chartType, state.columnMapping, state.appearance],
  )

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
      return !completedSteps.has(STEP_ORDER[idx - 1])
    },
    [completedSteps],
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
      ...(isChange
        ? {
            chartType: null,
            columnMapping: DEFAULT_COLUMN_MAPPING,
            appearance: DEFAULT_APPEARANCE,
          }
        : {}),
    }))
    if (isChange) {
      resetFromStep('dataset')
    }
  }

  function handleDatasetContinue() {
    completeStep('dataset', 'type')
  }

  function handleTypeSelect(type: LibraryChartType) {
    const isChange = state.chartType !== type
    setState((prev) => ({
      ...prev,
      chartType: type,
      ...(isChange
        ? {
            columnMapping: DEFAULT_COLUMN_MAPPING,
            appearance: { ...prev.appearance, typeSpecific: {} },
          }
        : {}),
    }))
    if (isChange) {
      resetFromStep('type')
    }
    completeStep('type', 'mapping')
  }

  function handleMappingChange(mapping: ChartColumnMapping) {
    setState((prev) => ({ ...prev, columnMapping: mapping }))
  }

  function handleMappingComplete() {
    completeStep('mapping', 'appearance')
  }

  function handleAppearanceChange(appearance: ChartAppearance) {
    setState((prev) => ({ ...prev, appearance }))
  }

  function handleAppearanceComplete() {
    setCompletedSteps((prev) => new Set([...prev, 'appearance']))
    setActiveStep('')
  }

  async function handleSave() {
    if (!state.datasetId || !state.chartType) return

    const config = {
      columnMapping: state.columnMapping,
      appearance: state.appearance,
    }

    try {
      if (mode === 'create') {
        await createChart.mutateAsync({
          name: state.name,
          description: state.description,
          datasetId: state.datasetId,
          chartType: state.chartType,
          config,
        })
        toast.success('Chart saved')
        navigate({ to: '/charts' })
      } else if (initialChart) {
        await updateChart.mutateAsync({
          id: initialChart.id,
          data: {
            name: state.name,
            description: state.description,
            chartType: state.chartType,
            config,
          },
        })
        toast.success('Chart saved')
      }
    } catch {
      toast.error('Failed to save chart')
    }
  }

  const isSaving = createChart.isPending || updateChart.isPending
  const chartComplete = isChartComplete(state)

  function getStepSummary(step: StepKey): string | null {
    if (!completedSteps.has(step)) return null
    switch (step) {
      case 'dataset':
        return state.dataset
          ? `${state.dataset.name} · ${state.dataset.columns.length} cols`
          : null
      case 'type':
        return state.chartType ? CHART_DISPLAY_NAMES[state.chartType] ?? state.chartType : null
      case 'mapping':
        return buildMappingSummary(state.columnMapping, state.dataset?.columns ?? [])
      case 'appearance':
        return state.appearance.title ? `Title: ${state.appearance.title}` : 'Default appearance'
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
            onClick={() => navigate({ to: '/charts' })}
          >
            <ArrowLeft className="mr-1.5 size-3.5" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {mode === 'edit' && initialChart && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete Chart
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!chartComplete || isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 size-3.5" />
              )}
              {mode === 'create' ? 'Save Chart' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Chart name as editable heading */}
        <input
          className="text-2xl font-semibold tracking-tight bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none w-full placeholder:text-muted-foreground/50 transition-colors pb-1"
          placeholder="Untitled Chart"
          value={state.name}
          onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
        />

        {/* Description */}
        <Input
          className="h-8 text-sm"
          placeholder="Add a description..."
          value={state.description}
          onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
        />

        {/* Metadata badges */}
        {(state.dataset || state.chartType) && (
          <div className="flex items-center gap-2">
            {state.chartType && (
              <Badge variant="outline" className="gap-1.5">
                <ChartTypeIcon chartType={state.chartType} size={12} />
                {CHART_DISPLAY_NAMES[state.chartType]}
              </Badge>
            )}
            {state.dataset && (
              <Badge variant="outline">
                {state.dataset.name}
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
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            >
                              <Check className="size-4 text-primary" />
                            </motion.div>
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
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                      >
                        {step === 'dataset' && (
                          <div className="space-y-3">
                            <StepDataset
                              selectedDataset={state.dataset}
                              onSelect={handleDatasetSelect}
                            />
                            {state.dataset && (
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  onClick={handleDatasetContinue}
                                >
                                  Continue
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {step === 'type' && state.dataset && (
                          <StepType
                            datasetShape={datasetShape}
                            selectedType={state.chartType}
                            onSelect={handleTypeSelect}
                          />
                        )}
                        {step === 'mapping' && state.chartType && state.dataset && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-muted-foreground">Map your dataset columns</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => setHelpSheetOpen(true)}
                                title="Configuration reference"
                              >
                                <BookOpen className="size-3.5" />
                              </Button>
                            </div>
                            <StepMapping
                              chartType={state.chartType}
                              columns={state.dataset.columns}
                              mapping={state.columnMapping}
                              onChange={handleMappingChange}
                            />
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                onClick={handleMappingComplete}
                                disabled={
                                  state.columnMapping.metricColumns.length === 0 ||
                                  (NEEDS_CATEGORY.has(state.chartType!) && !state.columnMapping.categoryColumn) ||
                                  (state.chartType === 'scatter' && state.columnMapping.metricColumns.length < 2) ||
                                  (state.chartType === 'combo' && state.columnMapping.metricColumns.length < 2)
                                }
                              >
                                Continue
                              </Button>
                            </div>
                          </div>
                        )}
                        {step === 'appearance' && (
                          <div className="space-y-3">
                            <StepAppearance
                              appearance={state.appearance}
                              onChange={handleAppearanceChange}
                              chartType={state.chartType}
                              metricColumns={state.columnMapping.metricColumns}
                            />
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                onClick={handleAppearanceComplete}
                              >
                                Done
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
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
            <AnimatePresence mode="wait">
              <motion.div
                key={`${state.chartType}-${state.columnMapping.metricColumns.join(',')}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <ChartBuilderPreview
                  state={previewState}
                  onPreviewData={() => {}}
                  allComplete={allStepsComplete}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Delete dialog (edit mode) */}
      {mode === 'edit' && initialChart && (
        <DeleteChartDialog
          chart={initialChart}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onDeleted={() => navigate({ to: '/charts' })}
        />
      )}

      {/* Help sheet for chart config reference */}
      <ChartBuilderHelpSheet
        chartType={state.chartType}
        open={helpSheetOpen}
        onOpenChange={setHelpSheetOpen}
      />
    </div>
  )
}
