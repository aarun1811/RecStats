import { useCallback, useState } from 'react'

import { useNavigate } from '@tanstack/react-router'
import { BarChart3, Gauge, Table } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { toast } from 'sonner'

import { BuilderCanvas } from '@/components/builder/builder-canvas'
import { BuilderEmptyState } from '@/components/builder/builder-empty-state'
import { BuilderPanel } from '@/components/builder/builder-panel'
import { BuilderToolbar } from '@/components/builder/builder-toolbar'
import { useBuilderKeyboardShortcuts } from '@/hooks/use-builder-keyboard-shortcuts'
import {
  useCreateDashboard,
  useUpdateDashboard,
} from '@/hooks/use-managed-dashboards'
import { useBuilderStore } from '@/stores/builder-store'
import { useLayoutHistoryStore } from '@/stores/layout-history-store'
import type { DashboardConfig } from '@/types/dashboard-config'

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

function PanelContentPlaceholder({
  type,
  title,
}: {
  type: 'chart' | 'kpi' | 'grid'
  title: string
}) {
  const Icon = type === 'chart' ? BarChart3 : type === 'kpi' ? Gauge : Table

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Icon className="size-8 opacity-30" />
      <span className="text-xs">{title}</span>
    </div>
  )
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
  const removeItem = useBuilderStore((s) => s.removeItem)
  const markClean = useBuilderStore((s) => s.markClean)
  const updateLayouts = useBuilderStore((s) => s.updateLayouts)

  const undo = useLayoutHistoryStore((s) => s.undo)
  const redo = useLayoutHistoryStore((s) => s.redo)
  const resetHistory = useLayoutHistoryStore((s) => s.reset)

  const createDashboard = useCreateDashboard()
  const updateDashboard = useUpdateDashboard()

  const [isSaving, setIsSaving] = useState(false)

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

  const handleAddClick = useCallback(() => {
    // Will be wired to AddContentMenu in Plan 06
  }, [])

  const handleEditPanel = useCallback((_itemId: string) => {
    // Will be wired to PanelConfigPopover in Plan 07
  }, [])

  const handleRemovePanel = useCallback(
    (itemId: string) => {
      removeItem(itemId)
    },
    [removeItem],
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
                >
                  <PanelContentPlaceholder
                    type={item.type}
                    title={
                      item.chart?.title ??
                      item.kpi?.title ??
                      item.grid?.title ??
                      'Untitled'
                    }
                  />
                </BuilderPanel>
              </div>
            ))}
          </BuilderCanvas>
        )}
      </div>
    </div>
  )
}
