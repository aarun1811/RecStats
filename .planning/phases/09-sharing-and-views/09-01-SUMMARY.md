---
phase: 09-sharing-and-views
plan: 01
subsystem: ui
tags: [tanstack-router, share-link, url-state, sonner, clipboard, managed-dashboards, regression]

requires:
  - phase: 08-dashboard-builder
    provides: useManagedDashboard hook + recviz_dashboards table
  - phase: 02-renderer-interactions
    provides: filter-store applyFilters + DashboardRenderer initialFilters/lockedFilters props

provides:
  - SHAR-02 shareable URLs (filter state encoded in ?filter.X= query params)
  - dashboard-url-state.ts shared utility (parser/serializer/stripper/share-URL builder)
  - ShareLinkButton domain component (outline button + clipboard + sonner toast)
  - View + edit routes upgraded from useDashboardConfig to useManagedDashboard
  - Outlet rendering on the view route so the nested edit route mounts correctly

affects: [09-02-embed, 09-03-command-palette, 10-testing]

tech-stack:
  added: []  # Phase 9 introduces no new libraries
  patterns:
    - "TanStack Router validateSearch + Route.useSearch + useNavigate({ search: (prev) => ..., replace: true }) for bidirectional URL state"
    - "useMatchRoute() + early-return <Outlet /> for parent routes that have child segments"
    - "300ms debounced URL writer with hasInitializedRef guard prevents URL/store ping-pong"
    - "Domain components (ShareLinkButton) live in components/dashboard/ and compose Shadcn primitives — never in components/ui/"

key-files:
  created:
    - frontend/src/lib/dashboard-url-state.ts
    - frontend/src/lib/dashboard-url-state.test.ts
    - frontend/src/components/dashboard/share-link-button.tsx
    - frontend/e2e/share-link.spec.ts
    - frontend/e2e/dashboard-view-regression.spec.ts
    - frontend/e2e/dashboard-edit-regression.spec.ts
    - .planning/phases/09-sharing-and-views/deferred-items.md
  modified:
    - frontend/src/routes/_app/dashboards/$dashboardId.tsx
    - frontend/src/routes/_app/dashboards/$dashboardId.edit.tsx
    - frontend/.gitignore

key-decisions:
  - "300ms debounce for URL writer (D-03 — Claude's discretion: long enough to coalesce rapid filter changes, short enough to feel live)"
  - "Stale filter IDs silently ignored (D-05 — naive parser passes through; renderer's initializeFilters merges with config.filters and unknown IDs never render)"
  - "Toast copy 'Link copied' / 'Could not copy link' (planner discretion — terse, no exclamation, matches existing Sonner pattern in query-results.tsx)"
  - "ShareLinkButton wraps its own TooltipProvider locally (mirrors dashboard-toolbar.tsx pattern; no global Tooltip provider in route tree)"
  - "View route renders <Outlet /> with useMatchRoute guard so the nested $dashboardId.edit child route can mount correctly (Rule 3 deviation — pre-existing TanStack Router file-based routing nesting bug discovered by Wave 0 tests)"

patterns-established:
  - "Bidirectional URL state sync via TanStack Router (validateSearch passthrough + useSearch read + navigate replace-mode write with hasInitializedRef guard)"
  - "Wave 0 RED → GREEN scaffolding: failing tests committed first, implementation lands in subsequent task to turn them green"
  - "Real-API E2E tests over mocks (per project memory feedback_no_mock_shortcuts.md) — share-link.spec.ts seeds dashboards via POST /api/dashboards/managed and deletes them in finally"

requirements-completed: [SHAR-02]

duration: 15min
completed: 2026-04-08
---

# Phase 9 Plan 01: Share Link + URL State Sync + Hook Upgrade Summary

**Bidirectional ?filter.X= URL state sync on the dashboard view route, single Share button that copies the current URL via navigator.clipboard, and the keystone `useDashboardConfig → useManagedDashboard` hook upgrade for both view and edit routes.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-08T00:40:39Z
- **Completed:** 2026-04-08T00:55:44Z
- **Tasks:** 5 (4 with code commits, 1 verification-only)
- **Files modified:** 9 (6 created, 3 modified)
- **Auto-fix commits:** 1 (Outlet fix for nested edit route)

## Accomplishments

