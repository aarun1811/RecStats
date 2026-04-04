import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { PageTransition } from '@/components/shared/page-transition'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AnimatedOutlet() {
  const { location } = useRouterState()
  return (
    <PageTransition key={location.pathname}>
      <Outlet />
    </PageTransition>
  )
}

function AppLayout() {
  return (
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
  )
}
