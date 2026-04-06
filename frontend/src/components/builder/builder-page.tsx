import { useCallback, useState } from 'react'

import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { toast } from 'sonner'

import { AddContentMenu } from '@/components/builder/add-content-menu'
import { BuilderCanvas } from '@/components/builder/builder-canvas'
import { BuilderEmptyState } from '@/components/builder/builder-empty-state'
import { BuilderFilterBar } from '@/components/builder/builder-filter-bar'
import { BuilderPanel } from '@/components/builder/builder-panel'
import { BuilderPanelContent } from '@/components/builder/builder-panel-content'
import { BuilderToolbar } from '@/components/builder/builder-toolbar'
import { ChartPickerDialog } from '@/components/builder/chart-picker-dialog'
import { DatasetPickerDialog } from '@/components/builder/dataset-picker-dialog'
import { FilterConfigDialog } from '@/components/builder/filter-config-dialog'
import { KpiPickerDialog } from '@/components/builder/kpi-picker-dialog'
import { PanelConfigPopover } from '@/components/builder/panel-config-popover'
import { SaveDashboardDialog } from '@/components/builder/save-dashboard-dialog'
import { Button } from '@/components/ui/button'
import { useBuilderKeyboardShortcuts } from '@/hooks/use-builder-keyboard-shortcuts'
import {
  useCreateDashboard,
  useUpdateDashboard,
} from '@/hooks/use-managed-dashboards'
import { useManagedKpis } from '@/hooks/use-managed-kpis'
import { useBuilderStore } from '@/stores/builder-store'
import { useLayoutHistoryStore } from '@/stores/layout-history-store'
import type { BuilderItem } from '@/types/builder'
import type {
  DashboardChartConfig,
  DashboardConfig,
  FilterConfig,
  GridConfig,
  KpiConfig,
} from '@/types/dashboard-config'
import type { RecvizChart } from '@/types/managed-chart'
import type { RecvizDataset } from '@/types/managed-dataset'
import type { RecvizKpi } from '@/types/managed-kpi'

interface BuilderPageProps {
  mode: 'create' | 'edit'
}

interface BuilderStoreState {
  dashboardId: string | null
  name: string
  description: string
  items: BuilderItem[]
  filters: FilterConfig[]
}

function serializeConfig(
  state: BuilderStoreState,
  kpiLibrary: RecvizKpi[],
): DashboardConfig {
  const charts: DashboardChartConfig[] = state.items
    .filter((item) => item.type === 'chart' && item.chart)
    .map((item) => ({
      id: item.id,
      title: item.chart!.title,
      type: item.chart!.chartType,
      sourceType: 'query' as const,
      sources: [{ dataSourceId: item.chart!.datasetId, metric: '' }],
      layout: { ...item.layout },
      crossFilter: item.chart!.crossFilter,
      drillHierarchy:
        item.chart!.drillHierarchy.length > 0
          ? item.chart!.drillHierarchy
          : undefined,
      drillDetailDataSourceId:
        item.chart!.drillDetailDataSourceId ?? undefined,
      refreshInterval: item.chart!.refreshInterval ?? undefined,
    }))

  // Map KPI BuilderItems to KpiConfig[] for ConfigKpiRow consumption
  const kpis: KpiConfig[] = state.items
    .filter((item) => item.type === 'kpi' && item.kpi)
    .map((item) => {
      const kpiRef = item.kpi!
      // Look up full KPI metadata from the library
      const libraryKpi = kpiLibrary.find((k) => k.id === kpiRef.kpiId)

      // Map KpiFormatConfig.type (FormatType) to KpiConfig.format ('number' | 'currency' | 'percent')
      // FormatType includes: 'number', 'currency', 'percentage', 'duration'
      // KpiConfig.format uses 'percent' (not 'percentage')
      let format: KpiConfig['format'] = 'number'
      if (libraryKpi) {
        const fmtType = libraryKpi.config.format.type
        if (fmtType === 'currency') format = 'currency'
        else if (fmtType === 'percentage') format = 'percent'
        else format = 'number'
      }

      return {
        id: item.id,
        label: kpiRef.title,
        format,
        sources: libraryKpi
          ? [
              {
                dataSourceId: libraryKpi.datasetId,
                metric: libraryKpi.metricColumn,
              },
            ]
          : [],
        aggregation: libraryKpi?.aggregation ?? 'SUM',
      }
    })

  const grids: GridConfig[] = state.items
    .filter((item) => item.type === 'grid' && item.grid)
    .map((item) => ({
      id: item.id,
      title: item.grid!.title,
      dataSourceId: item.grid!.datasetId,
      columns: [],
      layout: { ...item.layout },
    }))

  return {
    id: state.dashboardId ?? crypto.randomUUID(),
    name: state.name || 'Untitled Dashboard',
    description: state.description,
    features: { crossFilter: true, drillDown: true },
    filters: state.filters,
    kpis,
    charts,
    grids,
    layout: { type: 'custom', sections: ['filters', 'kpis', 'charts', 'grids'] },
    autoRefreshInterval: 600000,
  }
}

