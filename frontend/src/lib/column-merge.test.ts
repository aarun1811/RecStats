import { describe, it, expect } from 'vitest'
import { mergeColumns } from './column-merge'
import type { DatasetColumnMeta } from '@/types/managed-dataset'

function makeMeta(overrides: Partial<DatasetColumnMeta> & { name: string }): DatasetColumnMeta {
  return {
    displayName: overrides.name,
    dataType: 'string',
    role: 'dimension',
    aggregation: 'NONE',
    formatPreset: 'none',
    formatString: '',
    ...overrides,
  }
}

describe('mergeColumns', () => {
  it('preserves existing metadata for unchanged columns', () => {
    const existing = [
      makeMeta({
        name: 'amount',
        displayName: 'Total Amount',
        dataType: 'number',
        role: 'measure',
        aggregation: 'SUM',
        formatPreset: 'currency',
        formatString: '$#,##0.00',
      }),
    ]
    const detected = [
      makeMeta({ name: 'amount', displayName: 'Amount', dataType: 'number', role: 'measure' }),
    ]

    const merged = mergeColumns(existing, detected)

    const amount = merged.find((c) => c.name === 'amount')!
    expect(amount.status).toBe('unchanged')
    expect(amount.displayName).toBe('Total Amount')
    expect(amount.aggregation).toBe('SUM')
    expect(amount.formatPreset).toBe('currency')
    expect(amount.formatString).toBe('$#,##0.00')
  })

  it('marks new columns with status new', () => {
    const existing = [makeMeta({ name: 'amount' })]
    const detected = [
      makeMeta({ name: 'amount' }),
      makeMeta({ name: 'desk', displayName: 'Desk' }),
    ]

    const merged = mergeColumns(existing, detected)

    const desk = merged.find((c) => c.name === 'desk')!
    expect(desk.status).toBe('new')
    expect(desk.displayName).toBe('Desk')
  })

  it('marks removed columns with status missing', () => {
    const existing = [
      makeMeta({ name: 'amount' }),
      makeMeta({ name: 'old_col', displayName: 'Old Column' }),
    ]
    const detected = [makeMeta({ name: 'amount' })]

    const merged = mergeColumns(existing, detected)

    const oldCol = merged.find((c) => c.name === 'old_col')!
    expect(oldCol.status).toBe('missing')
    expect(oldCol.displayName).toBe('Old Column')
  })

  it('returns all unchanged when no changes', () => {
    const existing = [makeMeta({ name: 'a' }), makeMeta({ name: 'b' })]
    const detected = [makeMeta({ name: 'a' }), makeMeta({ name: 'b' })]

    const merged = mergeColumns(existing, detected)

    expect(merged).toHaveLength(2)
    expect(merged.every((c) => c.status === 'unchanged')).toBe(true)
  })

  it('treats all as new when existing is empty', () => {
    const detected = [makeMeta({ name: 'x' }), makeMeta({ name: 'y' })]

    const merged = mergeColumns([], detected)

    expect(merged).toHaveLength(2)
    expect(merged.every((c) => c.status === 'new')).toBe(true)
  })

  it('treats all as missing when detected is empty', () => {
    const existing = [makeMeta({ name: 'a' }), makeMeta({ name: 'b' })]

    const merged = mergeColumns(existing, [])

    expect(merged).toHaveLength(2)
    expect(merged.every((c) => c.status === 'missing')).toBe(true)
  })

  it('handles mix of unchanged, new, and missing', () => {
    const existing = [
      makeMeta({ name: 'keep', displayName: 'Keep Me' }),
      makeMeta({ name: 'remove', displayName: 'Remove Me' }),
    ]
    const detected = [
      makeMeta({ name: 'keep' }),
      makeMeta({ name: 'added', displayName: 'Added' }),
    ]

    const merged = mergeColumns(existing, detected)

    expect(merged).toHaveLength(3)
    expect(merged.find((c) => c.name === 'keep')!.status).toBe('unchanged')
    expect(merged.find((c) => c.name === 'keep')!.displayName).toBe('Keep Me')
    expect(merged.find((c) => c.name === 'added')!.status).toBe('new')
    expect(merged.find((c) => c.name === 'remove')!.status).toBe('missing')
  })
})
