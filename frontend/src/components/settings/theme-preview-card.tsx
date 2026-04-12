import { motion } from 'motion/react'
import { Sun, Moon, Monitor } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ThemePreviewCardProps {
  theme: 'light' | 'dark' | 'system'
  isSelected: boolean
  onClick: () => void
}

const THEME_CONFIG = {
  light: { label: 'Light', Icon: Sun },
  dark: { label: 'Dark', Icon: Moon },
  system: { label: 'System', Icon: Monitor },
} as const

// ── Light mockup ──────────────────────────────────────────────

function LightMockup() {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-t-md">
      {/* Content area */}
      <div className="absolute inset-0 bg-background" />
      {/* Sidebar strip */}
      <div className="absolute left-0 top-0 bottom-0 w-3 bg-muted" />
      {/* Header strip */}
      <div className="absolute left-3 top-0 right-0 h-2 bg-card border-b border-border" />
      {/* Placeholder rectangles */}
      <div className="absolute left-5 top-4 right-3 h-3 rounded-sm bg-muted" />
      <div className="absolute left-5 top-9 w-2/3 h-3 rounded-sm bg-muted" />
    </div>
  )
}

// ── Dark mockup ───────────────────────────────────────────────

function DarkMockup() {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-t-md">
      {/* Content area */}
      <div className="absolute inset-0 bg-zinc-950" />
      {/* Sidebar strip */}
      <div className="absolute left-0 top-0 bottom-0 w-3 bg-zinc-800" />
      {/* Header strip */}
      <div className="absolute left-3 top-0 right-0 h-2 bg-zinc-900" />
      {/* Placeholder rectangles */}
      <div className="absolute left-5 top-4 right-3 h-3 rounded-sm bg-zinc-800" />
      <div className="absolute left-5 top-9 w-2/3 h-3 rounded-sm bg-zinc-800" />
    </div>
  )
}

// ── System mockup (diagonal split) ───────────────────────────

function SystemMockup() {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-t-md">
      {/* Dark half (base layer) */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute left-0 top-0 bottom-0 w-3 bg-zinc-800" />
      <div className="absolute left-3 top-0 right-0 h-2 bg-zinc-900" />
      <div className="absolute left-5 top-4 right-3 h-3 rounded-sm bg-zinc-800" />
      <div className="absolute left-5 top-9 w-2/3 h-3 rounded-sm bg-zinc-800" />

      {/* Light half (clipped overlay) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
      >
        <div className="absolute inset-0 bg-background" />
        <div className="absolute left-0 top-0 bottom-0 w-3 bg-muted" />
        <div className="absolute left-3 top-0 right-0 h-2 bg-card border-b border-border" />
        <div className="absolute left-5 top-4 right-3 h-3 rounded-sm bg-muted" />
        <div className="absolute left-5 top-9 w-2/3 h-3 rounded-sm bg-muted" />
      </div>
    </div>
  )
}

const MOCKUP_MAP = {
  light: LightMockup,
  dark: DarkMockup,
  system: SystemMockup,
} as const

// ── ThemePreviewCard ─────────────────────────────────────────

export function ThemePreviewCard({ theme, isSelected, onClick }: ThemePreviewCardProps) {
  const { label, Icon } = THEME_CONFIG[theme]
  const Mockup = MOCKUP_MAP[theme]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col rounded-lg border-2 cursor-pointer w-[160px] h-[120px] overflow-hidden transition-colors',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-muted hover:border-muted-foreground/30',
      )}
    >
      {/* Selection indicator with layoutId spring animation */}
      {isSelected && (
        <motion.div
          layoutId="theme-card-border"
          className="absolute inset-0 rounded-lg border-2 border-primary pointer-events-none z-10"
          transition={{
            duration: 0.3,
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
        />
      )}

      {/* Mockup area (top ~80%) */}
      <div className="relative flex-1 min-h-0">
        <Mockup />
        {/* Icon badge overlay — top-right */}
        <div className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 z-10">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </div>

      {/* Label (bottom ~20%) */}
      <div className="flex items-center justify-center py-1.5">
        <span
          className={cn(
            'text-sm font-medium',
            isSelected ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
      </div>
    </button>
  )
}
