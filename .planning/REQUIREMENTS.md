# Requirements: RecViz — Production Demo Seed

**Defined:** 2026-04-13
**Core Value:** Stakeholders can experience the full RecViz platform through a rich, realistic demo with 10+ dashboards, 40-50 charts, and configurable data volumes.

## v2.0 Requirements (this milestone)

### Seed Script Infrastructure (Phase 1)

- [ ] **SEED-01**: Seed script accepts `--rows N` CLI arg to control fact table row count (default 100K, demo 1M-5M, stress 10M)
- [ ] **SEED-02**: Seed script accepts `--host`, `--port`, `--service`, `--user`, `--password` CLI args for DB connection (no hardcoded credentials)
- [ ] **SEED-03**: Seed script stops writing to `recviz_data_sources` table entirely — only writes to `recviz_datasets` + `recviz_connections`
- [ ] **SEED-04**: Dimension tables are rich: 8+ regions, 25+ desks, 50+ counterparties, 12+ currencies, 8+ SLA types, 6+ match types, 6+ aging buckets, 20+ accounts
- [ ] **SEED-05**: Fact table data uses realistic distributions — Pareto on counterparties (80/20), seasonal patterns on volumes, clustered breaks by region/desk, time-decaying aging
- [ ] **SEED-06**: Seed script is idempotent — safe to re-run (DELETE + INSERT pattern preserved)
- [ ] **SEED-07**: Seed script prints progress with row counts per table and total time elapsed
- [ ] **SEED-08**: All seeded `recviz_connections` rows have `schema_name` set (not NULL)

### Charts Library (Phase 2)

- [ ] **CHRT-01**: 40-50 charts seeded across all supported AG Charts types (line, bar, area, pie, donut, scatter, heatmap, treemap, waterfall, combo, stacked-bar) and ECharts types (sankey, radar, gauge, funnel, parallel-coords)
- [ ] **CHRT-02**: Every chart config matches the builder schema exactly — `columnMapping` has valid `categoryColumn` + `metricColumns` referencing actual dataset columns
- [ ] **CHRT-03**: Charts cover diverse use cases: time series trends, category comparisons, distributions, part-to-whole, correlations, geographic breakdowns, flow analysis
- [ ] **CHRT-04**: Each chart has a meaningful name and description (not "Chart 1", "Test Chart")
- [ ] **CHRT-05**: Chart `typeSpecific` config (heatmap colorRange, gauge min/max, treemap colorKey, etc.) is properly set for chart types that need it

### KPI Library (Phase 2)

- [ ] **KPI-01**: 15-20 KPIs seeded covering key recon metrics: transaction volume, break count, match rate, SLA breach rate, aging, high-value exposure, counterparty concentration
- [ ] **KPI-02**: Every KPI has proper `threshold` config (green/amber/red levels that make sense for the metric)
- [ ] **KPI-03**: Every KPI has proper `trend` config (vs previous period or static target)
- [ ] **KPI-04**: KPI `aggregation` types are diverse (SUM, AVG, COUNT, MIN, MAX, COUNT_DISTINCT all represented)
- [ ] **KPI-05**: KPI `format` configs are correct (percentage for rates, currency for amounts, number for counts, decimal for scores)

### Dashboards (Phase 3)

- [x] **DASH-01**: 10+ dashboards seeded with story-driven themes: Executive Summary, SLA Health, Break Analysis, Match Performance, Volume Trends, Regional Breakdown, Counterparty Risk, Currency Exposure, Desk Performance, Operational Detail
- [x] **DASH-02**: Each dashboard has 3-8 chart panels with proper layout (no overlapping, logical visual flow)
- [x] **DASH-03**: Each dashboard has relevant KPI cards (2-4 KPIs per dashboard matching the dashboard theme)
- [x] **DASH-04**: Dashboards with filter-worthy data have global filters configured (Region, Status, Currency, Date Range as appropriate)
- [x] **DASH-05**: Cross-filter is enabled on charts where click-to-filter makes sense (bar charts, pie charts, heatmaps)
- [x] **DASH-06**: Drill-down hierarchies are configured on at least 5 charts across dashboards (Region → Desk → Account, Status → Detail, etc.)
- [x] **DASH-07**: At least 2 dashboards have data grid panels showing transaction-level detail
- [x] **DASH-08**: Dashboard chart references use the actual seeded chart IDs — no UUID drift, no stale references
- [x] **DASH-09**: All dashboard configs validate against the frontend `DashboardConfig` type shape
- [x] **DASH-10**: Each dashboard has a descriptive name and description explaining what story it tells

