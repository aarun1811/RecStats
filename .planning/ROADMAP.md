# Roadmap: RecViz — Production Demo Seed

## Milestones

- [x] **v1.0 Oracle-Only Cutover + Frontend Colorization** - Phases 01-08 (shipped 2026-04-13)
- [ ] **v2.0 Production Demo Seed** - Phases 1-3 (in progress)

## Overview

Rewrite the seed script with production-quality demo data for stakeholder demos. Phase 1 builds the seed script infrastructure (CLI args, dimension tables, fact generation with realistic distributions, no `recviz_data_sources` writes). Phase 2 populates the chart and KPI libraries (40-50 charts across all supported types, 15-20 KPIs with proper thresholds/trends/formats, all configs validated against the builder schema). Phase 3 composes everything into 10+ story-driven dashboards with filters, cross-filters, and drill-down, then verifies the entire pipeline end-to-end in the browser.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Seed Script Infrastructure** - CLI args, dimension tables, fact generation with realistic distributions, no recviz_data_sources writes
- [ ] **Phase 2: Charts + KPIs Library** - 40-50 charts, 15-20 KPIs, all configs validated against builder schema
- [ ] **Phase 3: Dashboards + Verification** - 10+ story dashboards with filters/cross-filter/drill-down, E2E verification

## Phase Details

### Phase 1: Seed Script Infrastructure
**Goal**: Seed script generates rich, realistic reconciliation data into Oracle with configurable scale, configurable DB connection, and zero writes to recviz_data_sources.
**Depends on**: Nothing (first phase)
**Requirements**: SEED-01, SEED-02, SEED-03, SEED-04, SEED-05, SEED-06, SEED-07, SEED-08
**Success Criteria** (what must be TRUE):
  1. User can run the seed script with `--rows 100000` and see progress output with per-table row counts and total elapsed time printed to stdout
  2. User can specify `--host`, `--port`, `--service`, `--user`, `--password` CLI args to target any Oracle instance — no hardcoded credentials exist in the script
  3. After seeding, `recviz_data_sources` has zero rows written by the seed script, while `recviz_datasets` and `recviz_connections` contain the seeded records with non-NULL `schema_name` on every connection row
  4. Dimension tables contain rich data: 8+ regions, 25+ desks, 50+ counterparties, 12+ currencies, 8+ SLA types, 6+ match types, 6+ aging buckets, 20+ accounts
  5. Fact table data exhibits realistic distributions — top 20% counterparties hold ~80% of volume, seasonal patterns on volumes, clustered breaks by region/desk, time-decaying aging
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

---

### Phase 2: Charts + KPIs Library
**Goal**: A library of 40-50 production-quality charts and 15-20 KPIs exists in the database, each with builder-validated configs that render without errors.
**Depends on**: Phase 1
**Requirements**: CHRT-01, CHRT-02, CHRT-03, CHRT-04, CHRT-05, KPI-01, KPI-02, KPI-03, KPI-04, KPI-05
**Success Criteria** (what must be TRUE):
  1. User can open the Charts list page and see 40-50 charts with meaningful names and descriptions spanning all supported chart types (line, bar, area, pie, donut, scatter, heatmap, treemap, waterfall, combo, stacked-bar, sankey, radar, gauge, funnel, parallel-coords)
  2. User can open any seeded chart in the builder and it loads without error — columnMapping references real dataset columns, typeSpecific config is valid for the chart type
  3. User can open the KPIs list page and see 15-20 KPIs with correct threshold colors (green/amber/red), trend indicators, diverse aggregation types (SUM, AVG, COUNT, MIN, MAX, COUNT_DISTINCT), and proper format configs (percentage for rates, currency for amounts, number for counts)
  4. Charts cover diverse analytical use cases — time series trends, category comparisons, distributions, part-to-whole, correlations, geographic breakdowns, flow analysis — with no duplicate or placeholder entries
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

---

### Phase 3: Dashboards + Verification
**Goal**: 10+ story-driven dashboards compose the seeded charts and KPIs into coherent analytical narratives, with filters, cross-filters, and drill-down working end-to-end against Oracle.
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08, DASH-09, DASH-10, VERIF-01, VERIF-02, VERIF-03, VERIF-04, VERIF-05, VERIF-06, VERIF-07
**Success Criteria** (what must be TRUE):
  1. User can open the Dashboards list and see 10+ dashboards with descriptive names and themes (Executive Summary, SLA Health, Break Analysis, Match Performance, Volume Trends, Regional Breakdown, Counterparty Risk, Currency Exposure, Desk Performance, Operational Detail), each rendering 3-8 chart panels and 2-4 KPI cards with real data from Oracle
  2. User can apply global filters (Region, Status, Currency, Date Range) on configured dashboards and charts update; cross-filter clicks on bar/pie/heatmap charts filter other panels; drill-down navigates through hierarchies (Region to Desk to Account, Status to Detail)
  3. User can open any dashboard in builder edit mode and see all panels correctly positioned — no overlapping, no infinite loading, no stale chart references (all chart/KPI IDs match actual seeded records)
  4. Seed completes at 100K rows (default) in under 2 minutes and at 1M rows (demo) without OOM or timeout
  5. Every chart renders with data, every KPI shows a computed value with correct threshold color, and no console errors appear (except AG license warnings)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

