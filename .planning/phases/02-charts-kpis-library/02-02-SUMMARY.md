---
phase: 02-charts-kpis-library
plan: 02
subsystem: seed-data
tags: [kpi, seed-oracle, curated-data]
dependency_graph:
  requires: [02-01]
  provides: [kpi-library-18]
  affects: [dashboards, phase-03]
tech_stack:
  added: []
  patterns: [kpi-threshold-config, kpi-trend-config, aggregation-coverage]
key_files:
  created: []
  modified:
    - scripts/seed-oracle.py
decisions:
  - "18 KPIs covering 6 aggregation types and 4 format types (D-08 through D-11)"
  - "2 KPIs with trend=None acceptable (min-daily-volume, currency-count) -- trends meaningless for these metrics"
  - "Dashboard refs mapped from old to new IDs -- histogram/graph chart types replaced with bar/sankey alternatives"
metrics:
  duration: "3m 47s"
  completed: "2026-04-13T07:43:14Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 02 Plan 02: Curated KPIs Library Summary

**One-liner:** 18 production-quality KPIs replacing 12 old ones, covering all 6 aggregation types (SUM/AVG/COUNT/MIN/MAX/COUNT_DISTINCT) with proper thresholds, trends, and format configs, plus dashboard reference migration.

## What Was Done

### Task 1: Delete existing 12 KPIs and create 18 new CURATED_KPIS
Replaced all 12 CURATED_KPIS entries with 18 new production-quality KPI definitions. Each KPI has:
- Valid `dataset_id` referencing an existing dataset in CURATED_DATASETS
- Valid `metric_column` referencing an actual column from that dataset
- Proper `thresholds` with meaningful greenAbove/amberAbove values
- Trend config (16 with previous_period or static_target, 2 with None where trends are meaningless)
- Correct format type matching the metric semantics

**Aggregation coverage (KPI-04):**
| Type | Count | KPIs |
|------|-------|------|
| SUM | 7 | total-transactions, total-usd-volume, total-breaks, open-breaks, break-exposure, sla-breach-count, monthly-volume-growth |
| AVG | 6 | match-rate, avg-aging, sla-breach-rate, avg-confidence, avg-txn-size, region-break-avg |
| COUNT | 1 | auto-match-pct |
| MIN | 1 | min-daily-volume |
| MAX | 1 | largest-txn |
| COUNT_DISTINCT | 2 | unique-counterparties, currency-count |

**Format coverage (KPI-05):**
| Type | Count | KPIs |
|------|-------|------|
| number | 8 | total-transactions, total-breaks, open-breaks, min-daily-volume, unique-counterparties, sla-breach-count, currency-count, monthly-volume-growth |
| currency | 4 | total-usd-volume, break-exposure, largest-txn, avg-txn-size |
| percentage | 3 | match-rate, sla-breach-rate, auto-match-pct |
| decimal | 3 | avg-aging, avg-confidence, region-break-avg |

**Commit:** 2cc775c

### Task 2: Fix dashboard KPI references and update all assertion counts
Updated all 5 CURATED_DASHBOARDS to reference new KPI and chart IDs:

**KPI ID migrations:**
- `kpi-avg-aging-days` -> `kpi-avg-aging` (dash-sla, dash-aging)
- `kpi-high-value-breaks` -> `kpi-break-exposure` (dash-aging, dash-breaks-summary)
- `kpi-total-amount-usd` -> `kpi-total-usd-volume` (dash-volume)
- `kpi-txn-uniques` -> `kpi-unique-counterparties` (dash-breaks-summary)

**Chart ID migrations:**
- 12 chart IDs remapped to new Phase 2 names
- `chart-breaks-histogram` (removed type) replaced with `chart-breaks-usd-by-type`
- `chart-recon-graph` (removed type) replaced with `chart-break-flow-sankey`

**Assertions verified:** datasets=22, charts=45, kpis=18, dashboards=5

**Commit:** ed85df9

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. Full `seed-oracle.py` executes against Oracle (exits 0, all assertions pass)
2. CURATED_KPIS has exactly 18 entries with all 6 aggregation types
3. All dashboard references resolve to valid chart/KPI IDs in CURATED_CHARTS/CURATED_KPIS
4. No old chart/KPI IDs remain in CURATED_DASHBOARDS
5. Every KPI's metric_column validated against its dataset's column list

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 2cc775c | feat(02-02): replace 12 KPIs with 18 production-quality CURATED_KPIS |
| 2 | ed85df9 | fix(02-02): update dashboard KPI and chart references to new IDs |

## Self-Check: PASSED

- scripts/seed-oracle.py: FOUND
- 02-02-SUMMARY.md: FOUND
- Commit 2cc775c: FOUND
- Commit ed85df9: FOUND
