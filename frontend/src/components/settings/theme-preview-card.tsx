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

// ── Light mockup (hardcoded light colors — never changes with theme) ──

function LightMockup() {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-t-md bg-[#f8f9fa]">
      {/* Sidebar */}
      <div className="absolute left-0 top-0 bottom-0 w-[14px] bg-[#eceef1] border-r border-[#dde0e4]" />
      {/* Header */}
      <div className="absolute left-[14px] top-0 right-0 h-[10px] bg-white border-b border-[#eceef1]" />
      {/* Content lines */}
      <div className="absolute left-[22px] top-[16px] right-[12px] h-[6px] rounded-[2px] bg-[#dde0e4]" />
      <div className="absolute left-[22px] top-[28px] w-[55%] h-[6px] rounded-[2px] bg-[#e4e6ea]" />
      <div className="absolute left-[22px] top-[40px] w-[40%] h-[6px] rounded-[2px] bg-[#eceef1]" />
    </div>
  )
}

// ── Dark mockup (hardcoded dark colors — never changes with theme) ──

function DarkMockup() {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-t-md bg-[#0c0e12]">
      {/* Sidebar */}
      <div className="absolute left-0 top-0 bottom-0 w-[14px] bg-[#1a1d24] border-r border-[#262a33]" />
      {/* Header */}
      <div className="absolute left-[14px] top-0 right-0 h-[10px] bg-[#12141a] border-b border-[#1a1d24]" />
      {/* Content lines */}
      <div className="absolute left-[22px] top-[16px] right-[12px] h-[6px] rounded-[2px] bg-[#262a33]" />
      <div className="absolute left-[22px] top-[28px] w-[55%] h-[6px] rounded-[2px] bg-[#1e2128]" />
      <div className="absolute left-[22px] top-[40px] w-[40%] h-[6px] rounded-[2px] bg-[#1a1d24]" />
    </div>
  )
}

// ── System mockup (vertical split — left light, right dark) ──

function SystemMockup() {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-t-md">
      {/* Left half: light */}
      <div className="absolute inset-0 w-1/2 bg-[#f8f9fa]">
        <div className="absolute left-0 top-0 bottom-0 w-[14px] bg-[#eceef1] border-r border-[#dde0e4]" />
        <div className="absolute left-[14px] top-0 right-0 h-[10px] bg-white border-b border-[#eceef1]" />
        <div className="absolute left-[22px] top-[16px] right-[4px] h-[6px] rounded-[2px] bg-[#dde0e4]" />
        <div className="absolute left-[22px] top-[28px] w-[60%] h-[6px] rounded-[2px] bg-[#e4e6ea]" />
      </div>
      {/* Right half: dark */}
      <div className="absolute top-0 bottom-0 right-0 w-1/2 bg-[#0c0e12]">
        <div className="absolute left-0 top-0 right-0 h-[10px] bg-[#12141a] border-b border-[#1a1d24]" />
        <div className="absolute left-[8px] top-[16px] right-[12px] h-[6px] rounded-[2px] bg-[#262a33]" />
        <div className="absolute left-[8px] top-[28px] w-[60%] h-[6px] rounded-[2px] bg-[#1e2128]" />
      </div>
      {/* Divider line */}
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
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
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'relative flex flex-col rounded-xl cursor-pointer w-[160px] h-[120px] overflow-hidden transition-shadow',
        isSelected
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md'
          : 'ring-1 ring-border hover:ring-muted-foreground/30 hover:shadow-sm',
      )}
    >
      {/* Mockup area */}
      <div className="relative flex-1 min-h-0">
        <Mockup />
        {/* Icon badge — top-right */}
        <div className={cn(
          'absolute top-1.5 right-1.5 rounded-full p-1 shadow-sm',
          theme === 'dark'
            ? 'bg-zinc-800/90 text-zinc-400'
            : 'bg-white/90 text-muted-foreground',
        )}>
          <Icon className="size-3" />
        </div>
      </div>

      {/* Label */}
      <div className={cn(
        'flex items-center justify-center py-2 text-sm font-medium border-t',
        isSelected ? 'text-primary bg-primary/5 border-primary/20' : 'text-muted-foreground border-border',
      )}>
        {label}
      </div>
    </motion.button>
  )
}
