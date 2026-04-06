import { describe, it, expect } from 'vitest'
import {
  getDatasetShape,
  isChartTypeCompatible,
  CHART_REQUIREMENTS,
} from './chart-compatibility'

describe('getDatasetShape', () => {
  it('counts dimensions and measures', () => {
    const cols = [
      { role: 'dimension' },
      { role: 'time' },
      { role: 'measure' },
      { role: 'measure' },
      { role: 'none' },
    ]
    const shape = getDatasetShape(cols)
    expect(shape.dimensions).toBe(2)
    expect(shape.measures).toBe(2)
  })

  it('returns zeros for empty columns', () => {
    const shape = getDatasetShape([])
    expect(shape.dimensions).toBe(0)
    expect(shape.measures).toBe(0)
  })

  it('treats time columns as dimensions', () => {
    const cols = [{ role: 'time' }, { role: 'measure' }]
    const shape = getDatasetShape(cols)
    expect(shape.dimensions).toBe(1)
    expect(shape.measures).toBe(1)
  })

  it('ignores none role columns', () => {
    const cols = [{ role: 'none' }, { role: 'none' }]
    const shape = getDatasetShape(cols)
    expect(shape.dimensions).toBe(0)
    expect(shape.measures).toBe(0)
  })
})

describe('isChartTypeCompatible', () => {
  it('returns compatible for bar with 1 dim + 1 meas', () => {
    const result = isChartTypeCompatible('bar', { dimensions: 1, measures: 1 })
    expect(result.compatible).toBe(true)
    expect(result.tooltip).toBe('')
  })

  it('returns incompatible for pie with 2 measures', () => {
    const result = isChartTypeCompatible('pie', { dimensions: 1, measures: 2 })
    expect(result.compatible).toBe(false)
    expect(result.tooltip).toContain('exactly 1 measure')
  })

  it('returns incompatible for scatter with 1 measure', () => {
    const result = isChartTypeCompatible('scatter', { dimensions: 0, measures: 1 })
    expect(result.compatible).toBe(false)
    expect(result.tooltip).toContain('2 measure')
  })

  it('returns compatible for scatter with 2 measures', () => {
    const result = isChartTypeCompatible('scatter', { dimensions: 0, measures: 2 })
    expect(result.compatible).toBe(true)
  })

  it('returns incompatible for heatmap with 1 dimension', () => {
    const result = isChartTypeCompatible('heatmap', { dimensions: 1, measures: 1 })
    expect(result.compatible).toBe(false)
  })

  it('returns compatible for heatmap with 2 dims + 1 meas', () => {
    const result = isChartTypeCompatible('heatmap', { dimensions: 2, measures: 1 })
    expect(result.compatible).toBe(true)
  })

  it('returns incompatible for unknown chart type', () => {
    const result = isChartTypeCompatible('unknown-type', { dimensions: 5, measures: 5 })
    expect(result.compatible).toBe(false)
    expect(result.tooltip).toBe('Unknown chart type')
  })

  it('returns compatible for gauge with 0 dims + 1 meas', () => {
    const result = isChartTypeCompatible('gauge', { dimensions: 0, measures: 1 })
    expect(result.compatible).toBe(true)
  })

  it('returns incompatible for gauge with 2 measures', () => {
    const result = isChartTypeCompatible('gauge', { dimensions: 0, measures: 2 })
    expect(result.compatible).toBe(false)
  })

  it('returns compatible for combo with 1 dim + 2 meas', () => {
    const result = isChartTypeCompatible('combo', { dimensions: 1, measures: 2 })
    expect(result.compatible).toBe(true)
  })

  it('returns incompatible for combo with only 1 measure', () => {
    const result = isChartTypeCompatible('combo', { dimensions: 1, measures: 1 })
    expect(result.compatible).toBe(false)
  })

  it('returns compatible for sankey with 2 dims + 1 meas', () => {
    const result = isChartTypeCompatible('sankey', { dimensions: 2, measures: 1 })
    expect(result.compatible).toBe(true)
  })

  it('returns incompatible for sankey with 3 dims', () => {
    const result = isChartTypeCompatible('sankey', { dimensions: 3, measures: 1 })
    expect(result.compatible).toBe(false)
  })
})

describe('CHART_REQUIREMENTS covers all 20 types', () => {
  const expectedTypes = [
    'bar', 'stacked-bar', 'line', 'area',
    'pie', 'donut', 'scatter',
    'heatmap', 'treemap', 'waterfall',
    'bullet', 'box-plot', 'combo',
    'sankey', 'sunburst', 'radar',
    'gauge', 'funnel', 'graph', 'parallel',
  ]

  for (const type of expectedTypes) {
    it(`has requirements for ${type}`, () => {
      expect(CHART_REQUIREMENTS[type]).toBeDefined()
      expect(CHART_REQUIREMENTS[type].tooltip).toBeTruthy()
    })
  }

  it('has exactly 20 chart types', () => {
    expect(Object.keys(CHART_REQUIREMENTS)).toHaveLength(20)
  })
})
