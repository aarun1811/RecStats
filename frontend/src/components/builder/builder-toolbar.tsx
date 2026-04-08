import { Loader2, Redo2, Undo2 } from 'lucide-react'

import { cn } from '@/lib/utils'
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
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        {/* Architectural accent line on the top edge */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="flex items-center justify-between px-6 py-2">
          {/* LEFT — Mode badge + Add + History */}
          <div className="flex items-center gap-3">
            {/* Mode indicator */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex h-1.5 w-1.5 rounded-full transition-colors',
                  isDirty ? 'bg-amber-500 shadow-[0_0_8px_theme(colors.amber.500)]' : 'bg-primary/60',
                )}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {isDirty ? 'unsaved edits' : 'edit mode'}
              </span>
            </div>

            <Separator orientation="vertical" className="h-5" />

            {/* Add button (dropdown wrapper) */}
            {renderAddButton}

            <Separator orientation="vertical" className="h-5" />

            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleUndo}
                    disabled={!canUndo}
                  >
                    <Undo2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo (⌘Z)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleRedo}
                    disabled={!canRedo}
                  >
                    <Redo2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* RIGHT — Actions */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              className="text-muted-foreground hover:text-foreground"
            >
              Exit Builder
            </Button>
            <Button variant="outline" size="sm" onClick={onSaveAs}>
              Save As
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="shadow-sm shadow-primary/20"
            >
              {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Save Dashboard
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
