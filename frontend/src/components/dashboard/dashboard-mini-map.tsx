import { useMemo } from 'react'

import { cn } from '@/lib/utils'
import type { DashboardConfig } from '@/types/dashboard-config'

interface DashboardMiniMapProps {
  config: DashboardConfig | Record<string, unknown>
  className?: string
}

interface MiniPanel {
  key: string
  col: number
  row: number
  width: number
  height: number
  kind: 'chart' | 'kpi' | 'grid'
  label: string
}

const GRID_COLS = 12

/**
 * Tolerant layout reader. Normalizes 0-based or 1-based indexing to 1-based.
 * Legacy JSON dashboards use col:0 row:0, builder-created use col:1 row:1.
 */
function readLayout(
  obj: Record<string, unknown>,
): { col: number; row: number; width: number; height: number } | null {
  const layout = obj.layout as Record<string, unknown> | undefined
  if (!layout) return null
  let col = Number(layout.col ?? 1)
  let row = Number(layout.row ?? 1)
  const width = Number(layout.width ?? 6)
  const height = Number(layout.height ?? 3)
  if (Number.isNaN(col) || Number.isNaN(row) || Number.isNaN(width) || Number.isNaN(height)) {
    return null
  }
  // Normalize 0-based to 1-based
  if (col === 0) col = 1
  if (row === 0) row = 1
  return { col, row, width, height }
}

/**
 * Miniature blueprint-style preview of a dashboard layout.
 * Renders a compressed 12-column grid with each panel as a labeled block.
 * Auto-places KPIs in a row at the bottom if they don't have explicit layout
 * so they don't conflict with positioned charts/grids.
 */
export function DashboardMiniMap({ config, className }: DashboardMiniMapProps) {
  const panels = useMemo<MiniPanel[]>(() => {
    const positioned: MiniPanel[] = []
    const cfg = config as Record<string, unknown>

    // 1. Positioned charts
    const charts = (cfg.charts ?? []) as Array<Record<string, unknown>>
    charts.forEach((chart, i) => {
      const layout = readLayout(chart)
      if (layout) {
        positioned.push({
          key: `chart-${i}`,
          ...layout,
          kind: 'chart',
          label: 'CHART',
        })
      }
    })

    // 2. Positioned grids
    const grids = (cfg.grids ?? []) as Array<Record<string, unknown>>
    grids.forEach((grid, i) => {
      const layout = readLayout(grid)
      if (layout) {
        positioned.push({
          key: `grid-${i}`,
          ...layout,
          kind: 'grid',
          label: 'GRID',
        })
      }
    })

    // 3. Positioned KPIs (builder-created)
    const kpis = (cfg.kpis ?? []) as Array<Record<string, unknown>>
    kpis.forEach((kpi, i) => {
      const layout = readLayout(kpi)
      if (layout) {
        positioned.push({
          key: `kpi-${i}`,
          ...layout,
          kind: 'kpi',
          label: 'KPI',
        })
      }
    })

    // 4. Auto-place KPIs WITHOUT layout as a row above positioned panels
    //    Find the minimum row used by positioned panels, insert KPIs above.
    const unpositionedKpis = kpis.filter((k) => !readLayout(k))
    if (unpositionedKpis.length > 0) {
      const visible = Math.min(unpositionedKpis.length, 6)
      const each = Math.max(2, Math.floor(GRID_COLS / visible))

      // Bump all positioned panels down by 1 to make room at row 1
      positioned.forEach((p) => {
        p.row += 1
      })

      let col = 1
      for (let i = 0; i < visible; i++) {
        positioned.push({
          key: `kpi-auto-${i}`,
          col,
          row: 1,
          width: each,
          height: 1,
          kind: 'kpi',
          label: 'KPI',
        })
        col += each
      }
    }

    return positioned
  }, [config])

  const maxRow = useMemo(() => {
    if (panels.length === 0) return 1
    return Math.max(...panels.map((p) => p.row + p.height - 1), 1)
  }, [panels])

  // Cap visible rows to keep preview readable on very tall dashboards.
  // The visual aspect ratio is based on this, not the raw layout, so tall
  // dashboards compress proportionally.
  const totalRows = Math.max(Math.min(maxRow, 10), 4)
  const compression = totalRows / Math.max(maxRow, 1)

  if (panels.length === 0) {
    return (
      <div className={cn('relative h-full w-full overflow-hidden', className)}>
        <BlueprintGridBackdrop density="empty" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
            empty canvas
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <BlueprintGridBackdrop density="full" />

      {/* Panels */}
      <div
        className="absolute inset-1.5 grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))`,
          gap: '2px',
        }}
      >
        {panels.map((panel) => {
          const safeCol = Math.max(1, Math.min(GRID_COLS, panel.col))
          const safeWidth = Math.max(
            1,
            Math.min(GRID_COLS - safeCol + 1, panel.width),
          )
          // Compress row coordinates to fit visible rows
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
                'relative flex items-center justify-center rounded-[2px] overflow-hidden',
                panel.kind === 'chart' &&
                  'bg-primary/15 border border-primary/45 ring-1 ring-inset ring-primary/20',
                panel.kind === 'kpi' &&
                  'bg-primary/55 border border-primary/80',
                panel.kind === 'grid' &&
                  'bg-foreground/5 border border-foreground/30',
              )}
              style={{
                gridColumn: `${safeCol} / span ${safeWidth}`,
                gridRow: `${safeRow} / span ${safeHeight}`,
              }}
            >
              {/* Chart visual: diagonal gradient shimmer */}
              {panel.kind === 'chart' && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/5 to-transparent" />
                  {/* Subtle upward trend line */}
                  {safeWidth >= 3 && safeHeight >= 2 && (
                    <svg
                      className="absolute inset-0 h-full w-full text-primary/60"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <polyline
                        points="5,75 25,55 45,60 65,35 85,25 95,20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </>
              )}

              {/* Grid visual: horizontal stripes */}
              {panel.kind === 'grid' && (
                <div
                  className="absolute inset-0 text-foreground/40"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, currentColor 2px, currentColor 3px)',
                  }}
                />
              )}

              {/* KPI visual: filled accent (pure color) */}

              {/* Label — only when panel is large enough to be readable */}
              {safeWidth >= 4 && safeHeight >= 2 && (
                <span
                  className={cn(
                    'relative z-10 font-mono uppercase tracking-widest text-[7px]',
                    panel.kind === 'chart' && 'text-primary',
                    panel.kind === 'kpi' && 'text-primary-foreground',
                    panel.kind === 'grid' && 'text-foreground/60',
                  )}
                >
                  {panel.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface BlueprintGridBackdropProps {
  density: 'full' | 'empty'
}

/** Architectural blueprint grid backdrop — faint dot grid + crosshairs. */
function BlueprintGridBackdrop({ density }: BlueprintGridBackdropProps) {
  const opacity = density === 'empty' ? 0.15 : 0.2
  return (
    <svg
      className="absolute inset-0 h-full w-full text-primary/40"
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id={`dot-grid-${density}`} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="0.5" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#dot-grid-${density})`} />
    </svg>
  )
}
