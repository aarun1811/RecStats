export type FormatType = 'number' | 'currency' | 'percentage' | 'decimal'

export interface FormatNumberOptions {
  type: FormatType
  decimals?: number
  abbreviate?: boolean
  currencyCode?: string // ISO 4217 code from companion column per D-16
}
