// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  buildCSV,
  buildTSV,
  sanitizeFilename,
  exportFilename,
  triggerDownload,
  copyToClipboard,
  EXPORT_PIXEL_RATIO,
} from './chart-export'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('EXPORT_PIXEL_RATIO', () => {
  it('equals 2 for retina-quality output', () => {
    expect(EXPORT_PIXEL_RATIO).toBe(2)
  })
})

describe('buildCSV', () => {
  it('builds CSV from columns and rows', () => {
    const result = buildCSV(['region', 'count'], [{ region: 'APAC', count: 10 }])
    expect(result).toBe('region,count\nAPAC,10')
  })

  it('handles comma-containing values by quoting', () => {
    const result = buildCSV(['city', 'count'], [{ city: 'New York, NY', count: 5 }])
    expect(result).toBe('city,count\n"New York, NY",5')
  })

  it('handles double-quote-containing values by escaping', () => {
    const result = buildCSV(['name', 'count'], [{ name: 'The "Big" One', count: 1 }])
    expect(result).toBe('name,count\n"The ""Big"" One",1')
  })

  it('handles null/undefined values as empty strings', () => {
    const result = buildCSV(['a', 'b'], [{ a: null, b: undefined }])
    expect(result).toBe('a,b\n,')
  })

  it('handles multiple rows', () => {
    const result = buildCSV(
      ['region', 'count'],
      [
        { region: 'APAC', count: 10 },
        { region: 'EMEA', count: 20 },
      ],
    )
    expect(result).toBe('region,count\nAPAC,10\nEMEA,20')
  })

  it('handles newline-containing values by quoting', () => {
    const result = buildCSV(['note'], [{ note: 'line1\nline2' }])
    expect(result).toBe('note\n"line1\nline2"')
  })
})

describe('buildTSV', () => {
  it('builds TSV from columns and rows', () => {
    const result = buildTSV(['region', 'count'], [{ region: 'APAC', count: 10 }])
    expect(result).toBe('region\tcount\nAPAC\t10')
  })

  it('handles null/undefined as empty strings', () => {
    const result = buildTSV(['a', 'b'], [{ a: null, b: undefined }])
    expect(result).toBe('a\tb\n\t')
  })
})

describe('sanitizeFilename', () => {
  it('converts to lowercase and replaces spaces with hyphens', () => {
    expect(sanitizeFilename('TLM Breaks by Region')).toBe('tlm-breaks-by-region')
  })

  it('strips special characters: <>\\/:\"*?|', () => {
    expect(sanitizeFilename('file<>name/with:bad*chars?|')).toBe('filenamewithbadchars')
  })

  it('collapses multiple hyphens', () => {
    expect(sanitizeFilename('too   many   spaces')).toBe('too-many-spaces')
  })

  it('trims leading and trailing hyphens', () => {
    expect(sanitizeFilename(' -hello- ')).toBe('hello')
  })
})

describe('exportFilename', () => {
  it('generates a timestamped filename', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-05T12:00:00Z'))
    const result = exportFilename('TLM Breaks', 'csv')
    expect(result).toBe('tlm-breaks-2026-04-05.csv')
    vi.useRealTimers()
  })

  it('works with png extension', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-05T12:00:00Z'))
    const result = exportFilename('My Chart', 'png')
    expect(result).toBe('my-chart-2026-04-05.png')
    vi.useRealTimers()
  })
})

describe('triggerDownload', () => {
  it('creates an anchor element, sets href+download, clicks, and revokes URL', () => {
    const mockClick = vi.fn()
    const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLAnchorElement)
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url')
    const mockRevokeObjectURL = vi.fn()
    globalThis.URL.createObjectURL = mockCreateObjectURL
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL

    const blob = new Blob(['test'], { type: 'text/plain' })
    triggerDownload(blob, 'test.txt')

    expect(mockCreateObjectURL).toHaveBeenCalledWith(blob)
    expect(mockClick).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url')

    mockCreateElement.mockRestore()
  })
})

describe('copyToClipboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('copies TSV to clipboard and shows success toast', async () => {
    const { toast } = await import('sonner')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    await copyToClipboard(['a', 'b'], [{ a: 1, b: 2 }])

    expect(writeText).toHaveBeenCalledWith('a\tb\n1\t2')
    expect(toast.success).toHaveBeenCalledWith('Data copied to clipboard')
  })

  it('shows error toast when clipboard fails', async () => {
    const { toast } = await import('sonner')
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText } })

    await copyToClipboard(['a'], [{ a: 1 }])

    expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard')
  })
})
