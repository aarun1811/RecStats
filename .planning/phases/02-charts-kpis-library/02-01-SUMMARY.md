---
phase: 02-charts-kpis-library
plan: 01
subsystem: database
tags: [seed-data, charts, oracle, visualization, ag-charts, echarts]

# Dependency graph
requires:
  - phase: 01-seed-infrastructure
    provides: "17 curated datasets with column definitions in seed-oracle.py"
provides:
  - "45 curated chart definitions covering all 16 supported chart types"
  - "5 new datasets (breaks-by-region, breaks-by-desk, match-rate-by-region, monthly-volume, sla-daily)"
  - "_chart() helper with typeSpecific support for heatmap/gauge/treemap configs"
affects: [02-charts-kpis-library, 03-dashboard-composition]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "typeSpecific config pattern: _chart() kwarg maps to ChartAppearance.typeSpecific"
    - "Chart organization: grouped by dataset with inline column reference comments"

key-files:
  created: []
  modified:
    - "scripts/seed-oracle.py"

key-decisions:
  - "Used ROUND() instead of ::numeric() cast for Oracle 19c compatibility in new dataset SQL"
  - "Treemap colorKey set to asset_class for desk grouping visual"
  - "Heatmap colorRange uses green-amber-red hex values (#22c55e, #eab308, #ef4444)"
  - "Gauge thresholds: greenAbove=90, amberAbove=75 for match rate"
  - "Bar charts dominate (21/45) reflecting the most common BI use case"

patterns-established:
  - "Chart naming: chart-{domain}-{metric}-{type} slug pattern"
  - "typeSpecific kwarg: optional dict passed through to appearance.typeSpecific"

requirements-completed: [CHRT-01, CHRT-02, CHRT-03, CHRT-04, CHRT-05]

# Metrics
duration: 3min
completed: 2026-04-13
---

# Phase 2 Plan 01: Curated Charts Library Summary

**45 production-quality chart definitions across all 16 chart types with valid column mappings, typeSpecific configs for heatmap/gauge/treemap, and 5 new supporting datasets**

## Performance

- **Duration:** 3 min 33s
- **Started:** 2026-04-13T07:33:04Z
- **Completed:** 2026-04-13T07:36:37Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced all 22 existing CURATED_CHARTS with 45 new production-quality charts organized by dataset
- Added 5 new datasets (ds-recon-breaks-by-region, ds-recon-breaks-by-desk, ds-recon-match-rate-by-region, ds-recon-monthly-volume, ds-recon-sla-daily) expanding CURATED_DATASETS from 17 to 22
- All 16 chart types represented: bar(21), line(3), pie(3), donut(3), area(2), combo(2), treemap(2), stacked-bar(1), waterfall(1), gauge(1), heatmap(1), scatter(1), parallel(1), funnel(1), sankey(1), radar(1)
- typeSpecific configs set for heatmap (colorRange), gauge (min/max/thresholds), treemap (colorKey) on 4 charts
- Every chart's categoryColumn and metricColumns validated against actual dataset column names

## Task Commits

Each task was committed atomically:

1. **Task 1: Add typeSpecific support to _chart() helper and add 5 new datasets** - `1f58cf4` (feat)
2. **Task 2: Delete existing 22 charts and create 45 new CURATED_CHARTS** - `6c6f79a` (feat)

## Files Created/Modified
- `scripts/seed-oracle.py` - Added type_specific kwarg to _chart(), 5 new datasets, 45 new chart definitions replacing old 22

## Decisions Made
- Used `ROUND()` instead of `::numeric()` cast in new dataset SQL templates for Oracle 19c compatibility (Oracle doesn't support Postgres-style casts)
- Heatmap colorRange uses traffic-light hex values: green (#22c55e), amber (#eab308), red (#ef4444)
- Gauge thresholds: greenAbove=90%, amberAbove=75% -- matching industry match rate targets
- Treemap colorKey set to `asset_class` for natural desk grouping

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Oracle-compatible SQL syntax in new datasets**
- **Found during:** Task 1 (adding 5 new datasets)
- **Issue:** Plan used `::numeric(10,2)` Postgres cast syntax in ds-recon-breaks-by-region SQL
- **Fix:** Changed to `ROUND(AVG(b.aging_days), 2)` which works on both Oracle and Postgres
- **Files modified:** scripts/seed-oracle.py
- **Verification:** Script parses without errors
- **Committed in:** 1f58cf4 (Task 1 commit)

**2. [Rule 1 - Bug] Oracle-compatible float cast in match rate dataset**
- **Found during:** Task 1 (adding ds-recon-match-rate-by-region)
- **Issue:** Plan used `::float / NULLIF(COUNT(*), 0)` Postgres syntax
- **Fix:** Changed to `ROUND((SUM(...) / NULLIF(COUNT(*), 0)) * 100, 2)` using Oracle-compatible ROUND
- **Files modified:** scripts/seed-oracle.py
- **Verification:** Script parses without errors
- **Committed in:** 1f58cf4 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs -- Postgres syntax in Oracle-targeted SQL)
**Impact on plan:** Both fixes necessary for Oracle 19c compatibility. No scope creep.

## Issues Encountered
- Dashboard chart references now point to deleted chart IDs (e.g., chart-txn-status-stacked, chart-breaks-aging-waterfall). This is expected and acceptable per the plan -- Phase 3 will rewrite all dashboard compositions with the new chart IDs.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 45 charts ready for Phase 3 dashboard composition
- 22 datasets provide comprehensive data foundation for all chart types
- KPI expansion (Plan 02) is the next step before dashboard composition

---
*Phase: 02-charts-kpis-library*
*Completed: 2026-04-13*
