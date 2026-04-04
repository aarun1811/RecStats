/**
 * Reads Shadcn CSS variables from the DOM and builds chart theme objects
 * for AG Charts and ECharts that match the application theme.
 */

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

function hslToHex(hsl: string): string {
  // CSS vars may be "240 5.9% 10%" or "oklch(...)" — handle hsl-style
  const parts = hsl.split(/[\s,/]+/).map((s) => parseFloat(s))
  if (parts.length < 3 || parts.some(isNaN)) return hsl

  const h = parts[0]
  const s = parts[1] / 100
  const l = parts[2] / 100

  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function resolveColor(cssVar: string): string {
  const raw = getCssVar(cssVar)
  if (!raw) return '#888888'
  if (raw.startsWith('#') || raw.startsWith('rgb') || raw.startsWith('oklch')) {
    return raw
  }
  return hslToHex(raw)
}

export interface ChartPalette {
  primary: string
  secondary: string
  muted: string
  accent: string
  destructive: string
  background: string
  foreground: string
  mutedForeground: string
  border: string
  series: string[]
}

export function getChartPalette(): ChartPalette {
  const primary = resolveColor('--primary')
  const secondary = resolveColor('--secondary')
  const muted = resolveColor('--muted')
  const accent = resolveColor('--accent')
  const destructive = resolveColor('--destructive')
  const background = resolveColor('--background')
  const foreground = resolveColor('--foreground')
  const mutedForeground = resolveColor('--muted-foreground')
  const border = resolveColor('--border')

  // Series colors — primary + distinct hues for multi-series charts
  const series = [
    primary,
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#f97316', // orange
    '#ec4899', // pink
    '#14b8a6', // teal
  ]

  return {
    primary,
    secondary,
    muted,
    accent,
    destructive,
    background,
    foreground,
    mutedForeground,
    border,
    series,
  }
}

export function getAgChartsTheme() {
  const p = getChartPalette()

  return {
    palette: {
      fills: p.series,
      strokes: p.series,
    },
    overrides: {
      common: {
        background: { fill: 'transparent' },
        title: { color: p.foreground, fontSize: 14, fontWeight: 600 },
        subtitle: { color: p.mutedForeground, fontSize: 12 },
        legend: {
          item: {
            label: { color: p.mutedForeground, fontSize: 12 },
          },
        },
        axes: {
          category: {
            label: { color: p.mutedForeground, fontSize: 11 },
            line: { stroke: p.border },
            gridLine: { style: [{ stroke: p.border, lineDash: [4, 4] }] },
          },
          number: {
            label: { color: p.mutedForeground, fontSize: 11 },
            line: { stroke: p.border },
            gridLine: { style: [{ stroke: p.border, lineDash: [4, 4] }] },
          },
        },
      },
      bar: {
        series: { cornerRadius: 4 },
      },
      line: {
        series: { strokeWidth: 2, marker: { size: 4 } },
      },
      area: {
        series: { strokeWidth: 2, fillOpacity: 0.15, marker: { size: 4 } },
      },
      pie: {
        series: {
          strokeWidth: 1,
          calloutLabel: { color: p.mutedForeground, fontSize: 11 },
          sectorLabel: { color: '#ffffff', fontSize: 11 },
        },
      },
      donut: {
        series: {
          strokeWidth: 1,
          calloutLabel: { color: p.mutedForeground, fontSize: 11 },
          innerRadiusRatio: 0.6,
        },
      },
    },
  }
}

export function getEChartsTheme() {
  const p = getChartPalette()

  return {
    color: p.series,
    backgroundColor: 'transparent',
    textStyle: {
      color: p.foreground,
      fontFamily: 'inherit',
    },
    title: {
      textStyle: { color: p.foreground, fontSize: 14, fontWeight: 600 },
      subtextStyle: { color: p.mutedForeground, fontSize: 12 },
    },
    legend: {
      textStyle: { color: p.mutedForeground, fontSize: 12 },
    },
    tooltip: {
      backgroundColor: p.background,
      borderColor: p.border,
      textStyle: { color: p.foreground, fontSize: 12 },
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: p.border } },
      axisTick: { lineStyle: { color: p.border } },
      axisLabel: { color: p.mutedForeground },
      splitLine: { lineStyle: { color: p.border, type: 'dashed' } },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: p.border } },
      axisTick: { lineStyle: { color: p.border } },
      axisLabel: { color: p.mutedForeground },
      splitLine: { lineStyle: { color: p.border, type: 'dashed' } },
    },
    line: {
      smooth: false,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2 },
    },
    bar: {
      barMaxWidth: 40,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    },
    pie: {
      label: { color: p.mutedForeground },
    },
    radar: {
      axisName: { color: p.mutedForeground },
      splitLine: { lineStyle: { color: p.border } },
      splitArea: { areaStyle: { color: ['transparent', 'transparent'] } },
    },
    gauge: {
      axisLine: { lineStyle: { color: [[1, p.border]] } },
      axisTick: { lineStyle: { color: p.mutedForeground } },
      axisLabel: { color: p.mutedForeground },
      detail: { color: p.foreground },
    },
  }
}
