import React from 'react'
import { useLocation } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { BellIcon, PanelLeftIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { CommandPalette } from './command-palette'
import { ThemeSwitch } from './theme-switch'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function useBreadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const queryClient = useQueryClient()

  return segments
    .filter((seg) => !UUID_RE.test(seg))
    .map((seg) => {
      // Look up dashboard name from TanStack Query cache
      if (seg.startsWith('dash-')) {
        const cached = queryClient.getQueryData<{ name?: string }>(['managed-dashboard', seg])
        if (cached?.name) return { label: cached.name }
      }
      return {
        label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
      }
    })
}

export function Header() {
  const breadcrumbs = useBreadcrumbs()
  const { toggleSidebar } = useSidebar()

  return (
    <header className="bg-background/40 sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b backdrop-blur-md transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) md:rounded-tl-xl md:rounded-tr-xl">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2">
        <Button onClick={toggleSidebar} size="icon" variant="ghost">
          <PanelLeftIcon />
        </Button>
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />

        <Breadcrumb className="hidden sm:flex">
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="ml-auto flex items-center gap-2">
          <CommandPalette />
          <Button size="icon-sm" variant="ghost" className="relative">
            <BellIcon />
            <span className="sr-only">Notifications</span>
          </Button>
          <ThemeSwitch />
        </div>
      </div>
    </header>
  )
}
