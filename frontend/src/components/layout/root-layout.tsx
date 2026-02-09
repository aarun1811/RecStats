import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Topbar } from '@/components/layout/topbar'
import {
  CommandPalette,
  useCommandPalette,
} from '@/components/layout/command-palette'

interface RootLayoutProps {
  children: React.ReactNode
}

export function RootLayout({ children }: RootLayoutProps) {
  const { open, setOpen } = useCommandPalette()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Topbar onOpenCommandPalette={() => setOpen(true)} />
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </SidebarInset>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </SidebarProvider>
  )
}
