import { describe, expect, it } from 'vitest'

import {
  buildShareUrl,
  parseFilterParams,
  parseHideTokens,
  parseLockedFilters,
  serializeFilterParams,
  stripFilterParams,
} from './dashboard-url-state'

describe('parseFilterParams', () => {
  it('parses a single string filter into a scalar value', () => {
    expect(parseFilterParams({ 'filter.region': 'APAC' })).toEqual({
      region: 'APAC',
    })
  })

  it('parses a comma-separated string filter into an array', () => {
    expect(parseFilterParams({ 'filter.product': 'A,B,C' })).toEqual({
      product: ['A', 'B', 'C'],
    })
  })

  it('skips the reserved filter.lock key (not a filter)', () => {
    expect(parseFilterParams({ 'filter.lock': 'region' })).toEqual({})
  })

  it('ignores non-filter keys (e.g. theme, hide)', () => {
    expect(
      parseFilterParams({ theme: 'dark', hide: 'filter-bar' }),
    ).toEqual({})
  })

  it('handles a mixed search object with filter and non-filter keys', () => {
    expect(
      parseFilterParams({
        'filter.region': 'APAC',
        'filter.product': 'A,B',
        theme: 'dark',
        'filter.lock': 'region',
      }),
    ).toEqual({
      region: 'APAC',
      product: ['A', 'B'],
    })
  })

  it('returns the param unchanged when value is not a string (defensive)', () => {
    // numeric values from validateSearch passthrough are skipped
    expect(parseFilterParams({ 'filter.count': 42 })).toEqual({})
  })

  it('passes through unknown filter IDs (caller filters them later)', () => {
    expect(parseFilterParams({ 'filter.nonexistent': 'x' })).toEqual({
      nonexistent: 'x',
    })
  })
})

describe('parseLockedFilters', () => {
  it('returns an array of locked filter IDs from a comma-separated string', () => {
    expect(parseLockedFilters({ 'filter.lock': 'region,product' })).toEqual([
      'region',
      'product',
    ])
  })

  it('returns an empty array when filter.lock is empty string', () => {
    expect(parseLockedFilters({ 'filter.lock': '' })).toEqual([])
  })

  it('returns an empty array when filter.lock is missing', () => {
    expect(parseLockedFilters({})).toEqual([])
  })

  it('returns a single-element array for a single locked filter', () => {
    expect(parseLockedFilters({ 'filter.lock': 'region' })).toEqual(['region'])
  })
})

describe('parseHideTokens', () => {
  it('returns a Set of hide tokens from comma-separated string', () => {
    expect(parseHideTokens({ hide: 'filter-bar,title' })).toEqual(
      new Set(['filter-bar', 'title']),
    )
  })

  it('returns an empty Set when hide is missing', () => {
    expect(parseHideTokens({})).toEqual(new Set())
  })

  it('returns an empty Set when hide is empty string', () => {
    expect(parseHideTokens({ hide: '' })).toEqual(new Set())
  })

  it('returns a single-element Set for a single hide token', () => {
    expect(parseHideTokens({ hide: 'toolbar' })).toEqual(new Set(['toolbar']))
  })
})

describe('serializeFilterParams', () => {
  it('serializes a scalar string filter to filter.<id>=<value>', () => {
    expect(serializeFilterParams({ region: 'APAC' })).toEqual({
      'filter.region': 'APAC',
    })
  })

  it('serializes an array filter to comma-separated string', () => {
    expect(serializeFilterParams({ product: ['A', 'B'] })).toEqual({
      'filter.product': 'A,B',
    })
  })

  it('omits empty arrays', () => {
    expect(serializeFilterParams({ region: [] })).toEqual({})
  })

  it('serializes numeric values via String()', () => {
    expect(serializeFilterParams({ count: 42 })).toEqual({
      'filter.count': '42',
    })
  })

  it('serializes multiple filters into a single object', () => {
    expect(
      serializeFilterParams({ region: 'APAC', product: ['A', 'B'] }),
    ).toEqual({
      'filter.region': 'APAC',
      'filter.product': 'A,B',
    })
  })
})

describe('round-trip parse/serialize', () => {
  it('round-trips a scalar filter', () => {
    const initial = { region: 'APAC' }
    const round = parseFilterParams(serializeFilterParams(initial))
    expect(round).toEqual(initial)
  })

  it('round-trips an array filter', () => {
    const initial = { product: ['A', 'B', 'C'] }
    const round = parseFilterParams(serializeFilterParams(initial))
    expect(round).toEqual(initial)
  })

  it('round-trips a mixed scalar + array filter set', () => {
    const initial = { region: 'APAC', product: ['A', 'B'] }
    const round = parseFilterParams(serializeFilterParams(initial))
    expect(round).toEqual(initial)
  })
})

describe('stripFilterParams', () => {
  it('removes filter.* keys but preserves other keys', () => {
    expect(
      stripFilterParams({ 'filter.region': 'APAC', theme: 'dark' }),
    ).toEqual({ theme: 'dark' })
  })

  it('preserves the hide and theme keys', () => {
    expect(
      stripFilterParams({
        'filter.region': 'APAC',
        theme: 'dark',
        hide: 'filter-bar',
      }),
    ).toEqual({ theme: 'dark', hide: 'filter-bar' })
  })

  it('returns an empty object when given only filter.* keys', () => {
    expect(stripFilterParams({ 'filter.region': 'APAC' })).toEqual({})
  })

  it('returns the original object when no filter.* keys are present', () => {
    expect(stripFilterParams({ theme: 'dark' })).toEqual({ theme: 'dark' })
  })
})

describe('buildShareUrl', () => {
  it('appends serialized filter params as a query string', () => {
    expect(buildShareUrl('/dashboards/abc', { region: 'APAC' })).toBe(
      '/dashboards/abc?filter.region=APAC',
    )
  })

  it('returns the pathname without ? when there are no filters', () => {
    expect(buildShareUrl('/dashboards/abc', {})).toBe('/dashboards/abc')
  })

  it('encodes multi-select filter values as comma-separated', () => {
    const url = buildShareUrl('/dashboards/abc', { product: ['A', 'B'] })
    // URLSearchParams URL-encodes the comma -> %2C
    expect(url).toBe('/dashboards/abc?filter.product=A%2CB')
  })

  it('omits empty arrays from the URL', () => {
    expect(buildShareUrl('/dashboards/abc', { region: [] })).toBe(
      '/dashboards/abc',
    )
  })
})
