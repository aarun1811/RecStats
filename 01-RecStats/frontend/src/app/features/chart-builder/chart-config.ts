/**
 * Shared chart configuration constants and types
 */

export interface ColorScheme {
  id: string;
  name: string;
  colors: string[];
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'citi',
    name: 'Citi Blue',
    colors: ['#0066b2', '#3399cc', '#66b2d6', '#99cce6', '#004d86', '#0080cc', '#4db8e8', '#80cfef']
  },
  {
    id: 'success',
    name: 'Success',
    colors: ['#2ecc71', '#27ae60', '#1abc9c', '#16a085', '#3498db', '#2980b9', '#58d68d', '#48c9b0']
  },
  {
    id: 'warm',
    name: 'Warm',
    colors: ['#e74c3c', '#e67e22', '#f1c40f', '#f39c12', '#d35400', '#c0392b', '#f5b041', '#eb984e']
  },
  {
    id: 'cool',
    name: 'Cool',
    colors: ['#9b59b6', '#8e44ad', '#3498db', '#2980b9', '#1abc9c', '#16a085', '#a569bd', '#5dade2']
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    colors: ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c', '#34495e']
  },
  {
    id: 'monochrome',
    name: 'Mono',
    colors: ['#2c3e50', '#34495e', '#7f8c8d', '#95a5a6', '#bdc3c7', '#ecf0f1', '#566573', '#85929e']
  }
];

export function getColorScheme(schemeId: string): string[] {
  const scheme = COLOR_SCHEMES.find(s => s.id === schemeId);
  return scheme?.colors || COLOR_SCHEMES[0].colors;
}

export interface KpiOptions {
  /** Aggregation type: how to compute the main value */
  aggregation: 'sum' | 'average' | 'min' | 'max' | 'count' | 'last';
  /** Number format for display */
  format: 'number' | 'currency' | 'percent';
  /** Currency code (when format is 'currency') */
  currencyCode?: string;
  /** Decimal places */
  decimals?: number;
  /** Prefix to show before value */
  prefix?: string;
  /** Suffix to show after value */
  suffix?: string;
  /** Enable trend indicator */
  showTrend?: boolean;
  /** Column to use for trend comparison (date/time field) */
  trendCompareField?: string;
  /** How to calculate trend */
  trendMode?: 'previous' | 'first_last';
  /** Whether higher values are good (affects trend arrow color) */
  trendUpIsGood?: boolean;
}

export interface ChartConfig {
  title?: string;
  subtitle?: string;
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  colorScheme?: string;
  showLegend?: boolean;
  showLabels?: boolean;
  enableAnimation?: boolean;
  enableTooltip?: boolean;
  /** KPI-specific options (only used for kpiCard chart type) */
  kpiOptions?: KpiOptions;
}
