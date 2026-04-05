import { describe, it, expect } from 'vitest'
import { recomputeKpis } from './kpi-aggregator'
import type { KpiConfig, DataSourceQueryResponse } from '@/types/dashboard-config'
import type { CrossFilter } from '@/types/filter'

function makeKpiConfig(overrides: Partial<KpiConfig> & { id: string }): KpiConfig {
  return {
    label: overrides.id,
    format: 'number',
    sources: [],
    aggregation: 'sum',
    ...overrides,
  }
}

function makeDataSourceResponse(
  rows: Record<string, unknown>[],
): DataSourceQueryResponse {
  return {
    columns: Object.keys(rows[0] ?? {}),
    rows,
    rowCount: rows.length,
    truncated: false,
  }
}

describe('recomputeKpis', () => {
  it('sums metric column for simple KPIs', () => {
    const kpis: KpiConfig[] = [
      makeKpiConfig({
        id: 'total-breaks',
        sources: [{ dataSourceId: 'ds1', metric: 'break_count' }],
      }),
    ]

    const dataCache = new Map<string, DataSourceQueryResponse>()
    dataCache.set(
      'ds1',
      makeDataSourceResponse([
        { region: 'APAC', break_count: 10 },
        { region: 'EMEA', break_count: 20 },
        { region: 'APAC', break_count: 30 },
      ]),
    )

    const filters: CrossFilter[] = [
      { sourceChartId: 'chart-a', column: 'region', value: 'APAC' },
    ]

    const result = recomputeKpis(kpis, dataCache, filters)
    expect(result.kpis[0].value).toBe(40) // 10 + 30
  })

  it('computes percentage_of correctly (numerator/denominator*100)', () => {
    const kpis: KpiConfig[] = [
      makeKpiConfig({
        id: 'total',
        sources: [{ dataSourceId: 'ds1', metric: 'amount' }],
      }),
      makeKpiConfig({
        id: 'rate',
        sources: [{ dataSourceId: 'ds1', metric: 'matched' }],
        trend: { type: 'percentage_of', referenceKpi: 'total' },
      }),
    ]

    const dataCache = new Map<string, DataSourceQueryResponse>()
    dataCache.set(
      'ds1',
      makeDataSourceResponse([
        { region: 'APAC', amount: 100, matched: 80 },
        { region: 'APAC', amount: 200, matched: 150 },
      ]),
    )

    const filters: CrossFilter[] = [
      { sourceChartId: 'chart-a', column: 'region', value: 'APAC' },
    ]

    const result = recomputeKpis(kpis, dataCache, filters)
    const rateKpi = result.kpis.find((k) => k.id === 'rate')!
    const totalKpi = result.kpis.find((k) => k.id === 'total')!

    expect(totalKpi.value).toBe(300) // 100 + 200
    expect(rateKpi.value).toBe(230) // 80 + 150
    expect(rateKpi.percentage).toBeCloseTo((230 / 300) * 100, 2) // ~76.67%
  })

  it('returns 0 when no rows match cross-filter', () => {
    const kpis: KpiConfig[] = [
      makeKpiConfig({
        id: 'total',
        sources: [{ dataSourceId: 'ds1', metric: 'amount' }],
      }),
    ]

    const dataCache = new Map<string, DataSourceQueryResponse>()
    dataCache.set(
      'ds1',
      makeDataSourceResponse([
        { region: 'APAC', amount: 100 },
        { region: 'EMEA', amount: 200 },
      ]),
    )

    const filters: CrossFilter[] = [
      { sourceChartId: 'chart-a', column: 'region', value: 'LATAM' },
    ]

    const result = recomputeKpis(kpis, dataCache, filters)
    expect(result.kpis[0].value).toBe(0)
  })

  it('handles multi-source KPIs (sums across data sources)', () => {
    const kpis: KpiConfig[] = [
      makeKpiConfig({
        id: 'combined',
        sources: [
          { dataSourceId: 'ds1', metric: 'count' },
          { dataSourceId: 'ds2', metric: 'count' },
        ],
      }),
    ]

    const dataCache = new Map<string, DataSourceQueryResponse>()
    dataCache.set(
      'ds1',
      makeDataSourceResponse([
        { region: 'APAC', count: 10 },
        { region: 'EMEA', count: 20 },
      ]),
    )
    dataCache.set(
      'ds2',
      makeDataSourceResponse([
        { region: 'APAC', count: 5 },
        { region: 'EMEA', count: 15 },
      ]),
    )

    const filters: CrossFilter[] = [
      { sourceChartId: 'chart-a', column: 'region', value: 'APAC' },
    ]

    const result = recomputeKpis(kpis, dataCache, filters)
    expect(result.kpis[0].value).toBe(15) // 10 + 5
  })

  it('returns partialMatches for KPIs whose data source lacks the cross-filter column', () => {
    const kpis: KpiConfig[] = [
      makeKpiConfig({
        id: 'filtered-kpi',
        sources: [{ dataSourceId: 'ds1', metric: 'amount' }],
      }),
      makeKpiConfig({
        id: 'unfiltered-kpi',
        sources: [{ dataSourceId: 'ds2', metric: 'count' }],
      }),
    ]

    const dataCache = new Map<string, DataSourceQueryResponse>()
    // ds1 HAS the region column
    dataCache.set(
      'ds1',
      makeDataSourceResponse([
        { region: 'APAC', amount: 100 },
        { region: 'EMEA', amount: 200 },
      ]),
    )
    // ds2 does NOT have the region column
    dataCache.set(
      'ds2',
      makeDataSourceResponse([
        { desk: 'FX', count: 50 },
        { desk: 'EQ', count: 75 },
      ]),
    )

    const filters: CrossFilter[] = [
      { sourceChartId: 'chart-a', column: 'region', value: 'APAC' },
    ]

    const result = recomputeKpis(kpis, dataCache, filters)

    // filtered-kpi should have no partial match (column exists)
    expect(result.partialMatches.find((p) => p.kpiId === 'filtered-kpi')).toBeUndefined()

    // unfiltered-kpi should be a partial match
    const partial = result.partialMatches.find((p) => p.kpiId === 'unfiltered-kpi')
    expect(partial).toBeDefined()
    expect(partial!.missingColumns).toContain('region')

    // unfiltered-kpi still computes (just not filtered)
    expect(result.kpis.find((k) => k.id === 'unfiltered-kpi')!.value).toBe(125) // 50 + 75
  })

  it('returns empty partialMatches when all data sources have the cross-filter column', () => {
    const kpis: KpiConfig[] = [
      makeKpiConfig({
        id: 'total',
        sources: [{ dataSourceId: 'ds1', metric: 'amount' }],
      }),
    ]

    const dataCache = new Map<string, DataSourceQueryResponse>()
    dataCache.set(
      'ds1',
      makeDataSourceResponse([
        { region: 'APAC', amount: 100 },
      ]),
    )

    const filters: CrossFilter[] = [
      { sourceChartId: 'chart-a', column: 'region', value: 'APAC' },
    ]

    const result = recomputeKpis(kpis, dataCache, filters)
    expect(result.partialMatches).toHaveLength(0)
  })
})
