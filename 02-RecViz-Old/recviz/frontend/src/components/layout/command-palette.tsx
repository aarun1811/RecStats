import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Database,
  FileText,
  LayoutDashboard,
  Moon,
  Settings,
  Sun,
} from 'lucide-react'

import { useThemeStore } from '@/stores/theme-store'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const setTheme = useThemeStore((s) => s.setTheme)

  const runCommand = useCallback(
    (command: () => void) => {
      onOpenChange(false)
      command()
    },
    [onOpenChange],
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() =>
              runCommand(() => navigate({ to: '/dashboard' }))
            }
          >
            <LayoutDashboard className="mr-2 size-4" />
            <span>Dashboards</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => navigate({ to: '/explorer' }))
            }
          >
            <Database className="mr-2 size-4" />
            <span>Data Explorer</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => navigate({ to: '/reports' }))
            }
          >
            <FileText className="mr-2 size-4" />
            <span>Reports</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => navigate({ to: '/settings' }))
            }
          >
            <Settings className="mr-2 size-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
            <Sun className="mr-2 size-4" />
            <span>Light Mode</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
            <Moon className="mr-2 size-4" />
            <span>Dark Mode</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return { open, setOpen }
}
