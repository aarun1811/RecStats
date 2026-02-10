import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/query-client'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { PageTransition } from '@/components/shared/page-transition'

export const Route = createRootRoute({
  component: RootLayout,
})

function AnimatedOutlet() {
  const { location } = useRouterState()
  return (
    <PageTransition key={location.pathname}>
      <Outlet />
    </PageTransition>
  )
}

function RootLayout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider
          style={{
            '--sidebar-width': 'calc(var(--spacing) * 64)',
            '--header-height': 'calc(var(--spacing) * 14)',
          } as React.CSSProperties}
        >
          <AppSidebar />
          <SidebarInset>
            <Header />
            <div className="flex flex-1 flex-col overflow-auto">
              <ErrorBoundary>
                <AnimatedOutlet />
              </ErrorBoundary>
            </div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
