import type { AgChartOptions } from 'ag-charts-community'

import type { ChartConfig } from '@/types/chart'

type EChartsOption = Record<string, unknown>

/**
 * Builds AG Charts options object from chart config + data.
 *
 * AG Charts v13 uses strict discriminated union types for AgChartOptions.
 * We build the options as a plain object and cast at the boundary since
 * the exact series type depends on runtime chart config.
 */
export function buildAgChartOptions(
  config: ChartConfig,
  data: Record<string, unknown>[],
): AgChartOptions {
  const opts = config.options
  const xKey = (opts['xKey'] as string | undefined) ?? 'date'
  const yKey = (opts['yKey'] as string | undefined) ?? 'value'
  const seriesKey = opts['seriesKey'] as string | undefined
  const categoryKey = (opts['categoryKey'] as string | undefined) ?? 'category'
  const valueKey = (opts['valueKey'] as string | undefined) ?? 'value'

  switch (config.type) {
    case 'line':
      return buildLineSeries(data, xKey, yKey, seriesKey)
    case 'bar':
      return buildBarSeries(data, xKey, yKey, seriesKey)
    case 'area':
      return buildAreaSeries(data, xKey, yKey, seriesKey)
    case 'pie':
      return buildPieSeries(data, categoryKey, valueKey)
    case 'donut':
      return buildDonutSeries(data, categoryKey, valueKey)
    case 'scatter':
      return buildScatterSeries(data, xKey, yKey)
    case 'histogram':
      return buildHistogramSeries(data, xKey)
    case 'waterfall':
      return buildWaterfallSeries(data, xKey, yKey)
    case 'combo':
      return buildComboSeries(data, opts)
    default:
      return buildBarSeries(data, xKey, yKey, seriesKey)
  }
}

function buildLineSeries(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  seriesKey?: string,
): AgChartOptions {
  if (seriesKey) {
    const groups = getSeriesGroups(data, seriesKey)
    return {
      data,
      series: groups.map((name) => ({
        type: 'line' as const,
        xKey,
        yKey,
        data: data.filter((d) => d[seriesKey] === name),
        yName: name,
      })),
    }
  }
  return {
    data,
    series: [{ type: 'line' as const, xKey, yKey }],
  }
}

function buildBarSeries(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  seriesKey?: string,
): AgChartOptions {
  if (seriesKey) {
    const groups = getSeriesGroups(data, seriesKey)
    return {
      data,
      series: groups.map((name) => ({
        type: 'bar' as const,
        xKey,
        yKey,
        data: data.filter((d) => d[seriesKey] === name),
        yName: name,
        stacked: true,
      })),
    }
  }
  return {
    data,
    series: [{ type: 'bar' as const, xKey, yKey }],
  }
}

function buildAreaSeries(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  seriesKey?: string,
): AgChartOptions {
  if (seriesKey) {
    const groups = getSeriesGroups(data, seriesKey)
    return {
      data,
      series: groups.map((name) => ({
        type: 'area' as const,
        xKey,
        yKey,
        data: data.filter((d) => d[seriesKey] === name),
        yName: name,
        stacked: true,
      })),
    }
  }
  return {
    data,
    series: [{ type: 'area' as const, xKey, yKey }],
  }
}

function buildPieSeries(
  data: Record<string, unknown>[],
  categoryKey: string,
  valueKey: string,
): AgChartOptions {
  return {
    data,
    series: [
      {
        type: 'pie' as const,
        angleKey: valueKey,
        calloutLabelKey: categoryKey,
        sectorLabelKey: valueKey,
      },
    ],
  }
}

function buildDonutSeries(
  data: Record<string, unknown>[],
  categoryKey: string,
  valueKey: string,
): AgChartOptions {
  return {
    data,
    series: [
      {
        type: 'donut' as const,
        angleKey: valueKey,
        calloutLabelKey: categoryKey,
        sectorLabelKey: valueKey,
        innerRadiusRatio: 0.6,
      },
    ],
  }
}

function buildScatterSeries(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
): AgChartOptions {
  return {
    data,
    series: [{ type: 'scatter' as const, xKey, yKey }],
  }
}

function buildHistogramSeries(
  data: Record<string, unknown>[],
  xKey: string,
): AgChartOptions {
  return {
    data,
    series: [{ type: 'histogram' as const, xKey }],
  }
}

function buildWaterfallSeries(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
): AgChartOptions {
  return {
    data,
    series: [{ type: 'waterfall' as const, xKey, yKey }],
  }
}

function buildComboSeries(
  data: Record<string, unknown>[],
  opts: Record<string, unknown>,
): AgChartOptions {
  // For combo charts the caller provides fully-typed series array
  const series = opts['series'] as AgChartOptions['series'] | undefined
  return {
    data,
    series: series ?? [],
  } as AgChartOptions
}

function getSeriesGroups(
  data: Record<string, unknown>[],
  seriesKey: string,
): string[] {
  const unique = new Set<string>()
  for (const row of data) {
    const val = row[seriesKey]
    if (val !== undefined && val !== null) {
      unique.add(String(val))
    }
  }
  return Array.from(unique)
}

/**
 * Builds ECharts options object from chart config + data.
 */
