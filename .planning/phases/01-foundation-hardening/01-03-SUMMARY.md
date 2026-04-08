---
phase: 01-foundation-hardening
plan: 03
subsystem: api, ui
tags: [fastapi, error-handling, httpx, pydantic, react, tanstack-query, sonner, shadcn]

requires:
  - phase: 01-foundation-hardening/01
    provides: DB-backed ConfigStore replaces mock fallback data source for dashboards

provides:
  - Structured error response model (ErrorResponse) for all API endpoints
  - sanitize_detail() helper for safe client-facing error messages
  - All API endpoints return HTTP 503/502/504/500 with structured error bodies
  - Frontend ApiError class parsing structured backend errors
  - ErrorPanel component for per-component inline error display with retry
  - Global Sonner toast notification on API errors via QueryCache

affects: [phase-02, phase-03, phase-04, all-api-endpoints, all-dashboard-components]

tech-stack:
  added: []
  patterns: [structured-error-responses, per-component-error-isolation, sanitized-error-detail, global-error-toast]

key-files:
  created:
    - backend/app/models/error.py
    - backend/app/core/errors.py
    - frontend/src/components/shared/error-panel.tsx
  modified:
    - backend/app/api/charts.py
    - backend/app/api/sql.py
    - backend/app/api/databases.py
    - backend/app/api/datasets.py
    - backend/app/api/search.py
    - backend/app/api/custom.py
    - backend/app/api/export.py
    - backend/app/api/views.py
    - frontend/src/lib/api-client.ts
    - frontend/src/lib/query-client.ts
    - frontend/src/components/dashboard/config-kpi-row.tsx
    - frontend/src/components/dashboard/config-chart-grid.tsx
    - frontend/src/components/dashboard/config-data-grid.tsx

key-decisions:
  - "Search endpoint gracefully degrades: returns partial results from ConfigStore when Superset unavailable (no 503)"
  - "Error detail sanitized via sanitize_detail() — truncates to 500 chars, redacts connection URIs"
  - "databases.py and custom.py use helper functions (_superset_unavailable, _handle_httpx_error) to reduce exception-handling boilerplate"
  - "export.py and views.py not-found cases converted from dict returns to HTTPException (Rule 2 fix)"

patterns-established:
  - "Structured error pattern: all API errors return {error, message, detail, retry_after} dict in HTTPException detail"
  - "httpx exception cascade: ConnectError->503, TimeoutException->504, HTTPStatusError->502, Exception->500"
  - "Frontend ApiError parsing: constructor parses JSON from response text, extracts code/userMessage/detail/retryAfter"
  - "ErrorPanel usage: import ErrorPanel, check isError from useQuery, render with apiError?.userMessage and onRetry={refetch}"
  - "Global toast via QueryCache onError: fires Sonner toast.error for every ApiError, no per-hook wiring needed"

requirements-completed: [INFR-04]

duration: 8min
completed: 2026-04-05
---

# Phase 01 Plan 03: Mock Data Removal & Structured Error Handling Summary

**Deleted mock_data.py, replaced all 8 API endpoint mock fallbacks with structured HTTP errors, created ErrorPanel component with retry and expandable details**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-04T18:29:41Z
- **Completed:** 2026-04-04T18:37:52Z
- **Tasks:** 2
- **Files modified:** 17 (1 deleted, 2 created, 14 modified)

## Accomplishments
- Deleted `backend/app/mock_data.py` entirely -- zero MOCK_ references remain in the codebase
- All 8 API endpoint files (charts, sql, databases, datasets, search, custom, export, views) now return structured HTTP errors with error/message/detail/retry_after fields
- Created `ErrorPanel` component with retry button and expandable technical details for per-component error display
- Enriched `ApiError` class to parse structured backend error responses (code, userMessage, detail, retryAfter)
- Added global Sonner toast notification on API errors via QueryCache onError
- Wired ErrorPanel into ConfigKpiRow, ConfigChartGrid, and ConfigDataGrid for per-component error isolation
- Frontend compiles with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove mock data and add structured error responses to all API endpoints** - `7cd97e5` (feat)
2. **Task 2: Add frontend error handling with ErrorPanel component and Sonner toast integration** - `b2fbfab` (feat)

