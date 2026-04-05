import { describe, it, expect } from 'vitest'

import { buildSeries } from './ag-chart-wrapper'

describe('buildSeries', () => {
  describe('config-driven column mapping', () => {
    it('bar uses metricColumns for yKey, not column order', () => {
      const result = buildSeries('bar', ['dept', 'rev', 'hc'], ['rev'], undefined)
      expect(result).not.toBeNull()
      expect(result![0]).toMatchObject({ type: 'bar', xKey: 'dept', yKey: 'rev' })
    })

    it('bar with explicit categoryColumn uses it instead of first column', () => {
      const result = buildSeries('bar', ['rev', 'dept', 'hc'], ['rev'], 'dept')
      expect(result).not.toBeNull()
      expect(result![0]).toMatchObject({ xKey: 'dept', yKey: 'rev' })
    })

    it('line creates series per metric column', () => {
      const result = buildSeries('line', ['month', 'processed', 'exceptions'], ['processed', 'exceptions'], undefined)
      expect(result).not.toBeNull()
      expect(result).toHaveLength(2)
      expect(result![0]).toMatchObject({ type: 'line', xKey: 'month', yKey: 'processed' })
      expect(result![1]).toMatchObject({ type: 'line', xKey: 'month', yKey: 'exceptions' })
    })

    it('area creates series per metric column', () => {
      const result = buildSeries('area', ['month', 'val1', 'val2'], ['val1', 'val2'], undefined)
      expect(result).not.toBeNull()
      expect(result).toHaveLength(2)
      expect(result![0]).toMatchObject({ type: 'area', xKey: 'month', yKey: 'val1' })
      expect(result![1]).toMatchObject({ type: 'area', xKey: 'month', yKey: 'val2' })
    })

    it('pie uses metricColumns[0] for angleKey and resolved category for calloutLabelKey', () => {
      const result = buildSeries('pie', ['status', 'count'], ['count'], undefined)
      expect(result).not.toBeNull()
      expect(result![0]).toMatchObject({
        type: 'pie',
        angleKey: 'count',
        calloutLabelKey: 'status',
      })
    })

    it('donut uses metricColumns[0] for angleKey with innerRadiusRatio', () => {
      const result = buildSeries('donut', ['cat', 'val'], ['val'], undefined)
      expect(result).not.toBeNull()
      expect(result![0]).toMatchObject({
        type: 'donut',
        angleKey: 'val',
        calloutLabelKey: 'cat',
        innerRadiusRatio: 0.6,
      })
    })

    it('scatter uses metricColumns for xKey, yKey, sizeKey', () => {
      const result = buildSeries('scatter', ['x', 'y', 'size'], ['x', 'y', 'size'], undefined)
      expect(result).not.toBeNull()
      expect(result![0]).toMatchObject({
        type: 'scatter',
        xKey: 'x',
        yKey: 'y',
        sizeKey: 'size',
      })
    })
  })

  describe('new chart types', () => {
    it('heatmap returns type heatmap with xKey, yKey, colorKey', () => {
      const result = buildSeries('heatmap', ['day', 'hour', 'count'], ['count'], undefined)
      expect(result).not.toBeNull()
      expect(result![0]).toMatchObject({
        type: 'heatmap',
        xKey: 'day',
        yKey: 'hour',
        colorKey: 'count',
      })
    })

    it('treemap returns type treemap with labelKey, sizeKey', () => {
      const result = buildSeries('treemap', ['name', 'volume', 'change'], ['volume', 'change'], undefined)
      expect(result).not.toBeNull()
      expect(result![0]).toMatchObject({
        type: 'treemap',
        labelKey: 'name',
        sizeKey: 'volume',
      })
    })

    it('waterfall returns type waterfall, NOT bar', () => {
      const result = buildSeries('waterfall', ['item', 'amount'], ['amount'], undefined)
      expect(result).not.toBeNull()
      expect(result![0]).toMatchObject({ type: 'waterfall' })
      expect(result![0]).not.toMatchObject({ type: 'bar' })
    })
  })

  describe('stacked and combo', () => {
    it('stacked-bar returns series with stacked=true', () => {
      const result = buildSeries('stacked-bar', ['dept', 'rev', 'hc'], ['rev', 'hc'], undefined)
      expect(result).not.toBeNull()
      expect(result).toHaveLength(2)
      expect(result![0]).toMatchObject({ type: 'bar', stacked: true })
      expect(result![1]).toMatchObject({ type: 'bar', stacked: true })
    })

    it('combo returns array with both bar and line series', () => {
      const result = buildSeries('combo', ['dept', 'rev', 'hc'], ['rev', 'hc'], undefined)
      expect(result).not.toBeNull()
      expect(result).toHaveLength(2)
      expect(result![0]).toMatchObject({ type: 'bar', yKey: 'rev' })
      expect(result![1]).toMatchObject({ type: 'line', yKey: 'hc' })
    })
  })

  describe('unsupported types', () => {
    it('returns null for unknown vizType', () => {
      const result = buildSeries('bullet', ['a', 'b'], ['b'], undefined)
      expect(result).toBeNull()
    })

    it('returns null for another unknown vizType', () => {
      const result = buildSeries('box-plot', ['a', 'b', 'c'], ['b', 'c'], undefined)
      expect(result).toBeNull()
    })
  })
})
