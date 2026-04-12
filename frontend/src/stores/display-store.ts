import { create } from 'zustand'

type Density = 'comfortable' | 'compact'
type FontSize = 'small' | 'medium' | 'large'

interface DisplayStore {
  density: Density
  fontSize: FontSize
  setDensity: (d: Density) => void
  setFontSize: (s: FontSize) => void
}

const STORAGE_KEY = 'recviz-display'

const VALID_DENSITIES: ReadonlySet<string> = new Set(['comfortable', 'compact'])
const VALID_FONT_SIZES: ReadonlySet<string> = new Set(['small', 'medium', 'large'])

const DENSITY_VARS: Record<Density, { spacingScale: string; rowHeight: string; cellPadding: string }> = {
  comfortable: { spacingScale: '1', rowHeight: '36px', cellPadding: '12px' },
  compact: { spacingScale: '0.85', rowHeight: '28px', cellPadding: '8px' },
}

const FONT_SIZE_VARS: Record<FontSize, { fontScale: string; baseFontSize: string }> = {
  small: { fontScale: '0.875', baseFontSize: '12.25px' },
  medium: { fontScale: '1', baseFontSize: '14px' },
  large: { fontScale: '1.125', baseFontSize: '15.75px' },
}

function writeCssVars(density: Density, fontSize: FontSize): void {
  const root = document.documentElement.style
  const dv = DENSITY_VARS[density]
  const fv = FONT_SIZE_VARS[fontSize]

  root.setProperty('--spacing-scale', dv.spacingScale)
  root.setProperty('--row-height', dv.rowHeight)
  root.setProperty('--cell-padding', dv.cellPadding)
  root.setProperty('--font-scale', fv.fontScale)
  root.setProperty('--base-font-size', fv.baseFontSize)
}

function persistToStorage(density: Density, fontSize: FontSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ density, fontSize }))
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded)
  }
}

function readFromStorage(): { density: Density; fontSize: FontSize } {
  const defaults = { density: 'comfortable' as Density, fontSize: 'medium' as FontSize }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return defaults

    const obj = parsed as Record<string, unknown>
    const density = typeof obj.density === 'string' && VALID_DENSITIES.has(obj.density)
      ? (obj.density as Density)
      : defaults.density
    const fontSize = typeof obj.fontSize === 'string' && VALID_FONT_SIZES.has(obj.fontSize)
      ? (obj.fontSize as FontSize)
      : defaults.fontSize

    return { density, fontSize }
  } catch {
    return defaults
  }
}

// Read persisted values and write CSS vars at store creation time
const initialState = readFromStorage()
writeCssVars(initialState.density, initialState.fontSize)

export const useDisplayStore = create<DisplayStore>((set) => ({
  density: initialState.density,
  fontSize: initialState.fontSize,

  setDensity: (d) => {
    set((s) => {
      writeCssVars(d, s.fontSize)
      persistToStorage(d, s.fontSize)
      return { density: d }
    })
  },

  setFontSize: (s) => {
    set((prev) => {
      writeCssVars(prev.density, s)
      persistToStorage(prev.density, s)
      return { fontSize: s }
    })
  },
}))
