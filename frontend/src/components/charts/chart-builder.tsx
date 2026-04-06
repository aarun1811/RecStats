import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { getDatasetShape } from '@/lib/chart-compatibility'
import { CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import { useCreateChart, useUpdateChart } from '@/hooks/use-managed-charts'
import { StepDataset } from './builder/step-dataset'
import { StepType } from './builder/step-type'
import { StepMapping } from './builder/step-mapping'
import { StepAppearance } from './builder/step-appearance'
import { StepSave } from './builder/step-save'
import type { RecvizChart, LibraryChartType, ChartColumnMapping, ChartAppearance } from '@/types/managed-chart'
import type { RecvizDataset, DatasetColumnMeta } from '@/types/managed-dataset'

const STEP_ORDER = ['dataset', 'type', 'mapping', 'appearance', 'save'] as const
type StepKey = (typeof STEP_ORDER)[number]

const STEP_LABELS: Record<StepKey, string> = {
  dataset: '1. Dataset',
  type: '2. Chart Type',
  mapping: '3. Column Mapping',
  appearance: '4. Appearance',
  save: '5. Save',
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
  return category ? `${category} x ${metrics.join(', ')}` : metrics.join(', ')
}

interface ChartBuilderProps {
  mode: 'create' | 'edit'
  initialChart?: RecvizChart
  initialDataset?: RecvizDataset | null
  onPreviewChange: (state: BuilderPreviewState) => void
}

export function ChartBuilder({
  mode,
  initialChart,
  initialDataset,
  onPreviewChange,
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
        ? new Set(STEP_ORDER.filter((_, i) => i < 4) as StepKey[])
        : new Set<StepKey>(),
  )

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

  // Sync preview state whenever builder state or active step changes
  useEffect(() => {
    onPreviewChange({
      step: (activeStep as StepKey) || 'dataset',
      dataset: state.dataset,
      chartType: state.chartType,
      columnMapping: state.columnMapping.metricColumns.length > 0 ? state.columnMapping : null,
      appearance: state.appearance,
      previewDataLoading: false,
      previewData: null,
    })
  }, [activeStep, state, onPreviewChange])

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
      // Reset downstream if dataset changes
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
    completeStep('dataset', 'type')
  }

  function handleTypeSelect(type: LibraryChartType) {
    const isChange = state.chartType !== type
    setState((prev) => ({
      ...prev,
      chartType: type,
      ...(isChange
        ? { columnMapping: DEFAULT_COLUMN_MAPPING }
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
    completeStep('appearance', 'save')
  }

  function handleSaveFieldsChange(name: string, description: string) {
    setState((prev) => ({ ...prev, name, description }))
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
          ? `${state.dataset.name} \u00b7 ${state.dataset.columns.length} cols`
          : null
      case 'type':
        return state.chartType ? CHART_DISPLAY_NAMES[state.chartType] ?? state.chartType : null
      case 'mapping':
        return buildMappingSummary(state.columnMapping, state.dataset?.columns ?? [])
      case 'appearance':
        return state.appearance.title ? `Title: ${state.appearance.title}` : 'Default appearance'
      case 'save':
        return null
    }
  }

  return (
    <div className="overflow-y-auto">
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
                  <StepDataset
                    selectedDataset={state.dataset}
                    onSelect={handleDatasetSelect}
                  />
                )}
                {step === 'type' && state.dataset && (
                  <StepType
                    datasetShape={datasetShape}
                    selectedType={state.chartType}
                    onSelect={handleTypeSelect}
                  />
                )}
                {step === 'mapping' && state.chartType && state.dataset && (
                  <div className="space-y-4">
                    <StepMapping
                      chartType={state.chartType}
                      columns={state.dataset.columns}
                      mapping={state.columnMapping}
                      onChange={handleMappingChange}
                    />
                    <button
                      type="button"
                      onClick={handleMappingComplete}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Continue to Appearance
                    </button>
                  </div>
                )}
                {step === 'appearance' && (
                  <div className="space-y-4">
                    <StepAppearance
                      appearance={state.appearance}
                      onChange={handleAppearanceChange}
                    />
                    <button
                      type="button"
                      onClick={handleAppearanceComplete}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Continue to Save
                    </button>
                  </div>
                )}
                {step === 'save' && (
                  <StepSave
                    name={state.name}
                    description={state.description}
                    onChange={handleSaveFieldsChange}
                    onSave={handleSave}
                    isSaving={isSaving}
                    mode={mode}
                    isChartComplete={chartComplete}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