- SHAR-02 delivered end-to-end: URL ⇆ filter store sync, debounced replace-mode writer, Share button + clipboard + toast
- Hook upgrade landed on both view and edit routes (`useManagedDashboard` returns the wrapper with top-level `name`, `description`, `createdAt`, `updatedAt` and the nested `config` blob)
- Lifted the embed route's inline filter parser into a shared `lib/dashboard-url-state.ts` module that Plans 09-02 (embed) and 09-03 (palette) can both consume
- Discovered AND fixed a pre-existing TanStack Router nesting bug: `/dashboards/:id/edit` was actually rendering the view route instead of the BuilderPage because the parent route never delegated to `<Outlet />`. The Wave 0 regression test `dashboard-edit-regression.spec.ts` caught it within minutes of the hook upgrade
- All 6 Phase 9 plan 09-01 e2e tests + all 31 unit tests + all 234 frontend unit tests + Playwright MCP-equivalent visual verification (9 checks across light + dark mode) GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 scaffolding (RED tests for SHAR-02 + view/edit regression)** — `b3fde17` (test)
2. **Task 2: Add dashboard-url-state utility (turns Wave 0 unit tests GREEN)** — `6aab53d` (feat) — TDD step
3. **Task 3: Add ShareLinkButton component** — `635c7e2` (feat)
4. **Task 4: Upgrade view+edit routes to useManagedDashboard + URL sync + Share button wiring** — `da908f5` (feat)
5. **Auto-fix: Render Outlet for nested edit route on view route (Rule 3)** — `511aeef` (fix)
6. **Task 5: Playwright E2E + visual verification (no source files; ran the suite + visually confirmed in Playwright)** — verification only, no commit

## Files Created/Modified

### Created
- `frontend/src/lib/dashboard-url-state.ts` — Six URL parser/serializer/stripper helpers (parseFilterParams, parseLockedFilters, parseHideTokens, serializeFilterParams, stripFilterParams, buildShareUrl). Plans 09-02 and 09-03 will consume this.
- `frontend/src/lib/dashboard-url-state.test.ts` — 31 vitest cases covering scalar/array/round-trip/stale-filter/empty-array behaviors plus the reserved-key skip for `filter.lock`.
- `frontend/src/components/dashboard/share-link-button.tsx` — Outline button + Tooltip + Share2 icon + sonner toast. Mirrors the sibling Edit button styling exactly per UI-SPEC reference parity.
- `frontend/e2e/share-link.spec.ts` — Four Playwright E2E tests covering URL write, URL hydration on mount, Share button + clipboard + toast, and replace-mode back-button non-pollution. All seed real dashboards via `POST /api/dashboards/managed`.
- `frontend/e2e/dashboard-view-regression.spec.ts` — Mandatory hook-upgrade regression for the view route.
- `frontend/e2e/dashboard-edit-regression.spec.ts` — Mandatory hook-upgrade regression for the edit route. Caught the pre-existing nested-route bug.
- `.planning/phases/09-sharing-and-views/deferred-items.md` — Logs the pre-existing tlm-stats-regression strict-mode locator failure (out of scope per execute-plan scope-boundary rule).

### Modified
- `frontend/src/routes/_app/dashboards/$dashboardId.tsx` — Hook swapped to `useManagedDashboard`; `validateSearch` permissive passthrough; `useMemo(parseFilterParams(search))` → `DashboardRenderer.initialFilters`; debounced 300ms `useEffect` that writes `applied` filters to URL with `replace: true`; `<ShareLinkButton />` placed left of Edit in a `flex items-center gap-2` cluster; **`<Outlet />` early-return with `useMatchRoute` guard** so the nested edit child mounts; URL writer disabled when edit child is active.
- `frontend/src/routes/_app/dashboards/$dashboardId.edit.tsx` — Hook swapped to `useManagedDashboard`; `const config = dashboard?.config` derivation preserves the existing `initFromConfig(dashboardId, config)` call exactly; not-found check tightened to `isError || !dashboard || !config`. Deliberately NO URL sync, NO Share button on edit route per UI-SPEC.
- `frontend/.gitignore` — Added `test-results` and `playwright-report` (Playwright runtime output, never committed).

## Decisions Made

