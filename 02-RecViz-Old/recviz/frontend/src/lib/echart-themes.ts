import * as echarts from 'echarts'

const fontFamily = 'Inter, Geist, system-ui, sans-serif'

const colorPalette = [
  'hsl(220, 70%, 50%)',
  'hsl(160, 60%, 45%)',
  'hsl(30, 80%, 55%)',
  'hsl(280, 65%, 60%)',
  'hsl(340, 75%, 55%)',
]

export const recvizEChartsThemeLight = {
  color: colorPalette,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily,
    fontSize: 12,
    color: '#374151',
  },
  title: {
    textStyle: {
      fontFamily,
      fontSize: 16,
      fontWeight: 600,
      color: '#111827',
    },
    subtextStyle: {
      fontFamily,
      fontSize: 13,
      color: '#6b7280',
    },
  },
  legend: {
    textStyle: {
      fontFamily,
      fontSize: 12,
      color: '#374151',
    },
    bottom: 0,
  },
  tooltip: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    textStyle: {
      fontFamily,
      fontSize: 12,
      color: '#111827',
    },
    extraCssText: 'border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#e5e7eb' } },
    axisTick: { lineStyle: { color: '#e5e7eb' } },
    axisLabel: { color: '#6b7280', fontFamily },
    splitLine: { lineStyle: { color: '#f3f4f6' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#e5e7eb' } },
    axisTick: { lineStyle: { color: '#e5e7eb' } },
    axisLabel: { color: '#6b7280', fontFamily },
    splitLine: { lineStyle: { color: '#f3f4f6' } },
  },
}

export const recvizEChartsThemeDark = {
  color: colorPalette,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily,
    fontSize: 12,
    color: '#d1d5db',
  },
  title: {
    textStyle: {
      fontFamily,
      fontSize: 16,
      fontWeight: 600,
      color: '#f9fafb',
    },
    subtextStyle: {
      fontFamily,
      fontSize: 13,
      color: '#9ca3af',
    },
  },
  legend: {
    textStyle: {
      fontFamily,
      fontSize: 12,
      color: '#d1d5db',
    },
    bottom: 0,
  },
  tooltip: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
    borderWidth: 1,
    textStyle: {
      fontFamily,
      fontSize: 12,
      color: '#f9fafb',
    },
    extraCssText: 'border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#374151' } },
    axisTick: { lineStyle: { color: '#374151' } },
    axisLabel: { color: '#9ca3af', fontFamily },
    splitLine: { lineStyle: { color: '#1f2937' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#374151' } },
    axisTick: { lineStyle: { color: '#374151' } },
    axisLabel: { color: '#9ca3af', fontFamily },
    splitLine: { lineStyle: { color: '#1f2937' } },
  },
}

/** Register both themes with ECharts */
export function registerEChartsThemes() {
  echarts.registerTheme('recviz-light', recvizEChartsThemeLight)
  echarts.registerTheme('recviz-dark', recvizEChartsThemeDark)
}

/** Get the ECharts theme name based on dark mode preference */
export function getEChartsThemeName(isDark: boolean): string {
  return isDark ? 'recviz-dark' : 'recviz-light'
}

// Register themes on module load
registerEChartsThemes()
