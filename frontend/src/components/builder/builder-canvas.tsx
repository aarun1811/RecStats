import { useCallback, useRef } from 'react'

import ReactGridLayout, {
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout'
import type { Layout, LayoutItem } from 'react-grid-layout'

import 'react-grid-layout/css/styles.css'

import { useBuilderStore } from '@/stores/builder-store'
import { useLayoutHistoryStore } from '@/stores/layout-history-store'
import type { BuilderItem, BuilderItemType } from '@/types/builder'
import type { ChartLayout } from '@/types/dashboard-config'

interface BuilderCanvasProps {
  children?: React.ReactNode
}

// Minimum sizes per item type (D-02)
function getMinWidth(type: BuilderItemType): number {
  switch (type) {
    case 'chart':
      return 3
    case 'kpi':
      return 2
    case 'grid':
      return 6
  }
}

function getMinHeight(type: BuilderItemType): number {
  switch (type) {
    case 'chart':
      return 3
    case 'kpi':
      return 2
    case 'grid':
      return 4
  }
}

// Map BuilderItem[] to react-grid-layout Layout
function toRglLayout(items: BuilderItem[]): Layout {
  return items.map((item) => ({
    i: item.id,
    x: item.layout.col,
    y: item.layout.row,
    w: item.layout.width,
    h: item.layout.height,
    minW: getMinWidth(item.type),
    minH: getMinHeight(item.type),
  }))
}

// Map react-grid-layout LayoutItem[] back to our update format
function fromRglLayout(
  rglLayout: readonly LayoutItem[],
): Array<{ id: string; layout: ChartLayout }> {
  return rglLayout.map((item) => ({
    id: item.i,
    layout: {
      col: item.x,
      row: item.y,
      width: item.w,
      height: item.h,
    },
  }))
}

// Compare two layouts to detect actual changes (Pitfall 3: ping-pong prevention)
function layoutsEqual(
  items: BuilderItem[],
  rglLayout: readonly LayoutItem[],
): boolean {
  if (items.length !== rglLayout.length) return false
  const itemMap = new Map(items.map((item) => [item.id, item.layout]))
  for (const rglItem of rglLayout) {
    const current = itemMap.get(rglItem.i)
    if (!current) return false
    if (
      current.col !== rglItem.x ||
      current.row !== rglItem.y ||
      current.width !== rglItem.w ||
      current.height !== rglItem.h
    ) {
      return false
    }
  }
  return true
}

export function BuilderCanvas({ children }: BuilderCanvasProps) {
  const { width, containerRef, mounted } = useContainerWidth()

  const items = useBuilderStore((s) => s.items)
  const updateLayouts = useBuilderStore((s) => s.updateLayouts)
  const pushSnapshot = useLayoutHistoryStore((s) => s.pushSnapshot)

  // Track user-initiated interactions to distinguish from programmatic layout changes
  const isUserInteracting = useRef(false)

  const layout = toRglLayout(items)

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      // Only process user-initiated changes (drag/resize), not mount-time compaction
      if (!isUserInteracting.current) return

      // Compare to prevent infinite re-render (Pitfall 3)
      if (layoutsEqual(items, newLayout)) return

      // Push current layouts to history for undo
      pushSnapshot(items.map((item) => ({ ...item.layout })))

      // Update builder store with new layout positions
      updateLayouts(fromRglLayout(newLayout))
    },
    [items, updateLayouts, pushSnapshot],
  )

  const handleDragStart = useCallback(() => {
    isUserInteracting.current = true
  }, [])

  const handleDragStop = useCallback(() => {
    isUserInteracting.current = false
  }, [])

  const handleResizeStart = useCallback(() => {
    isUserInteracting.current = true
  }, [])

  const handleResizeStop = useCallback(() => {
    isUserInteracting.current = false
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative min-h-[400px] rounded-lg border-2 border-dashed border-muted-foreground/20"
      style={{
        backgroundImage:
          'radial-gradient(circle, hsl(var(--muted-foreground) / 0.15) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {mounted && (
        <ReactGridLayout
          layout={layout}
          width={width}
          gridConfig={{
            cols: 12,
            rowHeight: 80,
            margin: [16, 16] as const,
            containerPadding: [0, 0] as const,
            maxRows: Infinity,
          }}
          dragConfig={{
            enabled: true,
            handle: '.drag-handle',
            bounded: false,
            cancel: '',
            threshold: 3,
          }}
          resizeConfig={{
            enabled: true,
            handles: ['se'] as const,
          }}
          compactor={verticalCompactor}
          onLayoutChange={handleLayoutChange}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          onResizeStart={handleResizeStart}
          onResizeStop={handleResizeStop}
          autoSize
        >
          {children}
        </ReactGridLayout>
      )}

      {items.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-muted-foreground">
            No panels yet. Click + Add to get started.
          </p>
        </div>
      )}
    </div>
  )
}
