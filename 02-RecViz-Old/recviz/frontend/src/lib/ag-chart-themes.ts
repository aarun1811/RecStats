import type { AgChartTheme } from 'ag-charts-community'

const fontFamily = 'Inter, Geist, system-ui, sans-serif'

const FILLS = [
  'hsl(220, 70%, 50%)',
  'hsl(160, 60%, 45%)',
  'hsl(30, 80%, 55%)',
  'hsl(280, 65%, 60%)',
  'hsl(340, 75%, 55%)',
]

const STROKES = [
  'hsl(220, 70%, 40%)',
  'hsl(160, 60%, 35%)',
  'hsl(30, 80%, 45%)',
  'hsl(280, 65%, 50%)',
  'hsl(340, 75%, 45%)',
]

/**
 * AG Charts theme that matches the Shadcn/ui design system.
 */
export const recvizChartTheme: AgChartTheme = {
  baseTheme: 'ag-default',
  palette: {
    fills: FILLS,
    strokes: STROKES,
  },
  overrides: {
    common: {
      title: {
        fontSize: 16,
        fontWeight: 600,
        fontFamily,
      },
      subtitle: {
        fontSize: 13,
        fontFamily,
      },
      legend: {
        position: 'bottom',
        item: {
          label: {
            fontSize: 12,
            fontFamily,
          },
        },
      },
      animation: {
        enabled: true,
      },
      tooltip: {},
    },
    bar: {
      series: {
        cornerRadius: 4,
        tooltip: {
          renderer: undefined,
        },
      },
    },
    line: {
      series: {
        strokeWidth: 2,
        marker: {
          enabled: true,
          size: 5,
        },
      },
    },
    area: {
      series: {
        strokeWidth: 2,
        fillOpacity: 0.2,
        marker: {
          enabled: false,
        },
      },
    },
    pie: {
      series: {
        strokeWidth: 1,
        calloutLabel: {
          fontSize: 12,
          fontFamily,
        },
        sectorLabel: {
          fontSize: 12,
          fontFamily,
        },
        tooltip: {
          renderer: undefined,
        },
      },
    },
    donut: {
      series: {
        strokeWidth: 1,
        innerRadiusRatio: 0.6,
        calloutLabel: {
          fontSize: 12,
          fontFamily,
        },
        tooltip: {
          renderer: undefined,
        },
      },
    },
    scatter: {
      series: {
        size: 8,
      },
    },
  },
}

export const recvizChartThemeDark: AgChartTheme = {
  ...recvizChartTheme,
  baseTheme: 'ag-default-dark',
}

/** Get the chart theme based on current dark mode preference */
export function getChartTheme(isDark: boolean): AgChartTheme {
  return isDark ? recvizChartThemeDark : recvizChartTheme
}
