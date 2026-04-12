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

function cssColorToHex(color: string): string {
  // Use a temporary element to let the browser resolve any CSS color (oklch, hsl, etc.) to rgb
  const el = document.createElement('div')
  el.style.color = color
  document.body.appendChild(el)
  const computed = getComputedStyle(el).color
  document.body.removeChild(el)
  // computed is typically "rgb(r, g, b)" or "rgba(r, g, b, a)"
  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const [, r, g, b] = match
    return `#${Number(r).toString(16).padStart(2, '0')}${Number(g).toString(16).padStart(2, '0')}${Number(b).toString(16).padStart(2, '0')}`
  }
  return '#888888'
}

/**
 * Hard-coded hex fallbacks for CSS variables, used when getComputedStyle
 * returns empty (e.g., DOM not yet painted, headless test environment).
 * Addresses review concern: LOW — getComputedStyle timing safety.
 */
const HEX_FALLBACKS: Record<string, string> = {
  '--series-1': '#93b8e8',
  '--series-2': '#4d7adb',
  '--series-3': '#3a5fc9',
  '--series-4': '#3050b8',
  '--series-5': '#2641a0',
  '--series-6': '#2fb898',
  '--series-7': '#d4a030',
  '--series-8': '#8b5cf6',
  '--color-ramp-low': '#93b8e8',
  '--color-ramp-high': '#2641a0',
  '--chart-positive': '#22c55e',
  '--chart-negative': '#ef4444',
  '--chart-warning': '#d4a030',
  '--primary-foreground': '#f0f0ff',
}

export function resolveColor(cssVar: string): string {
  const raw = getCssVar(cssVar)
  if (!raw || raw.trim() === '') {
    // Fallback: DOM not yet painted or variable undefined
    return HEX_FALLBACKS[cssVar] ?? '#888888'
  }
  if (raw.startsWith('#')) return raw
  if (raw.startsWith('rgb')) return raw
  if (raw.startsWith('oklch') || raw.startsWith('lch') || raw.startsWith('lab')) {
    // oklch/lch/lab: browsers may not resolve these to rgb in getComputedStyle.
    // Prefer HEX_FALLBACKS (authoritative for our palette), fall back to cssColorToHex.
    if (HEX_FALLBACKS[cssVar]) return HEX_FALLBACKS[cssVar]
    return cssColorToHex(raw)
  }
  if (raw.startsWith('hsl')) {
    return cssColorToHex(raw)
  }
  // Legacy: bare "H S% L%" values from older Shadcn setups
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

  // Series colors — read from CSS variables (Mist+Blue palette)
  const series = [
    resolveColor('--series-1'),
    resolveColor('--series-2'),
    resolveColor('--series-3'),
    resolveColor('--series-4'),
    resolveColor('--series-5'),
    resolveColor('--series-6'),
    resolveColor('--series-7'),
    resolveColor('--series-8'),
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
          sectorLabel: { color: resolveColor('--primary-foreground'), fontSize: 11 },
        },
      },
      donut: {
        series: {
          strokeWidth: 1,
          calloutLabel: { color: p.mutedForeground, fontSize: 11 },
          innerRadiusRatio: 0.6,
        },
      },
      heatmap: {
        series: {
          colorRange: [resolveColor('--color-ramp-low'), resolveColor('--color-ramp-high')],
          label: { enabled: false },
          stroke: p.background,
          strokeWidth: 2,
        },
      },
      treemap: {
        series: {
          colorRange: [resolveColor('--chart-positive'), resolveColor('--chart-negative')],
          tile: {
            label: { fontSize: 12, minimumFontSize: 9, color: p.foreground },
            padding: 6,
            gap: 2,
          },
          group: {
            label: { fontSize: 14, color: p.foreground },
            padding: 8,
            gap: 4,
          },
        },
      },
      waterfall: {
        series: {
          item: {
            positive: { name: 'Increase' },
            negative: { name: 'Decrease' },
          },
          line: { strokeWidth: 2 },
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