## Files Created/Modified

### Created
- `backend/app/models/error.py` - Structured ErrorResponse Pydantic model
- `backend/app/core/errors.py` - sanitize_detail() helper for safe client-facing error messages
- `frontend/src/components/shared/error-panel.tsx` - Inline error panel with retry button and expandable details

### Deleted
- `backend/app/mock_data.py` - Removed entirely (was 244 lines of hardcoded mock data)

### Modified (Backend)
- `backend/app/api/charts.py` - Removed MOCK_CHARTS/MOCK_CHART_DATA imports, added httpx exception handling
- `backend/app/api/sql.py` - Removed MOCK_DATABASES import and _mock_execute() function, added structured errors
- `backend/app/api/databases.py` - Removed MOCK_DATABASES/MOCK_DATABASE_DATASETS and _mock_databases state, added structured errors
- `backend/app/api/datasets.py` - Removed MOCK_DATASETS import, added structured errors
- `backend/app/api/search.py` - Replaced MOCK_CHARTS/MOCK_DASHBOARDS/MOCK_DATASETS with ConfigStore + Superset calls
- `backend/app/api/custom.py` - Removed MOCK_KPI and MOCK_COUNTERPARTIES fallbacks, added structured errors
- `backend/app/api/export.py` - Fixed not-found to raise HTTPException instead of returning dict
- `backend/app/api/views.py` - Fixed not-found to raise HTTPException instead of returning dict

### Modified (Frontend)
- `frontend/src/lib/api-client.ts` - Enriched ApiError with code, userMessage, detail, retryAfter
- `frontend/src/lib/query-client.ts` - Added QueryCache with global onError toast
- `frontend/src/components/dashboard/config-kpi-row.tsx` - Added ErrorPanel on isError
- `frontend/src/components/dashboard/config-chart-grid.tsx` - Added ErrorPanel to QueryChartItem on isError
- `frontend/src/components/dashboard/config-data-grid.tsx` - Added ErrorPanel to SingleSourceGrid and MergedSourceGrid on isError

## Decisions Made

1. **Search endpoint graceful degradation**: Unlike other endpoints that return 503 when Superset is unavailable, the search endpoint returns partial results from ConfigStore (dashboards always available) and logs warnings for unavailable chart/dataset search. This provides better UX -- search still works for dashboards.

2. **Error detail sanitization**: Created a shared `sanitize_detail()` helper rather than inline sanitization. Truncates to 500 chars and redacts PostgreSQL/Oracle/Hive connection URIs to prevent credential leakage.

3. **Helper functions for databases.py and custom.py**: These files have many endpoints, so `_superset_unavailable()` and `_handle_httpx_error()` helper functions reduce boilerplate while maintaining the same structured error pattern.

4. **Global toast via QueryCache**: Instead of adding onError callbacks to each hook, used TanStack Query's QueryCache onError for global toast notification. This fires automatically for any query that throws ApiError.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed export.py and views.py not-found error handling**
- **Found during:** Task 1
- **Issue:** export_status() returned `{"error": "Job not found"}` dict and delete_view() returned `{"error": "View not found"}` dict instead of raising HTTPException. This violates the structured error pattern.
- **Fix:** Both now raise HTTPException with status_code=404 and structured error detail
- **Files modified:** backend/app/api/export.py, backend/app/api/views.py
- **Verification:** No dict error returns remain in any API endpoint
- **Committed in:** 7cd97e5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical)
**Impact on plan:** Essential for consistent error handling across all endpoints. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All API endpoints return structured errors -- Phase 2+ endpoints can follow the established pattern
- ErrorPanel component available for any future dashboard component that fetches data
- Global toast notification fires automatically for any new TanStack Query that throws ApiError
- No mock data remains -- all data flows through Superset or ConfigStore

## Self-Check: PASSED

- All 3 created files exist on disk
- mock_data.py confirmed deleted
- Both task commits (7cd97e5, b2fbfab) found in git log
- SUMMARY.md created at expected path

---
*Phase: 01-foundation-hardening*
*Completed: 2026-04-05*
