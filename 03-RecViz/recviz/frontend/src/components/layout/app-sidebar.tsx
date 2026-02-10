import { useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'
import { BarChart3, ChevronsUpDown } from 'lucide-react'
import { useIsTablet } from '@/hooks/use-mobile'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { NavMain } from './nav-main'
import { NavUser } from './nav-user'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation()
  const { setOpen, setOpenMobile, isMobile } = useSidebar()
  const isTablet = useIsTablet()

  // Close mobile sidebar on route change
  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [pathname, isMobile, setOpenMobile])

  // Auto-collapse on tablet
  useEffect(() => {
    setOpen(!isTablet)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTablet])

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  className="hover:text-foreground h-10 group-data-[collapsible=icon]:px-0! hover:bg-[var(--primary)]/5"
                  tooltip="RecViz"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <BarChart3 className="size-4" />
                  </div>
                  <span className="text-foreground font-semibold group-data-[collapsible=icon]:hidden">RecViz</span>
                  <ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="mt-4 w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel>Environments</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-md border">
                    <BarChart3 className="text-muted-foreground size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Production</span>
                    <span className="text-xs text-green-700">Active</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-md border">
                    <BarChart3 className="text-muted-foreground size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">UAT</span>
                    <span className="text-muted-foreground text-xs">Inactive</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          <NavMain />
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
