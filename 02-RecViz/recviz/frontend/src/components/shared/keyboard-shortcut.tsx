import { cn } from '@/lib/utils'

interface KeyboardShortcutProps {
  keys: string[]
  className?: string
}

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.platform.toUpperCase().includes('MAC')
}

const modifierMap: Record<string, string> = {
  mod: isMac() ? '⌘' : 'Ctrl',
  ctrl: isMac() ? '⌃' : 'Ctrl',
  alt: isMac() ? '⌥' : 'Alt',
  shift: '⇧',
  meta: '⌘',
}

function mapKey(key: string): string {
  const lower = key.toLowerCase()
  return modifierMap[lower] ?? key
}

export function KeyboardShortcut({ keys, className }: KeyboardShortcutProps) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {keys.map((key, index) => (
        <kbd
          key={index}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground"
        >
          {mapKey(key)}
        </kbd>
      ))}
    </span>
  )
}
