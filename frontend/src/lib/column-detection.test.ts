import { describe, it, expect } from 'vitest'
import { autoDetectColumns, detectColumnType } from './column-detection'

describe('detectColumnType', () => {
  it('detects date type from name pattern _date', () => {
    expect(detectColumnType('created_date', [null])).toBe('date')
  })

  it('detects date type from name pattern _at', () => {
    expect(detectColumnType('updated_at', ['2024-01-01'])).toBe('date')
  })

  it('detects date type from name pattern _dt', () => {
    expect(detectColumnType('trade_dt', [null])).toBe('date')
  })

  it('detects date type from name pattern _ts', () => {
    expect(detectColumnType('insert_ts', [null])).toBe('date')
  })

  it('detects date type from name pattern _time', () => {
    expect(detectColumnType('run_time', [null])).toBe('date')
  })

  it('detects date type from name pattern _on', () => {
    expect(detectColumnType('settled_on', [null])).toBe('date')
  })

  it('detects number type from sample values', () => {
    expect(detectColumnType('amount', [100, 200, 300])).toBe('number')
  })

  it('detects number when majority are numbers', () => {
    expect(detectColumnType('brk_cnt', [1, 2, null, 3, null])).toBe('number')
  })

  it('defaults to string for non-numeric non-date', () => {
    expect(detectColumnType('desk', ['FX', 'EQ', 'FI'])).toBe('string')
  })

  it('defaults to string when all values are null', () => {
    expect(detectColumnType('unknown_col', [null, null, null])).toBe('string')
  })

  it('defaults to string for empty sample values', () => {
    expect(detectColumnType('some_col', [])).toBe('string')
  })
})

describe('autoDetectColumns', () => {
  it('detects brk_cnt as number/measure with display name Brk Cnt', () => {
    const rows = [
      { brk_cnt: 10, desk: 'FX', created_date: '2024-01-01' },
      { brk_cnt: 20, desk: 'EQ', created_date: '2024-01-02' },
    ]
    const columns = autoDetectColumns(['brk_cnt', 'desk', 'created_date'], rows)

    const brkCnt = columns.find((c) => c.name === 'brk_cnt')!
    expect(brkCnt.dataType).toBe('number')
    expect(brkCnt.role).toBe('measure')
    expect(brkCnt.displayName).toBe('Brk Cnt')
  })

  it('detects desk as string/dimension', () => {
    const rows = [{ desk: 'FX' }, { desk: 'EQ' }]
    const columns = autoDetectColumns(['desk'], rows)

    const desk = columns.find((c) => c.name === 'desk')!
    expect(desk.dataType).toBe('string')
    expect(desk.role).toBe('dimension')
  })

  it('detects created_date as date/time', () => {
    const rows = [{ created_date: '2024-01-01' }]
    const columns = autoDetectColumns(['created_date'], rows)

    const col = columns.find((c) => c.name === 'created_date')!
    expect(col.dataType).toBe('date')
    expect(col.role).toBe('time')
  })

  it('detects updated_at as date/time', () => {
    const rows = [{ updated_at: '2024-06-15T10:30:00Z' }]
    const columns = autoDetectColumns(['updated_at'], rows)

    const col = columns.find((c) => c.name === 'updated_at')!
    expect(col.dataType).toBe('date')
    expect(col.role).toBe('time')
  })

  it('generates display name from snake_case', () => {
    const rows = [{ total_amount: 1000 }]
    const columns = autoDetectColumns(['total_amount'], rows)

    expect(columns[0].displayName).toBe('Total Amount')
  })

  it('sets default aggregation, formatPreset, and formatString', () => {
    const columns = autoDetectColumns(['col1'], [{ col1: 'value' }])

    expect(columns[0].aggregation).toBe('NONE')
    expect(columns[0].formatPreset).toBe('none')
    expect(columns[0].formatString).toBe('')
  })

  it('returns string type for all columns when rows is empty', () => {
    const columns = autoDetectColumns(['col_a', 'col_b'], [])

    expect(columns[0].dataType).toBe('string')
    expect(columns[0].role).toBe('dimension')
    expect(columns[1].dataType).toBe('string')
    expect(columns[1].role).toBe('dimension')
  })

  it('handles all null values by returning string type', () => {
    const rows = [{ val: null }, { val: null }, { val: null }]
    const columns = autoDetectColumns(['val'], rows)

    expect(columns[0].dataType).toBe('string')
    expect(columns[0].role).toBe('dimension')
  })
})