---

<details>
<summary>v1.0 Oracle-Only Cutover + Frontend Colorization (Phases 01-08) - SHIPPED 2026-04-13</summary>

### Phase 01: Infrastructure Cutover
**Goal**: Oracle 19c wiring, async/PG/Docker/Superset/Redis residue removed, global shadcn palette + chart theme rewired
**Plans**: 6/6 complete

Plans:
- [x] 01-01-PLAN.md — Backend config + deps + types
- [x] 01-02-PLAN.md — Backend engine + main.py + services
- [x] 01-03-PLAN.md — Alembic migration
- [x] 01-04-PLAN.md — Frontend palette + chart themes
- [x] 01-05-PLAN.md — Residue removal + CLAUDE.md verification
- [x] 01-06-PLAN.md — Boot validation + USAGE-TRACKER init

### Phase 02: Settings Page
**Goal**: Colorize Settings page, verify Data Sources CRUD end-to-end against Oracle
**Plans**: 3/3 complete

Plans:
- [x] 02-01-PLAN.md — Appearance tab: display-store, theme preview cards, layout + tab animations
- [x] 02-02-PLAN.md — Data source enhancements: AnimatedStatusBadge, ConnectionTestArea, sheet animations
- [x] 02-03-PLAN.md — E2E verification against Oracle + USAGE-TRACKER update

### Phase 03: Datasets Page
**Goal**: Colorize Datasets page, verify dataset CRUD and SQL execution against Oracle
**Plans**: 3/3 complete

Plans:
- [x] 03-01-PLAN.md — Style constants extraction + list page enhancements
- [x] 03-02-PLAN.md — Editor enhancements
- [x] 03-03-PLAN.md — CRUD + SQL verification against Oracle

### Phase 04: Charts Page
**Goal**: Colorize Charts page, verify AG Charts + ECharts rendering with new palette
**Plans**: 4/4 complete

Plans:
- [x] 04-01-PLAN.md — Style constants + CSS tokens + hex migration + chart config audit
- [x] 04-02-PLAN.md — List page colorization + animations + ECharts thumbnails + detail panel
- [x] 04-03-PLAN.md — Builder wizard polish + appearance expansion + tooltips + help sheet
- [x] 04-04-PLAN.md — Stored config hex audit + console error triage + USAGE-TRACKER

### Phase 05: KPIs Page
**Goal**: Colorize KPIs page, verify KPI CRUD and animated counter rendering
**Plans**: 3/3 complete

Plans:
- [x] 05-01-PLAN.md — Style constants + list page motion
- [x] 05-02-PLAN.md — Builder accordion motion + detail panel threshold accent
- [x] 05-03-PLAN.md — Playwright MCP verification + USAGE-TRACKER update

### Phase 06: Dashboards Page
**Goal**: Colorize dashboards, fix recviz_data_sources renderer gap, delete legacy dead code, verify end-to-end
**Plans**: 5/5 complete

Plans:
- [x] 06-01-PLAN.md — Backend pipeline fix
- [x] 06-02-PLAN.md — List page polish
- [x] 06-03-PLAN.md — Renderer premium treatment
- [x] 06-04-PLAN.md — Builder polish + legacy audit
- [x] 06-05-PLAN.md — E2E verification + embed route + USAGE-TRACKER update

### Phase 07: Explorer Page
**Goal**: Colorize Explorer, migrate AG Grid to Theming API, verify SQL execution via sync oracledb
**Plans**: 2/2 complete

Plans:
- [x] 07-01-PLAN.md — AG Grid Theming API migration + seed fix + dead code deletion + polish
- [x] 07-02-PLAN.md — Playwright MCP verification + USAGE-TRACKER update

### Phase 08: Alembic Audit + Dead Code Sweep + Memory Cleanup
**Goal**: Final milestone consolidation — Alembic audit, dead code sweep, requirements prune, memory cleanup, smoke test
**Plans**: 2/2 complete

Plans:
- [x] 08-01-PLAN.md — Backend cleanup: Alembic audit, PortableJSON removal, dead code sweep, requirements prune
- [x] 08-02-PLAN.md — Memory cleanup + milestone-end smoke test

</details>

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Seed Script Infrastructure | 0/? | Not started | - |
| 2. Charts + KPIs Library | 0/? | Not started | - |
| 3. Dashboards + Verification | 0/? | Not started | - |

---
*Roadmap created: 2026-04-13*
