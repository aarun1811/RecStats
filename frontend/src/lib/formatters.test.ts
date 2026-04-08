import { describe, it, expect } from 'vitest'
import { formatValue, formatValueFull } from './formatters'

describe('formatValue', () => {
  describe('null/undefined handling', () => {
    it('returns empty string for null', () => {
      expect(formatValue(null, { type: 'number' })).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(formatValue(undefined, { type: 'number' })).toBe('')
    })
  })

  describe('number formatting', () => {
    it('formats with abbreviation (compact notation)', () => {
      const result = formatValue(1234567, { type: 'number', abbreviate: true })
      expect(result).toMatch(/1\.2M/i)
    })

    it('formats without abbreviation', () => {
      expect(formatValue(1234567, { type: 'number', abbreviate: false })).toBe(
        '1,234,567',
      )
    })

    it('formats with default (no abbreviation)', () => {
      expect(formatValue(1234567, { type: 'number' })).toBe('1,234,567')
    })

    it('respects decimals option', () => {
      expect(
        formatValue(1234.567, { type: 'number', decimals: 2 }),
      ).toBe('1,234.57')
    })

    it('formats thousands with abbreviation', () => {
      const result = formatValue(45300, { type: 'number', abbreviate: true })
      expect(result).toMatch(/45\.3K/i)
    })
  })

  describe('currency formatting', () => {
    it('formats USD currency', () => {
      expect(
        formatValue(1234.56, {
          type: 'currency',
          currencyCode: 'USD',
          decimals: 2,
        }),
      ).toBe('$1,234.56')
    })

    it('formats EUR currency', () => {
      const result = formatValue(1234.56, {
        type: 'currency',
        currencyCode: 'EUR',
        decimals: 2,
      })
      // Should contain EUR symbol or "EUR"
      expect(result).toMatch(/EUR|€/)
    })

    it('falls back to plain number when no currencyCode', () => {
      const result = formatValue(1234.56, { type: 'currency', decimals: 2 })
      expect(result).toBe('1,234.56')
    })

    it('does not crash when currencyCode is undefined', () => {
      expect(() =>
        formatValue(1234.56, { type: 'currency', currencyCode: undefined }),
      ).not.toThrow()
    })
  })

  describe('percentage formatting', () => {
    it('formats percentage (divides by 100 for Intl)', () => {
      expect(
        formatValue(55.5, { type: 'percentage', decimals: 1 }),
      ).toBe('55.5%')
    })

    it('formats zero percentage', () => {
      expect(
        formatValue(0, { type: 'percentage', decimals: 1 }),
      ).toBe('0.0%')
    })

    it('formats 100 percentage', () => {
      expect(
        formatValue(100, { type: 'percentage', decimals: 0 }),
      ).toBe('100%')
    })
  })

  describe('decimal formatting', () => {
    it('formats decimal with specified decimals', () => {
      expect(
        formatValue(3.14159, { type: 'decimal', decimals: 2 }),
      ).toBe('3.14')
    })

    it('formats decimal with default decimals (2)', () => {
      expect(formatValue(3.14159, { type: 'decimal' })).toBe('3.14')
    })
  })
})

describe('formatValueFull', () => {
  it('always returns non-abbreviated version', () => {
    expect(
      formatValueFull(1234567, { type: 'number', abbreviate: true }),
    ).toBe('1,234,567')
  })

  it('handles null value', () => {
    expect(formatValueFull(null, { type: 'number' })).toBe('')
  })

  it('formats currency without abbreviation', () => {
    expect(
      formatValueFull(1234567.89, {
        type: 'currency',
        currencyCode: 'USD',
        decimals: 2,
        abbreviate: true,
      }),
    ).toBe('$1,234,567.89')
  })
})
