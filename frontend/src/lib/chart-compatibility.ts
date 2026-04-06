export interface DatasetShape {
  dimensions: number
  measures: number
}

interface ChartRequirement {
  minDim: number
  maxDim?: number
  minMeas: number
  maxMeas?: number
  tooltip: string
}

export const CHART_REQUIREMENTS: Record<string, ChartRequirement> = {
  'bar': { minDim: 1, minMeas: 1, tooltip: 'Requires at least 1 dimension and 1 measure' },
  'stacked-bar': { minDim: 1, minMeas: 1, tooltip: 'Requires at least 1 dimension and 1 measure' },
  'line': { minDim: 1, minMeas: 1, tooltip: 'Requires at least 1 dimension and 1 measure' },
  'area': { minDim: 1, minMeas: 1, tooltip: 'Requires at least 1 dimension and 1 measure' },
  'pie': { minDim: 1, minMeas: 1, maxMeas: 1, tooltip: 'Requires 1 dimension and exactly 1 measure' },
  'donut': { minDim: 1, minMeas: 1, maxMeas: 1, tooltip: 'Requires 1 dimension and exactly 1 measure' },
  'scatter': { minDim: 0, minMeas: 2, tooltip: 'Requires at least 2 measure columns' },
  'heatmap': { minDim: 2, maxDim: 2, minMeas: 1, maxMeas: 1, tooltip: 'Requires 2 dimensions and 1 measure' },
  'treemap': { minDim: 1, minMeas: 1, maxMeas: 1, tooltip: 'Requires at least 1 dimension and 1 measure' },
  'waterfall': { minDim: 1, maxDim: 1, minMeas: 1, maxMeas: 1, tooltip: 'Requires 1 dimension and 1 measure' },
  'bullet': { minDim: 1, minMeas: 1, tooltip: 'Requires at least 1 dimension and 1 measure' },
  'box-plot': { minDim: 1, minMeas: 1, tooltip: 'Requires at least 1 dimension and 1 measure' },
  'combo': { minDim: 1, minMeas: 2, tooltip: 'Requires 1 dimension and at least 2 measures' },
  'sankey': { minDim: 2, maxDim: 2, minMeas: 1, maxMeas: 1, tooltip: 'Requires 2 dimensions and 1 measure (source, target, value)' },
  'sunburst': { minDim: 2, minMeas: 1, maxMeas: 1, tooltip: 'Requires 2+ dimensions and 1 measure' },
  'radar': { minDim: 1, minMeas: 2, tooltip: 'Requires 1 dimension and at least 2 measures' },
  'gauge': { minDim: 0, minMeas: 1, maxMeas: 1, tooltip: 'Requires exactly 1 measure column' },
  'funnel': { minDim: 1, maxDim: 1, minMeas: 1, maxMeas: 1, tooltip: 'Requires 1 dimension and 1 measure' },
  'graph': { minDim: 2, maxDim: 2, minMeas: 1, maxMeas: 1, tooltip: 'Requires 2 dimensions and 1 measure (source, target, weight)' },
  'parallel': { minDim: 1, minMeas: 2, tooltip: 'Requires 1 dimension and at least 2 measures' },
}

export function getDatasetShape(columns: { role: string }[]): DatasetShape {
  let dimensions = 0
  let measures = 0
  for (const col of columns) {
    if (col.role === 'dimension' || col.role === 'time') dimensions++
    else if (col.role === 'measure') measures++
    // 'none' role columns do not count as either
  }
  return { dimensions, measures }
}

export function isChartTypeCompatible(
  chartType: string,
  shape: DatasetShape,
): { compatible: boolean; tooltip: string } {
  const req = CHART_REQUIREMENTS[chartType]
  if (!req) return { compatible: false, tooltip: 'Unknown chart type' }

  const dimOk = shape.dimensions >= req.minDim
    && (req.maxDim === undefined || shape.dimensions <= req.maxDim)
  const measOk = shape.measures >= req.minMeas
    && (req.maxMeas === undefined || shape.measures <= req.maxMeas)

  return {
    compatible: dimOk && measOk,
    tooltip: dimOk && measOk ? '' : req.tooltip,
  }
}
