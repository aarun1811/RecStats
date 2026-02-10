import { useCallback, useMemo } from 'react'
import { useMatches } from '@tanstack/react-router'
import { Moon, PanelLeft, Search, Sun } from 'lucide-react'

import { useThemeStore } from '@/stores/theme-store'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useSidebar } from '@/components/ui/sidebar'

interface TopbarProps {
  onOpenCommandPalette: () => void
}

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboards',
  '/explorer': 'Data Explorer',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

export function Topbar({ onOpenCommandPalette }: TopbarProps) {
  const matches = useMatches()
  const { toggleSidebar } = useSidebar()
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const resolvedDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  const breadcrumbs = useMemo(() => {
    const crumbs: Array<{ label: string; path: string }> = []

    for (const match of matches) {
      if (match.id === '__root__') continue
      const path = match.fullPath
      if (path === '/') continue
      const label = routeLabels[path] ?? path.split('/').pop() ?? path
      crumbs.push({ label, path })
    }

    return crumbs
  }, [matches])

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/40 backdrop-blur-md transition-[width,height] ease-linear md:rounded-tl-xl">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2">
        <Button onClick={toggleSidebar} size="icon" variant="ghost">
          <PanelLeft />
        </Button>
        <Separator orientation="vertical" className="mx-2 h-4" />

        <Breadcrumb className="flex-1">
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
              return isLast ? (
                <BreadcrumbItem key={crumb.path}>
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                </BreadcrumbItem>
              ) : (
                <BreadcrumbItem key={crumb.path}>
                  <BreadcrumbLink href={crumb.path}>
                    {crumb.label}
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </BreadcrumbItem>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-muted-foreground"
            onClick={onOpenCommandPalette}
          >
            <Search className="size-3.5" />
            <span className="hidden text-xs lg:inline-flex">Search...</span>
            <kbd className="pointer-events-none hidden select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground lg:inline-flex">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleTheme}
          >
            {resolvedDark ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
