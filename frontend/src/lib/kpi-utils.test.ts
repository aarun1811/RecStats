import { describe, expect, it } from 'vitest'

import {
  computeAggregation,
  getThresholdLevel,
  getTrendSubtitle,
} from './kpi-utils'

describe('getThresholdLevel', () => {
  it('returns none when thresholds is null', () => {
    expect(getThresholdLevel(100, null)).toBe('none')
  })

  it('returns none when thresholds is undefined', () => {
    expect(getThresholdLevel(100, undefined)).toBe('none')
  })

  it('returns green when value >= greenAbove', () => {
    expect(getThresholdLevel(95, { greenAbove: 90, amberAbove: 70 })).toBe(
      'green',
    )
  })

  it('returns green when value equals greenAbove exactly', () => {
    expect(getThresholdLevel(90, { greenAbove: 90, amberAbove: 70 })).toBe(
      'green',
    )
  })

  it('returns amber when value >= amberAbove but < greenAbove', () => {
    expect(getThresholdLevel(80, { greenAbove: 90, amberAbove: 70 })).toBe(
      'amber',
    )
  })

  it('returns amber when value equals amberAbove exactly', () => {
    expect(getThresholdLevel(70, { greenAbove: 90, amberAbove: 70 })).toBe(
      'amber',
    )
  })

  it('returns red when value < amberAbove', () => {
    expect(getThresholdLevel(50, { greenAbove: 90, amberAbove: 70 })).toBe(
      'red',
    )
  })
})

describe('getTrendSubtitle', () => {
  it('returns empty string when trend is null', () => {
    expect(getTrendSubtitle(null)).toBe('')
  })

  it('returns empty string when trend is undefined', () => {
    expect(getTrendSubtitle(undefined)).toBe('')
  })

  it('returns "vs last week" for previous_period with week', () => {
    expect(
      getTrendSubtitle({ mode: 'previous_period', period: 'week' }),
    ).toBe('vs last week')
  })

  it('returns "vs last month" for previous_period with month', () => {
    expect(
      getTrendSubtitle({ mode: 'previous_period', period: 'month' }),
    ).toBe('vs last month')
  })

  it('returns "vs last day" for previous_period with day', () => {
    expect(getTrendSubtitle({ mode: 'previous_period', period: 'day' })).toBe(
      'vs last day',
    )
  })

  it('returns target label when set', () => {
    expect(
      getTrendSubtitle({
        mode: 'static_target',
        targetValue: 100,
        targetLabel: 'SLA target',
      }),
    ).toBe('SLA target')
  })

  it('returns "target: {value}" when targetLabel is empty', () => {
    expect(
      getTrendSubtitle({
        mode: 'static_target',
        targetValue: 95.5,
        targetLabel: '',
      }),
    ).toBe('target: 95.5')
  })
})

describe('computeAggregation', () => {
  it('returns 0 for empty array', () => {
    expect(computeAggregation([], 'SUM')).toBe(0)
  })

  it('computes SUM correctly', () => {
    expect(computeAggregation([10, 20, 30], 'SUM')).toBe(60)
  })

  it('computes AVG correctly', () => {
    expect(computeAggregation([10, 20, 30], 'AVG')).toBe(20)
  })

  it('computes COUNT correctly', () => {
    expect(computeAggregation([10, 20, 30], 'COUNT')).toBe(3)
  })

  it('computes MIN correctly', () => {
    expect(computeAggregation([10, 5, 30], 'MIN')).toBe(5)
  })

  it('computes MAX correctly', () => {
    expect(computeAggregation([10, 5, 30], 'MAX')).toBe(30)
  })

  it('computes COUNT_DISTINCT correctly', () => {
    expect(computeAggregation([10, 20, 10, 30, 20], 'COUNT_DISTINCT')).toBe(3)
  })

  it('defaults to SUM for unknown aggregation', () => {
    expect(computeAggregation([10, 20, 30], 'UNKNOWN')).toBe(60)
  })
})
