import type { FormatNumberOptions } from '@/types/formatting'

/**
 * Locale pinned for financial consistency across all users' browser settings.
 * Critical for reconciliation/audit tools — numbers must display identically
 * regardless of user locale. Change this constant to adjust globally.
 */
const LOCALE = 'en-US'

/**
 * Centralized number formatting utility using Intl.NumberFormat.
 * Handles number, currency, percentage, and decimal formatting.
 *
 * @param value - The numeric value to format (null/undefined returns '')
 * @param options - Formatting options (type, decimals, abbreviate, currencyCode)
 * @returns Formatted string
 */
export function formatValue(
  value: number | null | undefined,
  options: FormatNumberOptions,
): string {
  if (value === null || value === undefined) {
    return ''
  }

  const { type, decimals, abbreviate, currencyCode } = options
  const notation: Intl.NumberFormatOptions['notation'] = abbreviate
    ? 'compact'
    : 'standard'

  switch (type) {
    case 'currency': {
      if (currencyCode) {
        return new Intl.NumberFormat(LOCALE, {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: decimals ?? 2,
          maximumFractionDigits: decimals ?? 2,
          notation,
        }).format(value)
      }
      // No currency code — fall back to plain number (per D-14, no hardcoded defaults)
      return new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
        notation,
      }).format(value)
    }

    case 'percentage': {
      // Intl.NumberFormat percent style expects fraction (0.55 for 55%)
      // Our input is already a percentage value (55 for 55%), so divide by 100
      return new Intl.NumberFormat(LOCALE, {
        style: 'percent',
        minimumFractionDigits: decimals ?? 1,
        maximumFractionDigits: decimals ?? 1,
      }).format(value / 100)
    }

    case 'decimal': {
      return new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
        notation,
      }).format(value)
    }

    case 'number':
    default: {
      // When using compact notation, default to 1 fraction digit for readability
      // e.g., 1234567 → "1.2M" instead of "1M"
      const defaultDecimals = abbreviate ? 1 : 0
      return new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals ?? defaultDecimals,
        notation,
      }).format(value)
    }
  }
}

/**
 * Always returns the non-abbreviated (full) version of a formatted number.
 * Useful for hover tooltips showing full values when display is abbreviated.
 */
export function formatValueFull(
  value: number | null | undefined,
  options: FormatNumberOptions,
): string {
  return formatValue(value, { ...options, abbreviate: false })
}
