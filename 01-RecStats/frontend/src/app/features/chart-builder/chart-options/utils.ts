/**
 * Chart utility functions
 */

/** Convert hex color to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Format large numbers with K/M suffix */
export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// ============================================
// KPI Card Utility Functions
// ============================================

export type AggregationType = 'sum' | 'average' | 'min' | 'max' | 'count' | 'last';

export interface FormatOptions {
  format: 'number' | 'currency' | 'percent';
  decimals?: number;
  currencyCode?: string;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
}

export interface TrendResult {
  direction: 'up' | 'down' | 'neutral';
  percentage: number;
  previousValue: number;
  currentValue: number;
}

/** Aggregate data using specified method */
export function aggregate(data: any[], field: string, type: AggregationType): number {
  if (!data || data.length === 0) return 0;

  const values = data.map(row => Number(row[field]) || 0);

  switch (type) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'average':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.filter(v => v !== 0 && !isNaN(v)).length;
    case 'last':
      return values[values.length - 1];
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

/** Format value with options (currency, percent, etc.) */
export function formatValue(value: number, options: FormatOptions): string {
  let result: string;
  const decimals = options.decimals ?? (options.format === 'percent' ? 1 : 0);
  const compact = options.compact !== false;

  switch (options.format) {
    case 'currency': {
      const currencySymbol = options.currencyCode === 'EUR' ? '€' :
                             options.currencyCode === 'GBP' ? '£' :
                             options.currencyCode === 'JPY' ? '¥' : '$';
      if (compact && Math.abs(value) >= 1000000) {
        result = currencySymbol + (value / 1000000).toFixed(1) + 'M';
      } else if (compact && Math.abs(value) >= 1000) {
        result = currencySymbol + (value / 1000).toFixed(1) + 'K';
      } else {
        result = currencySymbol + value.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      }
      break;
    }

    case 'percent':
      result = value.toFixed(decimals) + '%';
      break;

    case 'number':
    default:
      if (compact && Math.abs(value) >= 1000000) {
        result = (value / 1000000).toFixed(1) + 'M';
      } else if (compact && Math.abs(value) >= 1000) {
        result = (value / 1000).toFixed(1) + 'K';
      } else {
        result = value.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      }
      break;
  }

  // Apply custom prefix/suffix (override default currency symbol if prefix provided)
  if (options.prefix && options.format !== 'currency') {
    result = options.prefix + result;
  }
  if (options.suffix) {
    result = result + options.suffix;
  }

  return result;
}

/** Calculate trend by comparing values over a comparison field (usually date) */
export function calculateTrend(
  data: any[],
  valueField: string,
  compareField: string,
  mode: 'previous' | 'first_last'
): TrendResult | null {
  if (!data || data.length < 2) return null;

  // Sort by compare field
  const sorted = [...data].sort((a, b) => {
    const aVal = a[compareField];
    const bVal = b[compareField];
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  });

  let previousValue: number;
  let currentValue: number;

  if (mode === 'first_last') {
    previousValue = Number(sorted[0][valueField]) || 0;
    currentValue = Number(sorted[sorted.length - 1][valueField]) || 0;
  } else {
    // 'previous' mode - compare last two entries
    previousValue = Number(sorted[sorted.length - 2][valueField]) || 0;
    currentValue = Number(sorted[sorted.length - 1][valueField]) || 0;
  }

  if (previousValue === 0) return null;

  const percentage = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  const direction = percentage > 0.5 ? 'up' : percentage < -0.5 ? 'down' : 'neutral';

  return { direction, percentage, previousValue, currentValue };
}

/** Calculate adaptive font size based on container and text length */
export function getAdaptiveFontSize(
  containerWidth: number,
  containerHeight: number,
  textLength: number,
  baseSize: number
): number {
  // Estimate text width based on character count
  const estimatedTextWidth = textLength * (baseSize * 0.6);
  const maxWidth = containerWidth * 0.85;

  let scaledSize = baseSize;
  if (estimatedTextWidth > maxWidth) {
    scaledSize = Math.floor(baseSize * (maxWidth / estimatedTextWidth));
  }

  // Also cap by height
  const maxHeight = containerHeight * 0.35;
  if (scaledSize > maxHeight) {
    scaledSize = Math.floor(maxHeight);
  }

  // Minimum readable size
  return Math.max(scaledSize, 24);
}
