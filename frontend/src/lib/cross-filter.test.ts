import { describe, it, expect } from 'vitest'
import type { CrossFilter } from '@/types/filter'
import type { ChartDataResponse } from '@/types/chart'
import {
  applyCrossFilters,
  rowPassesCrossFilters,
  applyCrossFiltersToRows,
} from './cross-filter'

describe('applyCrossFilters', () => {
  const makeData = (rows: Record<string, unknown>[]): ChartDataResponse => ({
    chartId: 'test',
    columns: Object.keys(rows[0] ?? {}),
    data: rows,
    rowCount: rows.length,
  })

  it('filters rows where column matches', () => {
    const data = makeData([
      { region: 'APAC', count: 10 },
      { region: 'EMEA', count: 20 },
      { region: 'APAC', count: 30 },
    ])
    const filters: CrossFilter[] = [
      { sourceChartId: 'chart-a', column: 'region', value: 'APAC' },
    ]
    const result = applyCrossFilters(data, filters, 'chart-b')
    expect(result?.data).toHaveLength(2)
    expect(result?.data.every((r) => r.region === 'APAC')).toBe(true)
  })

  it('skips when column is absent from data', () => {
    const data = makeData([
      { country: 'US', count: 10 },
      { country: 'UK', count: 20 },
    ])
    const filters: CrossFilter[] = [
      { sourceChartId: 'chart-a', column: 'region', value: 'APAC' },
    ]
    const result = applyCrossFilters(data, filters, 'chart-b')
    expect(result?.data).toHaveLength(2) // unaffected
  })

  it('excludes filters from selfChartId (self-exclusion)', () => {
    const data = makeData([
      { region: 'APAC', count: 10 },
      { region: 'EMEA', count: 20 },
    ])
    const filters: CrossFilter[] = [
      { sourceChartId: 'chart-a', column: 'region', value: 'APAC' },
    ]
    const result = applyCrossFilters(data, filters, 'chart-a') // self
    expect(result?.data).toHaveLength(2) // no filtering applied
  })

  it('returns original data when no cross-filters', () => {
    const data = makeData([{ region: 'APAC', count: 10 }])
    const result = applyCrossFilters(data, [], 'chart-a')
    expect(result).toBe(data) // same reference
  })

  it('returns undefined data as-is', () => {
    const result = applyCrossFilters(undefined, [
      { sourceChartId: 'a', column: 'x', value: 'y' },
    ], 'b')
    expect(result).toBeUndefined()
  })
})

describe('rowPassesCrossFilters', () => {
  it('returns true when all filter columns match', () => {
    const row = { region: 'APAC', desk: 'FX' }
    const filters: CrossFilter[] = [
      { sourceChartId: 'a', column: 'region', value: 'APAC' },
      { sourceChartId: 'b', column: 'desk', value: 'FX' },
    ]
    expect(rowPassesCrossFilters(row, filters)).toBe(true)
  })

  it('returns true when filter column is absent from row (skip)', () => {
    const row = { country: 'US', count: 10 }
    const filters: CrossFilter[] = [
      { sourceChartId: 'a', column: 'region', value: 'APAC' },
    ]
    expect(rowPassesCrossFilters(row, filters)).toBe(true)
  })

  it('returns false when a column does not match', () => {
    const row = { region: 'EMEA', count: 10 }
    const filters: CrossFilter[] = [
      { sourceChartId: 'a', column: 'region', value: 'APAC' },
    ]
    expect(rowPassesCrossFilters(row, filters)).toBe(false)
  })

  it('returns true for empty filters', () => {
    const row = { region: 'APAC' }
    expect(rowPassesCrossFilters(row, [])).toBe(true)
  })
})

describe('applyCrossFiltersToRows', () => {
  it('filters raw Record<string, unknown>[] arrays', () => {
    const rows = [
      { region: 'APAC', amount: 100 },
      { region: 'EMEA', amount: 200 },
      { region: 'APAC', amount: 300 },
    ]
    const filters: CrossFilter[] = [
      { sourceChartId: 'a', column: 'region', value: 'APAC' },
    ]
    const result = applyCrossFiltersToRows(rows, filters)
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.region === 'APAC')).toBe(true)
  })

  it('returns original rows when crossFilters is empty', () => {
    const rows = [
      { region: 'APAC', amount: 100 },
      { region: 'EMEA', amount: 200 },
    ]
    const result = applyCrossFiltersToRows(rows, [])
    expect(result).toBe(rows) // same reference
  })

  it('returns original rows when rows array is empty', () => {
    const rows: Record<string, unknown>[] = []
    const filters: CrossFilter[] = [
      { sourceChartId: 'a', column: 'region', value: 'APAC' },
    ]
    const result = applyCrossFiltersToRows(rows, filters)
    expect(result).toBe(rows)
  })

  it('skips filter when column is absent from rows', () => {
    const rows = [
      { country: 'US', amount: 100 },
      { country: 'UK', amount: 200 },
    ]
    const filters: CrossFilter[] = [
      { sourceChartId: 'a', column: 'region', value: 'APAC' },
    ]
    const result = applyCrossFiltersToRows(rows, filters)
    expect(result).toHaveLength(2)
  })
})
