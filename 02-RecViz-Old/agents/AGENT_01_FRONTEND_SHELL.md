# Agent 01 — Frontend Shell

## Mission
Build the application shell: root layout, sidebar navigation, topbar, routing, theme provider, and command palette. This is the frame that all pages render inside.

## Read First
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/CLAUDE.md`
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/agents/AGENT_00_RESULT.md`

## Working Directory
`/Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz/frontend/`

## What Already Exists (from scaffolding)
- All Shadcn/ui components in `src/components/ui/` (sidebar, command, sheet, tooltip, etc.)
- `src/stores/theme-store.ts` and `src/stores/sidebar-store.ts`
- `src/app.tsx` (has QueryClientProvider, needs RouterProvider added)
- `src/main.tsx`
- `src/lib/utils.ts`, `src/lib/constants.ts`

## Files To Create

### 1. TanStack Router Setup

#### `src/routes/__root.tsx`
Root route that wraps all pages in the layout shell.
```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { RootLayout } from '@/components/layout/root-layout'

export const Route = createRootRoute({
  component: () => (
    <RootLayout>
      <Outlet />
    </RootLayout>
  ),
})
```

#### `src/routes/index.tsx`
Home redirect to /dashboard.

#### `src/routes/dashboard/index.tsx`
Dashboard list page (placeholder — Agent 03 fills in content).
```tsx
export const Route = createFileRoute('/dashboard/')({
  component: () => <div>Dashboard List — placeholder</div>,
})
```

#### `src/routes/dashboard/$dashboardId.tsx`
Individual dashboard page (placeholder).

#### `src/routes/explorer/index.tsx`
Data explorer page (placeholder — Agent 06 fills in).

#### `src/routes/reports/index.tsx`
Reports page (placeholder).

#### `src/routes/settings/index.tsx`
Settings page (placeholder).

#### `src/routeTree.gen.ts`
Run `npx tsr generate` to auto-generate the route tree after creating route files.

### 2. Layout Components

#### `src/components/layout/root-layout.tsx`
- Uses Shadcn `<SidebarProvider>` and `<SidebarInset>`
- Renders `<AppSidebar />`, `<TopBar />`, and `{children}` (the page outlet)
- Reads theme from `useThemeStore` and applies `dark` class to `<html>`
- Uses Framer Motion `<AnimatePresence>` for page transitions
- Clean, generous spacing — `p-6` content area

#### `src/components/layout/app-sidebar.tsx`
- Uses Shadcn `<Sidebar>` component
- Logo/brand at top
- Navigation items: Dashboards, Data Explorer, Reports, Settings
- Each item uses Lucide icons: `LayoutDashboard`, `Database`, `FileText`, `Settings`
- Active route highlighting via TanStack Router `useMatchRoute`
- Collapsible via `useSidebarStore`
- Footer section with theme toggle and user avatar placeholder
- Smooth collapse/expand animation

#### `src/components/layout/topbar.tsx`
- Horizontal bar above page content
- Left: Breadcrumbs using Shadcn `<Breadcrumb>` (derive from current route)
- Right: Search trigger button (opens command palette), theme toggle (sun/moon icon), user avatar dropdown
- Height: `h-14`, border-bottom, `bg-background`

#### `src/components/layout/command-palette.tsx`
- Uses Shadcn `<Command>` inside a `<Dialog>`
- Opens with `Cmd+K` / `Ctrl+K` keyboard shortcut
- Groups: "Navigation" (pages), "Dashboards" (list), "Actions" (theme toggle, etc.)
- Search filters results
- Selecting a nav item navigates via TanStack Router

#### `src/components/layout/theme-provider.tsx`
- Reads `theme` from `useThemeStore`
- On mount + theme change: applies/removes `dark` class on `document.documentElement`
- Handles `system` preference via `window.matchMedia('(prefers-color-scheme: dark)')`
- Listens for system theme changes

### 3. Update `src/app.tsx`
- Add `<ThemeProvider>` wrapper
- Add TanStack Router: create router instance, add `<RouterProvider>`
- Keep existing `<QueryClientProvider>`
- Add `<Toaster />` (Shadcn sonner) for toast notifications

### 4. Install TanStack Router Plugin
```bash
npm install @tanstack/react-router-vite-plugin
```
Add to `vite.config.ts` plugins array.

## Design Requirements
- Sidebar width: 240px expanded, 48px collapsed (icon-only)
- Sidebar transition: spring animation (Framer Motion or CSS transition)
- Topbar: fixed height, doesn't scroll
- Content area: scrollable, `overflow-y-auto`
- All text: Inter/Geist font (already set in index.css)
- Dark mode must work fully — sidebar, topbar, command palette all adapt

## Acceptance Criteria
- [ ] App renders with sidebar + topbar + content area
- [ ] Navigating between routes works (dashboard, explorer, reports, settings)
- [ ] Sidebar collapses/expands with animation
- [ ] Cmd+K opens command palette
- [ ] Theme toggle switches between light/dark/system
- [ ] Breadcrumbs update based on current route
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Page transitions animate smoothly