- **Debounce: 300ms** (D-03 Claude's discretion). 200ms felt jittery in the planner sketch; 500ms felt laggy. 300ms coalesces typical filter-bar interactions into one URL write while still feeling live.
- **Stale filter handling: silent ignore** (D-05 Claude's discretion). The parser is deliberately naive — unknown filter IDs flow into the store but the renderer's `initializeFilters` merges with `config.filters` keyed by ID, so unknown IDs are simply never rendered and cause no error.
- **Toast copy: "Link copied" / "Could not copy link"** (planner discretion). Terse, no exclamation, matches the existing `query-results.tsx` "Copied to clipboard" precedent.
- **Local TooltipProvider in ShareLinkButton** rather than relying on a route-tree-level provider. Mirrors `dashboard-toolbar.tsx` pattern.
- **Route nesting fix via Outlet + useMatchRoute** rather than restructuring the file layout. Renaming `$dashboardId.edit.tsx` to a folder structure to make it a sibling route would have been a larger blast radius and out of scope for this plan.
- **Visual verification via temporary `_visual-verify.spec.ts`** (deleted after run). The plan referenced "Playwright MCP" but the runtime equivalent in this session was a one-shot Playwright spec that captured 8 screenshots covering Share button placement, tooltip text, toast appearance, URL update behavior, edit route loads BuilderPage, and dark-mode parity. All 9 checks passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TanStack Router nested edit route never reached BuilderPage**

- **Found during:** Task 5 (Playwright regression run after the Task 4 hook upgrade)
- **Issue:** `dashboard-edit-regression.spec.ts` failed because navigating to `/dashboards/{id}/edit` rendered the **view route** (showing Share + Edit + Refresh + filter bar), NOT the BuilderPage. Root cause: the file `$dashboardId.edit.tsx` is auto-nested as a CHILD of `$dashboardId.tsx` by TanStack Router's dot-notation file-based routing (verified in `routeTree.gen.ts:123` — `getParentRoute: () => AppDashboardsDashboardIdRoute`). The parent component mounted on `/edit` URLs but rendered its own view UI instead of delegating to `<Outlet />`. This is a **pre-existing bug** that the Wave 0 regression test exposed within minutes of the hook upgrade. Confirmed by running the same probe against the prior commit: also failed.
- **Fix:** Added `Outlet` + `useMatchRoute` imports to `$dashboardId.tsx`. Computed `isEditChildActive` via `matchRoute({ to: '/dashboards/$dashboardId/edit', params: { dashboardId } })`. Early-return `<Outlet />` when the child is active, skipping the view skeleton, header, ShareLinkButton, and DashboardRenderer entirely. Also disabled the URL writer effect when the child is active so the BuilderPage is not polluted with stale filter params from a prior view session.
- **Files modified:** `frontend/src/routes/_app/dashboards/$dashboardId.tsx`
- **Verification:** `dashboard-edit-regression.spec.ts` and `dashboard-view-regression.spec.ts` both green; visual verification screenshot `05-edit-builder.png` shows the BuilderPage with "EDIT MODE" badge, "Save Dashboard" button, and the dashboard's filters in builder mode.
- **Committed in:** `511aeef`

**2. [Rule 3 - Blocking] Playwright runtime output committed accidentally**

- **Found during:** Task 5 (final git status check)
- **Issue:** `frontend/test-results/` was untracked. Playwright generates this directory on every run with screenshots, traces, and reports. Should never be committed.
- **Fix:** Added `test-results` and `playwright-report` to `frontend/.gitignore`.
- **Files modified:** `frontend/.gitignore`
- **Verification:** `git status --short` no longer shows `test-results/` after run.
- **Committed in:** Will be in the final metadata commit alongside this SUMMARY.

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both auto-fixes were essential for plan completion. The Outlet fix was a pre-existing routing bug that the hook upgrade brought to light via the new regression test — without it, the entire dashboard edit flow was broken. The .gitignore addition is hygiene. No scope creep, no architectural changes.

## Issues Encountered

- **tlm-stats-regression.spec.ts strict-mode failure** — pre-existing test brittleness. The locator `text=TLM Instance` matches 3 elements (the dashboard description text "Reconciliation statistics for TLM instances", the filter label, and the combobox value). This existed BEFORE Phase 9 — confirmed by running on the prior commit. Logged to `deferred-items.md` per execute-plan scope-boundary rule. Suggested fix: tighten to `getByRole('combobox', { name: 'TLM Instance' })`. Owner: Phase 10 testing pass or a small Quick fix.

## User Setup Required

None — no external service configuration introduced. SHAR-02 is purely client-side URL plumbing.

## Next Phase Readiness

- **Plan 09-02 (embed)** can now consume `lib/dashboard-url-state.ts` for `parseHideTokens` and the lifted parser. Should follow the same hook upgrade pattern from Task 4 (`useManagedDashboard` instead of `useDashboardConfig`).
- **Plan 09-03 (command palette)** is unblocked — it does not depend on plan 09-01 directly but the validation suite established here (real-API E2E tests, no mocks) should be the template.
- **Threat model status:** T-9-1, T-9-3, T-9-5, T-9-10, T-9-11 all mitigated. No new threat surface introduced (Share button reads window.location.href only, all toast/tooltip copy is hardcoded, debounce + replace prevent URL flooding).
- **Open follow-up:** the tlm-stats-regression locator should be tightened in a future plan; tracked in `.planning/phases/09-sharing-and-views/deferred-items.md`.

## Self-Check: PASSED

All 10 expected files exist on disk. All 5 task commit hashes (`b3fde17`, `6aab53d`, `635c7e2`, `da908f5`, `511aeef`) verified via `git log --oneline --all`. Final tsc clean. Final vitest 234/234 green. Final Phase 9 e2e suite 6/6 green.

---
*Phase: 09-sharing-and-views*
*Completed: 2026-04-08*
