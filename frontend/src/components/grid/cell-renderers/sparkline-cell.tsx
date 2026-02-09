import type { ColDef } from 'ag-grid-community'

/**
 * AG Grid's built-in sparkline cell renderer configuration.
 * Use this as a colDef factory rather than a React component,
 * since AG Grid handles sparkline rendering natively.
 */
interface SparklineCellOptions {
  type?: 'line' | 'bar' | 'area'
  /** CSS color or Shadcn variable reference */
  lineColor?: string
  fillColor?: string
  highlightColor?: string
}

export function createSparklineColDef(
  field: string,
  options: SparklineCellOptions = {},
): Partial<ColDef> {
  const {
    type = 'line',
    lineColor = 'hsl(var(--primary))',
    fillColor = 'hsl(var(--primary) / 0.1)',
    highlightColor = 'hsl(var(--primary))',
  } = options

  if (type === 'bar') {
    return {
      field,
      cellRenderer: 'agSparklineCellRenderer',
      cellRendererParams: {
        sparklineOptions: {
          type: 'bar',
          fill: lineColor,
          paddingOuter: 0.2,
          padding: { top: 4, bottom: 4 },
          axis: { strokeWidth: 0 },
          highlightStyle: {
            fill: highlightColor,
          },
        },
      },
      minWidth: 120,
      sortable: false,
      filter: false,
    }
  }

  return {
    field,
    cellRenderer: 'agSparklineCellRenderer',
    cellRendererParams: {
      sparklineOptions: {
        type,
        line: { stroke: lineColor, strokeWidth: 1.5 },
        padding: { top: 4, bottom: 4 },
        marker: { size: 0 },
        highlightStyle: {
          size: 4,
          fill: highlightColor,
          stroke: highlightColor,
        },
        ...(type === 'area'
          ? { fill: fillColor }
          : {}),
      },
    },
    minWidth: 120,
    sortable: false,
    filter: false,
  }
}
