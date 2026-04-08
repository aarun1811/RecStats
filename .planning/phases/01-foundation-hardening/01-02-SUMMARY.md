---
phase: 01-foundation-hardening
plan: 02
subsystem: infra
tags: [intl-numberformat, formatting, superset, dead-code, vitest, typescript]

# Dependency graph
requires: []
provides:
  - "Centralized formatValue/formatValueFull utility for all financial number formatting"
  - "FormatNumberOptions/FormatType types for formatting configuration"
  - "Superset pinned to 6.0.0 in requirements.txt"
  - "Legacy dead code removed (filter-bar, kpi-row, chart-grid, chart-panel, kpi-card)"
  - "Vitest test infrastructure for frontend"
affects: [02-cross-filter-drill, 03-chart-interactions, 06-chart-library, 07-kpi-library]

# Tech tracking
tech-stack:
  added: [vitest]
  patterns: [centralized-formatting-via-intl, locale-pinned-number-formatting, tdd-for-utilities]

key-files:
  created:
    - frontend/src/lib/formatters.ts
    - frontend/src/lib/formatters.test.ts
    - frontend/src/types/formatting.ts
    - frontend/vitest.config.ts
  modified:
    - frontend/src/components/shared/count-animation.tsx
    - frontend/src/components/grid/cell-renderers/amount-cell.tsx
    - frontend/src/components/dashboard/config-kpi-row.tsx
    - backend/requirements.txt
    - frontend/src/hooks/use-kpi-data.ts
    - frontend/src/hooks/use-chart-data.ts

key-decisions:
  - "Locale pinned to en-US for financial consistency across all users"
  - "Compact notation defaults to 1 decimal for readability (1.2M not 1M)"
  - "Currency falls back to plain number when currencyCode missing (no hardcoded USD)"
  - "Also deleted chart-panel.tsx and kpi-card.tsx (only imported by deleted files)"
  - "Superset client auth/CSRF/retry logic reviewed and confirmed solid -- no changes needed"

patterns-established:
  - "Centralized formatting: all number formatting goes through formatters.ts"
  - "TDD pattern: vitest with tests alongside source files"
  - "FormatNumberOptions interface for all formatting configuration"

requirements-completed: [INFR-03, INFR-05, INFR-06]

# Metrics
duration: 5min
completed: 2026-04-04
---

# Phase 01 Plan 02: Formatting, Superset Pin, Dead Code Summary

**Centralized Intl.NumberFormat utility (formatValue/formatValueFull) with 19 tests, Superset pinned to 6.0.0, 5 legacy dead code files deleted**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-04T18:08:48Z
- **Completed:** 2026-04-04T18:14:13Z
- **Tasks:** 2
- **Files modified:** 14 (6 created, 3 modified, 5 deleted)

## Accomplishments
- Created `formatters.ts` with `formatValue`/`formatValueFull` using `Intl.NumberFormat` -- handles number, currency, percentage, decimal with compact notation, locale pinning, and null safety
- Updated all three consumers (count-animation, amount-cell, config-kpi-row) to use centralized formatter -- removed hardcoded USD default, added KPI hover tooltips with full values
- Pinned apache-superset to 6.0.0 in requirements.txt, reviewed superset_client.py auth/CSRF/retry (all solid)
- Deleted 5 legacy dead code files (filter-bar, kpi-row, chart-grid, chart-panel, kpi-card) -- 973 lines removed, zero dangling imports
- Installed vitest and created test infrastructure with 19 passing tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create centralized number formatting utility and update consumers**
   - `d5a8a98` (test): TDD tests + formatters implementation + types + vitest setup
   - `24b232b` (feat): Wire formatters to count-animation, amount-cell, config-kpi-row

2. **Task 2: Pin Superset version and remove legacy dead code** - `5c946dc` (chore)

## Files Created/Modified
- `frontend/src/lib/formatters.ts` - Centralized number formatting utility with formatValue/formatValueFull
- `frontend/src/lib/formatters.test.ts` - 19 vitest tests covering all format types and edge cases
- `frontend/src/types/formatting.ts` - FormatType and FormatNumberOptions type definitions
- `frontend/vitest.config.ts` - Vitest configuration with path aliases
- `frontend/src/components/shared/count-animation.tsx` - Replaced inline formatNumber with formatValue
- `frontend/src/components/grid/cell-renderers/amount-cell.tsx` - Replaced inline Intl.NumberFormat with formatValue, removed hardcoded USD
- `frontend/src/components/dashboard/config-kpi-row.tsx` - Added abbreviated numbers with hover full-value tooltips
- `backend/requirements.txt` - Pinned apache-superset==6.0.0
- `frontend/src/hooks/use-kpi-data.ts` - Added Phase 2 TODO comment
- `frontend/src/hooks/use-chart-data.ts` - Added Phase 2 TODO comment
- DELETED: `frontend/src/components/dashboard/filter-bar.tsx`
- DELETED: `frontend/src/components/dashboard/kpi-row.tsx`
- DELETED: `frontend/src/components/dashboard/chart-grid.tsx`
- DELETED: `frontend/src/components/dashboard/chart-panel.tsx`
- DELETED: `frontend/src/components/dashboard/kpi-card.tsx`

## Decisions Made
- **Locale pinned to en-US:** Financial numbers must display identically across all users' browser settings for reconciliation/audit consistency. Single constant to change if needed.
- **Compact notation uses 1 decimal by default:** Intl.NumberFormat compact with 0 decimals shows "1M" instead of "1.2M". Defaulting to 1 decimal for abbreviated numbers gives more useful display.
- **Currency falls back to plain number:** When currencyCode is missing, format as plain number rather than crash or default to USD. Per D-14, no hardcoded currency defaults.
- **Deleted chart-panel.tsx and kpi-card.tsx too:** Both were only imported by the three files being deleted. Confirmed zero other imports.
- **Superset client unchanged:** Auth/CSRF/retry logic in superset_client.py is correctly implemented -- token refresh before 30-min expiry, 401 retry with re-auth, CSRF token on state-changing requests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Also deleted chart-panel.tsx and kpi-card.tsx**
- **Found during:** Task 2 (dead code audit)
- **Issue:** chart-panel.tsx only imported by chart-grid.tsx, kpi-card.tsx only imported by kpi-row.tsx -- both dead code
- **Fix:** Deleted both files after confirming zero other imports
- **Files modified:** chart-panel.tsx (deleted), kpi-card.tsx (deleted)
- **Verification:** grep confirmed no dangling imports, tsc --noEmit passes
- **Committed in:** 5c946dc

**2. [Rule 1 - Bug] Fixed compact notation losing decimal precision**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Intl.NumberFormat compact notation with maximumFractionDigits: 0 produces "1M" not "1.2M"
- **Fix:** When abbreviate is true for number type, default maximumFractionDigits to 1 instead of 0
- **Files modified:** frontend/src/lib/formatters.ts
- **Verification:** Tests pass: 1234567 -> "1.2M", 45300 -> "45.3K"
- **Committed in:** d5a8a98

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None -- plan executed smoothly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Centralized formatting utility available for all future components
- Vitest test infrastructure in place for frontend unit tests
- Cross-filter and drill-down components preserved and ready for Phase 2
- Legacy hooks (use-chart-data, use-kpi-data) marked with TODO for Phase 2 porting
- use-breaks-data.ts confirmed still in use by data-grid.tsx (not dead code)

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log. All deleted files confirmed absent. 19/19 tests passing. TypeScript compilation clean.

---
*Phase: 01-foundation-hardening*
*Completed: 2026-04-04*