export function buildEChartOptions(
  config: ChartConfig,
  data: Record<string, unknown>[],
): EChartsOption {
  const opts = config.options

  switch (config.type) {
    case 'sankey':
      return buildSankeyOptions(data, opts)
    case 'radar':
      return buildRadarOptions(data, opts)
    case 'sunburst':
      return buildSunburstOptions(data)
    case 'gauge':
      return buildGaugeOptions(data, opts)
    case 'funnel':
      return buildFunnelOptions(data, opts)
    case 'graph':
      return buildGraphOptions(data, opts)
    case 'parallel':
      return buildParallelOptions(data, opts)
    default:
      return {}
  }
}

function buildSankeyOptions(
  data: Record<string, unknown>[],
  opts: Record<string, unknown>,
): EChartsOption {
  const sourceKey = (opts['sourceKey'] as string | undefined) ?? 'source'
  const targetKey = (opts['targetKey'] as string | undefined) ?? 'target'
  const valueKey = (opts['valueKey'] as string | undefined) ?? 'value'

  const nodes = new Set<string>()
  const links: { source: string; target: string; value: number }[] = []

  for (const row of data) {
    const source = String(row[sourceKey] ?? '')
    const target = String(row[targetKey] ?? '')
    const value = Number(row[valueKey] ?? 0)
    nodes.add(source)
    nodes.add(target)
    links.push({ source, target, value })
  }

  return {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'sankey',
        data: Array.from(nodes).map((name) => ({ name })),
        links,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', curveness: 0.5 },
        animationDuration: 300,
      },
    ],
  }
}

function buildRadarOptions(
  data: Record<string, unknown>[],
  opts: Record<string, unknown>,
): EChartsOption {
  const indicators = (opts['indicators'] as { name: string; max: number }[] | undefined) ?? []
  const nameKey = (opts['nameKey'] as string | undefined) ?? 'name'

  const seriesData = data.map((row) => ({
    name: String(row[nameKey] ?? ''),
    value: indicators.map((ind) => Number(row[ind.name] ?? 0)),
  }))

  return {
    tooltip: { trigger: 'item' },
    legend: {
      data: seriesData.map((s) => s.name),
      bottom: 0,
    },
    radar: {
      indicator: indicators,
    },
    series: [
      {
        type: 'radar',
        data: seriesData,
        areaStyle: { opacity: 0.15 },
        animationDuration: 300,
      },
    ],
  }
}

function buildSunburstOptions(
  data: Record<string, unknown>[],
): EChartsOption {
  return {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'sunburst',
        data,
        radius: ['15%', '90%'],
        emphasis: { focus: 'ancestor' },
        animationDuration: 300,
      },
    ],
  }
}

function buildGaugeOptions(
  data: Record<string, unknown>[],
  opts: Record<string, unknown>,
): EChartsOption {
  const valueKey = (opts['valueKey'] as string | undefined) ?? 'value'
  const nameKey = (opts['nameKey'] as string | undefined) ?? 'name'
  const firstRow = data[0]
  const value = firstRow ? Number(firstRow[valueKey] ?? 0) : 0
  const name = firstRow ? String(firstRow[nameKey] ?? '') : ''

  return {
    tooltip: { formatter: '{a} <br/>{b} : {c}%' },
    series: [
      {
        type: 'gauge',
        data: [{ value, name }],
        detail: { formatter: '{value}%' },
        animationDuration: 300,
      },
    ],
  }
}

function buildFunnelOptions(
  data: Record<string, unknown>[],
  opts: Record<string, unknown>,
): EChartsOption {
  const nameKey = (opts['nameKey'] as string | undefined) ?? 'name'
  const valueKey = (opts['valueKey'] as string | undefined) ?? 'value'

  return {
    tooltip: { trigger: 'item', formatter: '{a} <br/>{b} : {c}%' },
    series: [
      {
        type: 'funnel',
        data: data.map((row) => ({
          name: String(row[nameKey] ?? ''),
          value: Number(row[valueKey] ?? 0),
        })),
        sort: 'descending',
        gap: 2,
        label: { show: true, position: 'inside' },
        animationDuration: 300,
      },
    ],
  }
}

function buildGraphOptions(
  data: Record<string, unknown>[],
  opts: Record<string, unknown>,
): EChartsOption {
  const nodes = (opts['nodes'] as Record<string, unknown>[] | undefined) ?? data
  const links = (opts['links'] as Record<string, unknown>[] | undefined) ?? []

  return {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: nodes,
        links,
        roam: true,
        force: { repulsion: 100 },
        emphasis: { focus: 'adjacency' },
        animationDuration: 300,
      },
    ],
  }
}

function buildParallelOptions(
  data: Record<string, unknown>[],
  opts: Record<string, unknown>,
): EChartsOption {
  const rawDimensions = opts['dimensions'] as
    | { name: string; type?: string }[]
    | undefined
  const dimensions: { name: string; type?: string }[] =
    rawDimensions ?? Object.keys(data[0] ?? {}).map((name) => ({ name }))

  return {
    parallelAxis: dimensions.map((dim, index) => ({
      dim: index,
      name: dim.name,
      ...(dim.type ? { type: dim.type } : { type: 'value' }),
    })),
    series: [
      {
        type: 'parallel',
        data: data.map((row) =>
          dimensions.map((dim) => row[dim.name]),
        ),
        lineStyle: { opacity: 0.3 },
        animationDuration: 300,
      },
    ],
  }
}