export function BuilderPage({ mode }: BuilderPageProps) {
  const navigate = useNavigate()

  const dashboardId = useBuilderStore((s) => s.dashboardId)
  const name = useBuilderStore((s) => s.name)
  const description = useBuilderStore((s) => s.description)
  const items = useBuilderStore((s) => s.items)
  const isDirty = useBuilderStore((s) => s.isDirty)
  const updateName = useBuilderStore((s) => s.updateName)
  const updateDescription = useBuilderStore((s) => s.updateDescription)
  const addItem = useBuilderStore((s) => s.addItem)
  const removeItem = useBuilderStore((s) => s.removeItem)
  const markClean = useBuilderStore((s) => s.markClean)
  const updateLayouts = useBuilderStore((s) => s.updateLayouts)

  const undo = useLayoutHistoryStore((s) => s.undo)
  const redo = useLayoutHistoryStore((s) => s.redo)
  const resetHistory = useLayoutHistoryStore((s) => s.reset)

  const createDashboard = useCreateDashboard()
  const updateDashboard = useUpdateDashboard()

  // Fetch all managed KPIs for serialization lookup
  const { data: allKpis } = useManagedKpis()

  const [isSaving, setIsSaving] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)

  const filters = useBuilderStore((s) => s.filters)
  const addFilter = useBuilderStore((s) => s.addFilter)
  const removeFilter = useBuilderStore((s) => s.removeFilter)
  const reorderFilters = useBuilderStore((s) => s.reorderFilters)

  // Dialog visibility state
  const [chartPickerOpen, setChartPickerOpen] = useState(false)
  const [kpiPickerOpen, setKpiPickerOpen] = useState(false)
  const [gridPickerOpen, setGridPickerOpen] = useState(false)
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null)

  const handleUndo = useCallback(() => {
    const layouts = undo()
    if (layouts) {
      updateLayouts(
        layouts.map((l, i) => ({
          id: useBuilderStore.getState().items[i]?.id ?? '',
          layout: l,
        })),
      )
    }
  }, [undo, updateLayouts])

  const handleRedo = useCallback(() => {
    const layouts = redo()
    if (layouts) {
      updateLayouts(
        layouts.map((l, i) => ({
          id: useBuilderStore.getState().items[i]?.id ?? '',
          layout: l,
        })),
      )
    }
  }, [redo, updateLayouts])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const storeState = useBuilderStore.getState()
      const config = serializeConfig(storeState, allKpis ?? [])
      if (mode === 'create' || !dashboardId) {
        const result = await createDashboard.mutateAsync({
          name: config.name,
          description: config.description,
          config,
        })
        markClean()
        resetHistory()
        toast.success('Dashboard saved')
        navigate({
          to: '/dashboards/$dashboardId',
          params: { dashboardId: result.id },
        })
      } else {
        await updateDashboard.mutateAsync({
          id: dashboardId,
          data: {
            name: config.name,
            description: config.description,
            config,
          },
        })
        markClean()
        resetHistory()
        toast.success('Dashboard saved')
        navigate({
          to: '/dashboards/$dashboardId',
          params: { dashboardId },
        })
      }
    } catch {
      toast.error('Failed to save dashboard')
    } finally {
      setIsSaving(false)
    }
  }, [
    mode,
    dashboardId,
    allKpis,
    createDashboard,
    updateDashboard,
    markClean,
    resetHistory,
    navigate,
  ])

  const handleSaveAs = useCallback(() => {
    setSaveAsOpen(true)
  }, [])

  const handleSaveAsConfirm = useCallback(
    async (newName: string, newDescription: string) => {
      setIsSaving(true)
      try {
        const storeState = useBuilderStore.getState()
        const config = serializeConfig(storeState, allKpis ?? [])
        // Override name/description with the user-provided values
        config.name = newName
        config.description = newDescription
        // Always create a new dashboard with a new UUID for Save As
        config.id = crypto.randomUUID()

        const result = await createDashboard.mutateAsync({
          name: newName,
          description: newDescription,
          config,
        })
        markClean()
        resetHistory()
        toast.success('Dashboard saved')
        setSaveAsOpen(false)
        navigate({
          to: '/dashboards/$dashboardId',
          params: { dashboardId: result.id },
        })
      } catch {
        toast.error('Failed to save dashboard')
      } finally {
        setIsSaving(false)
      }
    },
    [allKpis, createDashboard, markClean, resetHistory, navigate],
  )

  const handleExit = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Leave without saving?',
      )
      if (!confirmed) return
    }
    if (dashboardId) {
      navigate({ to: '/dashboards/$dashboardId', params: { dashboardId } })
    } else {
      navigate({ to: '/dashboards' })
    }
  }, [isDirty, dashboardId, navigate])

  // Picker handlers -- create BuilderItems from selected library items
  const handleChartSelected = useCallback(
    (chart: RecvizChart) => {
      const item: BuilderItem = {
        id: crypto.randomUUID(),
        type: 'chart',
        layout: { col: 0, row: Infinity, width: 6, height: 4 },
        chart: {
          chartId: chart.id,
          chartType: chart.chartType,
          datasetId: chart.datasetId,
          title: chart.name,
          crossFilter: true,
          drillHierarchy: [],
          drillDetailDataSourceId: null,
          refreshInterval: null,
        },
      }
      addItem(item)
      setChartPickerOpen(false)
    },
    [addItem],
  )

  const handleKpiSelected = useCallback(
    (kpi: RecvizKpi) => {
      const item: BuilderItem = {
        id: crypto.randomUUID(),
        type: 'kpi',
        layout: { col: 0, row: Infinity, width: 3, height: 2 },
        kpi: {
          kpiId: kpi.id,
          title: kpi.name,
        },
      }
      addItem(item)
      setKpiPickerOpen(false)
    },
    [addItem],
  )

  const handleGridSelected = useCallback(
    (dataset: RecvizDataset) => {
      const item: BuilderItem = {
        id: crypto.randomUUID(),
        type: 'grid',
        layout: { col: 0, row: Infinity, width: 12, height: 6 },
        grid: {
          datasetId: dataset.id,
          title: dataset.name,
          visibleColumns: null,
          defaultSortColumn: null,
          defaultSortDirection: 'asc',
          rowLimit: 100,
        },
      }
      addItem(item)
      setGridPickerOpen(false)
    },
    [addItem],
  )

  const handleEditPanel = useCallback((itemId: string) => {
    setEditingPanelId(itemId)
  }, [])

  const handleRemovePanel = useCallback(
    (itemId: string) => {
      removeItem(itemId)
    },
    [removeItem],
  )

  const handleAddClick = useCallback(() => {
    // No-op: AddContentMenu is now wired directly as a dropdown trigger
  }, [])

  const handleFiltersAdded = useCallback(
    (newFilters: FilterConfig[]) => {
      for (const filter of newFilters) {
        addFilter(filter)
        toast.success(`Filter "${filter.label}" added`)
      }
    },
    [addFilter],
  )

  useBuilderKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onSave: handleSave,
    enabled: true,
  })

  return (
    <div className="flex h-[calc(100vh-var(--header-height,56px))] flex-col">
      <BuilderToolbar
        onAddClick={handleAddClick}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExit={handleExit}
        isSaving={isSaving}
        renderAddButton={
          <AddContentMenu
            onSelectChart={() => setChartPickerOpen(true)}
            onSelectKpi={() => setKpiPickerOpen(true)}
            onSelectGrid={() => setGridPickerOpen(true)}
            onSelectFilter={() => setFilterDialogOpen(true)}
          >
            <Button size="sm">
              <Plus className="mr-1.5 size-4" />
              Add
            </Button>
          </AddContentMenu>
        }
      />

      {filters.length > 0 && (
        <BuilderFilterBar
          filters={filters}
          onRemove={removeFilter}
          onReorder={reorderFilters}
          onAddFilter={() => setFilterDialogOpen(true)}
        />
      )}

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="py-4">
          <input
            type="text"
            value={name}
            onChange={(e) => updateName(e.target.value)}
            placeholder="Untitled Dashboard"
            className="w-full max-w-md rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight hover:border-input focus:border-input focus:outline-none"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => updateDescription(e.target.value)}
            placeholder="Add a description..."
            className="mt-1 w-full max-w-lg rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-muted-foreground hover:border-input focus:border-input focus:outline-none"
          />
        </div>

        <AnimatePresence mode="wait">
          {items.length === 0 ? (
            <BuilderEmptyState
              key="empty-state"
              onAddContent={handleAddClick}
            />
          ) : null}
        </AnimatePresence>

        {items.length > 0 && (
          <BuilderCanvas>
            {items.map((item) => (
              <div key={item.id}>
                <BuilderPanel
                  item={item}
                  onEdit={handleEditPanel}
                  onRemove={handleRemovePanel}
                  editButtonWrapper={(editButton) => (
                    <PanelConfigPopover
                      item={item}
                      open={editingPanelId === item.id}
                      onOpenChange={(open) =>
                        setEditingPanelId(open ? item.id : null)
                      }
                    >
                      {editButton}
                    </PanelConfigPopover>
                  )}
                >
                  <BuilderPanelContent item={item} />
                </BuilderPanel>
              </div>
            ))}
          </BuilderCanvas>
        )}
      </div>

      {/* Picker dialogs */}
      <ChartPickerDialog
        open={chartPickerOpen}
        onOpenChange={setChartPickerOpen}
        onSelectChart={handleChartSelected}
      />
      <KpiPickerDialog
        open={kpiPickerOpen}
        onOpenChange={setKpiPickerOpen}
        onSelectKpi={handleKpiSelected}
      />
      <DatasetPickerDialog
        open={gridPickerOpen}
        onOpenChange={setGridPickerOpen}
        onSelectDataset={handleGridSelected}
      />
      <FilterConfigDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        onFiltersAdded={handleFiltersAdded}
      />
      <SaveDashboardDialog
        open={saveAsOpen}
        onOpenChange={setSaveAsOpen}
        defaultName={name || 'Untitled Dashboard'}
        defaultDescription={description}
        onSave={handleSaveAsConfirm}
        isSaving={isSaving}
      />
    </div>
  )
}