### Verification (Phase 3)

- [ ] **VERIF-01**: After seeding, every dashboard renders in the browser with real data — no 404s, no empty charts, no console errors (except AG license warnings)
- [ ] **VERIF-02**: Every chart in the chart library renders with data from its dataset
- [ ] **VERIF-03**: Every KPI in the KPI library shows a computed value with correct threshold color
- [ ] **VERIF-04**: Dashboard builder edit mode shows all panels correctly (no infinite loading)
- [ ] **VERIF-05**: Global filters, cross-filters, and drill-down all function on configured dashboards
- [ ] **VERIF-06**: Seed runs successfully at 100K rows (default) in under 2 minutes
- [ ] **VERIF-07**: Seed runs successfully at 1M rows (demo) without OOM or timeout

## v3.0 Requirements (deferred)

### Automated Testing
- **TEST-01**: Frontend unit tests (Vitest) for components
- **TEST-02**: Frontend E2E tests (Playwright) for critical user paths
- **TEST-03**: Backend unit tests for services + API routes
- **TEST-04**: Backend integration tests against real Oracle

### Authentication
- **AUTH-01**: SSO/SAML/OIDC integration
- **AUTH-02**: Session management
- **AUTH-03**: Role-based access control
- **AUTH-04**: Audit logging

## Out of Scope

| Feature | Reason |
|---------|--------|
| New UI features or pages | This milestone is seed data only — no frontend code changes |
| Schema changes or migrations | Existing tables are sufficient for demo data |
| Backend API changes | Seed script writes directly to Oracle, no API changes needed |
| Automated tests | Deferred to v3.0 |
| Authentication | Deferred to v3.0 |
| Reports page | Still all mock data, not addressed this milestone |
| recviz_data_sources table DROP | Table is ignored (not read or written) but not dropped — future migration |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEED-01 | Phase 1 | Pending |
| SEED-02 | Phase 1 | Pending |
| SEED-03 | Phase 1 | Pending |
| SEED-04 | Phase 1 | Pending |
| SEED-05 | Phase 1 | Pending |
| SEED-06 | Phase 1 | Pending |
| SEED-07 | Phase 1 | Pending |
| SEED-08 | Phase 1 | Pending |
| CHRT-01 | Phase 2 | Pending |
| CHRT-02 | Phase 2 | Pending |
| CHRT-03 | Phase 2 | Pending |
| CHRT-04 | Phase 2 | Pending |
| CHRT-05 | Phase 2 | Pending |
| KPI-01 | Phase 2 | Pending |
| KPI-02 | Phase 2 | Pending |
| KPI-03 | Phase 2 | Pending |
| KPI-04 | Phase 2 | Pending |
| KPI-05 | Phase 2 | Pending |
| DASH-01 | Phase 3 | Complete |
| DASH-02 | Phase 3 | Complete |
| DASH-03 | Phase 3 | Complete |
| DASH-04 | Phase 3 | Complete |
| DASH-05 | Phase 3 | Complete |
| DASH-06 | Phase 3 | Complete |
| DASH-07 | Phase 3 | Complete |
| DASH-08 | Phase 3 | Complete |
| DASH-09 | Phase 3 | Complete |
| DASH-10 | Phase 3 | Complete |
| VERIF-01 | Phase 3 | Pending |
| VERIF-02 | Phase 3 | Pending |
| VERIF-03 | Phase 3 | Pending |
| VERIF-04 | Phase 3 | Pending |
| VERIF-05 | Phase 3 | Pending |
| VERIF-06 | Phase 3 | Pending |
| VERIF-07 | Phase 3 | Pending |

**Coverage:**
- v2.0 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-13*
