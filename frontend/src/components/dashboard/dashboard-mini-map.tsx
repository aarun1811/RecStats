import { useMemo } from 'react'

import { cn } from '@/lib/utils'

interface DashboardMiniMapProps {
  config: Record<string, unknown> | undefined
  className?: string
}

type PanelKind = 'kpi' | 'chart' | 'grid'

interface MiniPanel {
  key: string
  col: number
  row: number
  width: number
  height: number
  kind: PanelKind
}

const GRID_COLS = 12
const MAX_VISIBLE_ROWS = 10

/**
 * Tolerant layout reader — returns RAW values without index normalization.
 * The whole-config indexing scheme (0-based vs 1-based) is detected and
 * normalized in the caller, because per-panel normalization desynchronizes
 * panels relative to each other (e.g. shifting row 0 → 1 while leaving
 * row 2 alone causes overlap). Legacy JSON dashboards use col:0 row:0,
 * builder-created use col:1 row:1.
 * Returns null when no usable layout exists.
 */
function readLayout(
  obj: Record<string, unknown>,
): { col: number; row: number; width: number; height: number } | null {
  const layout = obj.layout as Record<string, unknown> | undefined
  if (!layout || Object.keys(layout).length === 0) return null
  const col = Number(layout.col ?? 0)
  const row = Number(layout.row ?? 0)
  const width = Number(layout.width ?? 6)
  const height = Number(layout.height ?? 2)
  if ([col, row, width, height].some(Number.isNaN)) return null
  return { col, row, width, height }
}

/**
 * Stripped-down layout silhouette of a dashboard. Renders each panel as an
 * outlined rectangle on a 12-column grid, with subtle type-based fills:
 *   - KPI:   brighter fill + brighter border
 *   - Chart: barely-tinted fill + default border
 *   - Grid:  no fill + dashed border
 *
 * Intentionally minimal: no glyphs, no labels, no dot grid backdrop. The
 * shape and type-distribution are the recognition cues.
 */
export function DashboardMiniMap({ config, className }: DashboardMiniMapProps) {
  const panels = useMemo<MiniPanel[]>(() => {
    if (!config) return []
    const cfg = config as Record<string, unknown>
    const result: MiniPanel[] = []

    const collect = (key: string, kind: PanelKind) => {
      const items = (cfg[key] ?? []) as Array<Record<string, unknown>>
      items.forEach((item, i) => {
        const layout = readLayout(item)
        if (layout) result.push({ key: `${kind}-${i}`, ...layout, kind })
      })
    }

    collect('charts', 'chart')
    collect('grids', 'grid')
    collect('kpis', 'kpi')

    // Detect indexing scheme across the WHOLE config and normalize uniformly.
    // Per-panel normalization is unsafe: shifting row 0 → 1 while leaving
    // row 2 alone causes the panel that started at row 0 to overlap with
    // the panel that started at row 2.
    const usesZeroIndex = result.some((p) => p.col === 0 || p.row === 0)
    if (usesZeroIndex) {
      result.forEach((p) => {
        p.col += 1
        p.row += 1
      })
    }

    // Auto-place layout-less KPIs (legacy configs) as a row above positioned
    // panels so the silhouette still conveys "this dashboard has KPIs at the top".
    const kpis = (cfg.kpis ?? []) as Array<Record<string, unknown>>
    const unpositioned = kpis.filter((k) => readLayout(k) === null)
    if (unpositioned.length > 0) {
      const visible = Math.min(unpositioned.length, 6)
      const each = Math.max(2, Math.floor(GRID_COLS / visible))
      // Push everything else down by 1 row to make room.
      result.forEach((p) => {
        p.row += 1
      })
      let col = 1
      for (let i = 0; i < visible; i++) {
        result.push({
          key: `kpi-auto-${i}`,
          col,
          row: 1,
          width: each,
          height: 1,
          kind: 'kpi',
        })
        col += each
      }
    }

    return result
  }, [config])

  const maxRow = useMemo(() => {
    if (panels.length === 0) return 1
    return Math.max(...panels.map((p) => p.row + p.height - 1), 1)
  }, [panels])

  // Cap visible rows to keep small panels from collapsing into invisible slivers
  // on very tall dashboards. Compress proportionally.
  const totalRows = Math.max(Math.min(maxRow, MAX_VISIBLE_ROWS), 4)
  const compression = totalRows / Math.max(maxRow, 1)

  if (panels.length === 0) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center',
          className,
        )}
      >
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40">
          empty canvas
        </span>
      </div>
    )
  }

  return (
    <div className={cn('h-full w-full p-5', className)}>
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))`,
          gap: '5px',
        }}
      >
        {panels.map((panel) => {
          const safeCol = Math.max(1, Math.min(GRID_COLS, panel.col))
          const safeWidth = Math.max(
            1,
            Math.min(GRID_COLS - safeCol + 1, panel.width),
          )
          const compressedRow = Math.max(
            1,
            Math.round((panel.row - 1) * compression) + 1,
          )
          const compressedHeight = Math.max(
            1,
            Math.round(panel.height * compression),
          )
          const safeRow = Math.max(1, Math.min(totalRows, compressedRow))
          const safeHeight = Math.max(
            1,
            Math.min(totalRows - safeRow + 1, compressedHeight),
          )
          return (
            <div
              key={panel.key}
              className={cn(
                'rounded-[2px] border',
                panel.kind === 'kpi' &&
                  'border-foreground/30 bg-foreground/10',
                panel.kind === 'chart' &&
                  'border-border bg-foreground/[0.04]',
                panel.kind === 'grid' &&
                  'border-dashed border-border',
              )}
              style={{
                gridColumn: `${safeCol} / span ${safeWidth}`,
                gridRow: `${safeRow} / span ${safeHeight}`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
