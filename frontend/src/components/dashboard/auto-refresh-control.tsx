import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const PRESETS = [
  { label: 'Off', value: 0 },
  { label: '1m', value: 60_000 },
  { label: '5m', value: 300_000 },
  { label: '10m', value: 600_000 },
  { label: '30m', value: 1_800_000 },
] as const

interface AutoRefreshControlProps {
  intervalMs: number
  onIntervalChange: (intervalMs: number) => void
  remainingMs: number
  isActive: boolean
}

function formatCountdown(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function AutoRefreshControl({
  intervalMs,
  onIntervalChange,
  remainingMs,
  isActive,
}: AutoRefreshControlProps) {
  const currentLabel =
    PRESETS.find((p) => p.value === intervalMs)?.label ?? 'Off'

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={
              isActive
                ? `Auto-refresh: ${currentLabel}, next refresh in ${formatCountdown(remainingMs)}`
                : 'Auto-refresh: Off'
            }
          >
            {isActive && (
              <span className="size-1.5 rounded-full bg-green-500 dark:bg-green-400 animate-pulse" />
            )}
            <span className="text-xs font-medium">{currentLabel}</span>
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {PRESETS.map((preset) => (
            <DropdownMenuCheckboxItem
              key={preset.value}
              checked={preset.value === intervalMs}
              onCheckedChange={() => onIntervalChange(preset.value)}
            >
              {preset.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {isActive && (
        <span
          className="text-xs text-muted-foreground tabular-nums"
          aria-live="off"
        >
          {formatCountdown(remainingMs)}
        </span>
      )}
    </div>
  )
}
