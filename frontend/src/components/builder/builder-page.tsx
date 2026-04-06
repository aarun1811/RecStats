import { useCallback, useState } from 'react'

import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { toast } from 'sonner'

import { AddContentMenu } from '@/components/builder/add-content-menu'
import { BuilderCanvas } from '@/components/builder/builder-canvas'
import { BuilderEmptyState } from '@/components/builder/builder-empty-state'
import { BuilderPanel } from '@/components/builder/builder-panel'
import { BuilderPanelContent } from '@/components/builder/builder-panel-content'
import { BuilderToolbar } from '@/components/builder/builder-toolbar'
import { ChartPickerDialog } from '@/components/builder/chart-picker-dialog'
import { DatasetPickerDialog } from '@/components/builder/dataset-picker-dialog'
import { KpiPickerDialog } from '@/components/builder/kpi-picker-dialog'
import { PanelConfigPopover } from '@/components/builder/panel-config-popover'
import { Button } from '@/components/ui/button'
import { useBuilderKeyboardShortcuts } from '@/hooks/use-builder-keyboard-shortcuts'
import {
  useCreateDashboard,
  useUpdateDashboard,
} from '@/hooks/use-managed-dashboards'
import { useBuilderStore } from '@/stores/builder-store'
import { useLayoutHistoryStore } from '@/stores/layout-history-store'
import type { BuilderItem } from '@/types/builder'
import type { DashboardConfig } from '@/types/dashboard-config'
import type { RecvizChart } from '@/types/managed-chart'
import type { RecvizDataset } from '@/types/managed-dataset'
import type { RecvizKpi } from '@/types/managed-kpi'

interface BuilderPageProps {
  mode: 'create' | 'edit'
}

function buildConfigFromStore(): DashboardConfig {
  const state = useBuilderStore.getState()
  return {
    id: state.dashboardId ?? '',
    name: state.name || 'Untitled Dashboard',
    description: state.description,
    features: { crossFilter: false, drillDown: false },
    filters: state.filters,
    kpis: [],
    charts: state.items
      .filter((item) => item.type === 'chart' && item.chart)
      .map((item) => ({
        id: item.id,
        title: item.chart?.title ?? 'Untitled Chart',
        type: item.chart?.chartType ?? 'bar',
        sourceType: 'query' as const,
        sources: item.chart?.datasetId
          ? [{ dataSourceId: item.chart.datasetId }]
          : [],
        layout: { ...item.layout },
        crossFilter: item.chart?.crossFilter,
        drillHierarchy: item.chart?.drillHierarchy,
        drillDetailDataSourceId: item.chart?.drillDetailDataSourceId ?? undefined,
        refreshInterval: item.chart?.refreshInterval ?? undefined,
      })),
    grids: state.items
      .filter((item) => item.type === 'grid' && item.grid)
      .map((item) => ({
        id: item.id,
        title: item.grid?.title ?? 'Untitled Grid',
        dataSourceId: item.grid?.datasetId,
        columns: [],
        layout: { ...item.layout },
      })),
    layout: { type: 'grid', sections: ['charts', 'grids'] },
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

  const [isSaving, setIsSaving] = useState(false)

  // Dialog visibility state
  const [chartPickerOpen, setChartPickerOpen] = useState(false)
  const [kpiPickerOpen, setKpiPickerOpen] = useState(false)
  const [gridPickerOpen, setGridPickerOpen] = useState(false)
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
      const config = buildConfigFromStore()
      if (mode === 'create' || !dashboardId) {
        const result = await createDashboard.mutateAsync({
          name: config.name,
          description: config.description,
          config,
        })
        markClean()
        resetHistory()
        toast.success('Dashboard saved')
        navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: result.id } })
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
        navigate({ to: '/dashboards/$dashboardId', params: { dashboardId } })
      }
    } catch {
      toast.error('Failed to save dashboard')
    } finally {
      setIsSaving(false)
    }
  }, [mode, dashboardId, createDashboard, updateDashboard, markClean, resetHistory, navigate])

  const handleSaveAs = useCallback(() => {
    // Will be implemented with a save-as dialog in a future plan
  }, [])

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
            onSelectFilter={() => {
              // Filter dialog wired in Plan 08
            }}
          >
            <Button size="sm">
              <Plus className="mr-1.5 size-4" />
              Add
            </Button>
          </AddContentMenu>
        }
      />

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
    </div>
  )
}
