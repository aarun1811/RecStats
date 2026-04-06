import { Loader2, Plus, Redo2, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useBuilderStore } from '@/stores/builder-store'
import { useLayoutHistoryStore } from '@/stores/layout-history-store'

interface BuilderToolbarProps {
  onAddClick: () => void
  onSave: () => void
  onSaveAs: () => void
  onExit: () => void
  isSaving: boolean
  renderAddButton?: React.ReactNode
}

export function BuilderToolbar({
  onAddClick,
  onSave,
  onSaveAs,
  onExit,
  isSaving,
  renderAddButton,
}: BuilderToolbarProps) {
  const isDirty = useBuilderStore((s) => s.isDirty)
  const updateLayouts = useBuilderStore((s) => s.updateLayouts)

  const canUndo = useLayoutHistoryStore((s) => s.canUndo)
  const canRedo = useLayoutHistoryStore((s) => s.canRedo)
  const undo = useLayoutHistoryStore((s) => s.undo)
  const redo = useLayoutHistoryStore((s) => s.redo)

  function handleUndo() {
    const layouts = undo()
    if (layouts) {
      updateLayouts(
        layouts.map((l, i) => ({
          id: useBuilderStore.getState().items[i]?.id ?? '',
          layout: l,
        })),
      )
    }
  }

  function handleRedo() {
    const layouts = redo()
    if (layouts) {
      updateLayouts(
        layouts.map((l, i) => ({
          id: useBuilderStore.getState().items[i]?.id ?? '',
          layout: l,
        })),
      )
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-background px-6 py-2">
        <div className="flex items-center gap-2">
          {renderAddButton ?? (
            <Button size="sm" onClick={onAddClick}>
              <Plus className="mr-1.5 size-4" />
              Add
            </Button>
          )}
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={!canUndo}
              >
                <Undo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRedo}
                disabled={!canRedo}
              >
                <Redo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>
          {isDirty && <span className="size-2.5 rounded-full bg-amber-500" />}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : null}
            Save Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={onSaveAs}>
            Save As
          </Button>
          <Button variant="ghost" size="sm" onClick={onExit}>
            Exit Builder
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
