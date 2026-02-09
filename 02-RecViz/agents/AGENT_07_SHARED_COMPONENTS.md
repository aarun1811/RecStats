# Agent 07 — Shared Components

## Mission
Build reusable shared components used across the app: loading skeletons, error boundary, empty state, animated counter, and other utility components.

## Read First
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/CLAUDE.md`
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/agents/AGENT_00_RESULT.md`

## Working Directory
`/Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz/frontend/`

## What Already Exists
- Shadcn `<Skeleton>` component in `src/components/ui/skeleton.tsx`
- Framer Motion package installed
- `src/lib/utils.ts` with `cn()` and number formatters

## Files To Create

### 1. `src/components/shared/loading-skeleton.tsx`
Page-level skeleton loaders for each page type:

```tsx
// Dashboard skeleton
export function DashboardSkeleton() {
  // Filter bar skeleton (rectangle)
  // 4 KPI card skeletons (cards with animated shimmer)
  // 4 chart panel skeletons (cards with chart-shaped skeleton)
  // Grid skeleton (table rows with shimmer)
}

// Explorer skeleton
export function ExplorerSkeleton() {
  // Schema tree skeleton
  // Editor skeleton
  // Results skeleton
}

// Generic page skeleton
export function PageSkeleton() { ... }
```

Use Shadcn's `<Skeleton>` with `animate-pulse`. Layout should match the actual page structure so the transition from skeleton → content is smooth (no layout shift).

### 2. `src/components/shared/error-boundary.tsx`
React Error Boundary with a styled fallback:
- Class component (error boundaries require class components in React)
- Fallback UI: centered card with error icon, message, "Try Again" button, "Report Issue" link
- `onReset` callback to retry (calls `window.location.reload()` or custom reset)
- Logs error to console (in dev)
- Styled with Shadcn card + destructive colors
- Export both the boundary class and a `withErrorBoundary` HOC

### 3. `src/components/shared/empty-state.tsx`
Empty state component for when there's no data:
- Props: `icon` (Lucide icon component), `title`, `description`, `action` (optional button)
- Centered layout with icon (large, muted), title, description text
- Optional action button (e.g., "Create your first dashboard", "Run a query")
- Variants: `default`, `search` (for no search results), `error` (for failed loads)
- Uses Framer Motion fade-in animation

### 4. `src/components/shared/animated-counter.tsx`
Number animation for KPI cards:
- Props: `value` (number), `duration` (ms, default 1000), `format` ('number' | 'percent' | 'currency' | 'days')
- Animates from 0 (or previous value) to target value
- Uses `useSpring` from Framer Motion
- Formats the animated value using the appropriate formatter from utils
- Triggers animation on mount and when `value` changes
- Respects `prefers-reduced-motion`

### 5. `src/components/shared/page-header.tsx`
Consistent page header used at the top of each page:
- Props: `title`, `description` (optional), `actions` (optional ReactNode for buttons)
- Layout: title left, actions right
- Title: `text-2xl font-semibold`
- Description: `text-muted-foreground`
- Bottom border separator

### 6. `src/components/shared/confirm-dialog.tsx`
Reusable confirmation dialog:
- Props: `open`, `onOpenChange`, `title`, `description`, `onConfirm`, `variant` ('default' | 'destructive')
- Uses Shadcn `<Dialog>` with proper focus management
- "Cancel" and "Confirm" buttons
- Destructive variant: red confirm button

### 7. `src/components/shared/data-freshness.tsx`
Small indicator showing when data was last refreshed:
- Props: `lastUpdated` (Date), `isRefreshing` (boolean)
- Shows relative time: "Updated 2 min ago"
- Spinning refresh icon when isRefreshing is true
- Click to manually refresh
- Used in chart panels and grid headers

### 8. `src/components/shared/keyboard-shortcut.tsx`
Display keyboard shortcuts in UI:
- Props: `keys` (string[], e.g., ['⌘', 'K'])
- Renders styled key badges
- Used in command palette items, tooltips, etc.
- Detects Mac vs Windows for correct modifier key display

## Design Requirements
- All shared components must be self-contained — no external state dependencies
- Props-driven, no internal data fetching
- Every component works in light and dark mode
- Animations respect `prefers-reduced-motion` media query
- Consistent spacing and typography with rest of app

## Acceptance Criteria
- [ ] `<DashboardSkeleton>` matches dashboard layout structure
- [ ] `<ErrorBoundary>` catches render errors and shows fallback
- [ ] `<EmptyState>` renders centered with icon, title, description
- [ ] `<AnimatedCounter>` smoothly animates from 0 to value
- [ ] `<PageHeader>` renders title + optional actions
- [ ] `<ConfirmDialog>` opens/closes with proper focus management
- [ ] All components render correctly in dark mode
- [ ] No TypeScript errors
