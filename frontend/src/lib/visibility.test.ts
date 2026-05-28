import { describe, expect, it } from 'vitest'
import { isVisible } from './visibility'
import type { KpiResult, VisibleWhen } from '@/types/dashboard-config'

describe('isVisible', () => {
  const kpis: KpiResult[] = [
    { id: 'k1', value: 10 },
    { id: 'k2', value: 0 },
  ]

  it('returns true when visibleWhen is undefined', () => {
    expect(isVisible(undefined, kpis)).toBe(true)
  })

  it('returns true when kpiResults is undefined (results not loaded yet)', () => {
    expect(isVisible({ kpi: 'k1', condition: 'gt', value: 0 }, undefined)).toBe(true)
  })

  it('returns true when the referenced KPI id is missing (config drift fail-open)', () => {
    expect(isVisible({ kpi: 'nope', condition: 'gt', value: 0 }, kpis)).toBe(true)
  })

  it.each([
    [{ kpi: 'k1', condition: 'gt', value: 5 } as VisibleWhen, true],
    [{ kpi: 'k1', condition: 'gt', value: 100 } as VisibleWhen, false],
    [{ kpi: 'k1', condition: 'lt', value: 100 } as VisibleWhen, true],
    [{ kpi: 'k1', condition: 'lt', value: 5 } as VisibleWhen, false],
    [{ kpi: 'k1', condition: 'eq', value: 10 } as VisibleWhen, true],
    [{ kpi: 'k2', condition: 'eq', value: 0 } as VisibleWhen, true],
  ])('evaluates %j as %p', (rule, expected) => {
    expect(isVisible(rule, kpis)).toBe(expected)
  })
})
