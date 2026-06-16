import { describe, it, expect } from 'vitest'

import { parseHideOpenInLinkFlag } from './embed-config'

describe('parseHideOpenInLinkFlag', () => {
  it('is true when the flag string is exactly "true"', () => {
    expect(parseHideOpenInLinkFlag('true')).toBe(true)
  })

  it('is true regardless of case', () => {
    expect(parseHideOpenInLinkFlag('TRUE')).toBe(true)
  })

  it('is false when the flag is unset (undefined)', () => {
    expect(parseHideOpenInLinkFlag(undefined)).toBe(false)
  })

  it('is false for an empty string', () => {
    expect(parseHideOpenInLinkFlag('')).toBe(false)
  })

  it('is false for the literal "false"', () => {
    expect(parseHideOpenInLinkFlag('false')).toBe(false)
  })

  it('is false for other truthy-looking strings (only "true" counts)', () => {
    expect(parseHideOpenInLinkFlag('1')).toBe(false)
    expect(parseHideOpenInLinkFlag('yes')).toBe(false)
  })
})
