---
phase: 10
slug: comprehensive-testing-with-advanced-seed-data
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 10 is unusual: it IS the validation phase. This document covers the validation infra for the test bed work itself (Plan 10-01), not the user UAT (which is the phase output).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (frontend unit)** | Vitest 4.1 (existing) |
| **Framework (frontend E2E)** | Playwright 1.59 (existing) |
| **Framework (backend unit)** | pytest (existing, no config file — default discovery) |
| **Config file (Vitest)** | `frontend/vitest.config.ts` |
| **Config file (Playwright)** | `frontend/playwright.config.ts` |
| **Config file (pytest)** | none — default discovery from `backend/tests/` |
| **Quick run command (frontend unit)** | `cd frontend && pnpm vitest run --reporter=verbose` |
| **Quick run command (frontend E2E)** | `cd frontend && pnpm exec playwright test --reporter=list` |
| **Quick run command (backend)** | `cd backend && python -m pytest tests/ -v` |
| **Full suite command** | `cd frontend && pnpm vitest run && pnpm exec playwright test && cd ../backend && python -m pytest tests/` |
| **Estimated runtime (quick)** | ~60 s (units only across both stacks) |
| **Estimated runtime (full)** | ~300 s (includes Playwright E2E) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run` (frontend) + `python -m pytest backend/tests/` (units only, ~60 s)
- **After every plan wave:** Run the full suite including Playwright E2E (~300 s)
- **Before `/gsd-verify-work`:** Full suite must be green AND `scripts/mock-audit.sh` must exit 0
- **Phase gate (after Plan 10-02):** Autonomous Playwright MCP walkthrough green + full test suite green + grep sweep clean → user takes over for manual UAT (Plan 10-03)
- **Max feedback latency:** 60 s (quick) / 300 s (full)

---

## Per-Task Verification Map

Phase 10 revalidates ALL v1 REQs through 4 layers (seed unit tests → rewritten E2E smoke → autonomous walkthrough → manual UAT). The matrix below maps each requirement to its automated coverage.

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| INFR-04 | No mock/fallback rendering anywhere | Grep sweep + UAT | `scripts/mock-audit.sh` (Wave 0) + Playwright smoke | ❌ Wave 0 |
| INFR-05 | Number formatting | unit | `pnpm vitest run lib/formatters` | ✅ existing |
| INFR-06 | Legacy dead code removed | Grep sweep | `scripts/mock-audit.sh` (same script) | ❌ Wave 0 |
| INTR-01 | Cross-filter activation | e2e | `pnpm exec playwright test dashboard-smoke` | 🔨 rewrite (Plan 10-01) |
| INTR-02 | Cross-filter visual state | e2e | `pnpm exec playwright test dashboard-smoke` | 🔨 rewrite |
| INTR-03 | Drill-down navigation | e2e | `pnpm exec playwright test dashboard-smoke` | 🔨 rewrite |
| INTR-04 | Drill-down detail rows | e2e | `pnpm exec playwright test dashboard-smoke` | 🔨 rewrite |
| INTR-05 | Fullscreen chart | manual UAT | — | ✅ walkthrough item |
| INTR-06 | Chart export (PNG/CSV/clipboard) | unit + UAT | `pnpm vitest run chart-export` + walk | ✅ existing |
| INTR-07 | Grid export | unit + UAT | `pnpm vitest run grid-toolbar` + walk | ✅ existing |
| INTR-08 | Manual refresh | UAT | walk | ✅ walkthrough item |
| INTR-09 | Auto-refresh | unit + UAT | `pnpm vitest run use-auto-refresh` + walk | ✅ existing |
| DSET-01..05 | Dataset CRUD | backend unit + UAT | `pytest backend/tests/test_managed_datasets.py` | ✅ existing |
| CHRT-01..07 | Chart library + types | backend unit + e2e | `pytest backend/tests/test_managed_charts.py` + smoke | ✅ existing |
| KPI-01..03 | KPI library | backend unit + UAT | `pytest backend/tests/test_managed_kpis.py` | ✅ verified exists |
| BLDR-01..08 | Dashboard builder | e2e + UAT | `pnpm exec playwright test dashboard-edit-regression` + walk | 🔨 rewrite |
| SHAR-02 | Shareable URLs | e2e | `pnpm exec playwright test share-link` | 🔨 rewrite |
| SHAR-03 | Embed mode | e2e | `pnpm exec playwright test embed` | 🔨 rewrite |
| SHAR-04 | Command palette | e2e | `pnpm exec playwright test command-palette` | 🔨 rewrite |
| Phase 10 specific | Seed script row counts + KPI bands | backend unit | `pytest backend/tests/test_seed_script.py` | ❌ Wave 0 |
| Phase 10 specific | Dual-row managed dataset/data source pattern (A10 risk) | backend unit | `pytest backend/tests/test_seed_script.py::test_dataset_data_source_pairing` | ❌ Wave 0 |
| Phase 10 specific | All chart types render against curated seed | e2e | `pnpm exec playwright test chart-types` | 🔨 rewrite |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · 🔨 to-be-rewritten*

---

## Wave 0 Requirements

Plan 10-01 must complete ALL Wave 0 items before any production code is touched:

- [ ] **`scripts/mock-audit.sh`** — bash script encapsulating the grep sweep from RESEARCH.md §3.9. Exit 0 = clean, nonzero = offenders found. Re-runnable locally and in Plan 10-02 post-fix verification. Patterns include: `CHART_DATASOURCE_MAP`, `CHART_QUERIES`, hardcoded dataset IDs in `backend/app/api/charts.py` and `backend/app/api/custom.py`, dead frontend hooks (`use-{chart,kpi,breaks}-data.ts`, `use-prefetch.ts`), `frontend/src/types/index.ts` barrel export, `Lorem`, `placeholder`, `TODO: replace with real`, `mock` in production code paths, `pending` returns from non-coming-soon endpoints.
- [ ] **`frontend/e2e/_fixtures.ts`** — shared E2E fixture file with `CURATED_DASHBOARDS` map (`dash-sla` / `dash-aging` / `dash-match-rate` / `dash-volume` / `dash-breaks-summary`), `CURATED_CHARTS` lookup, `CURATED_DATASETS` lookup, and the shared `waitForDashboardLoad(page)` helper. All rewritten specs import from this single file. Eliminates duplicated dashboard slugs across the 7 spec files.
- [ ] **`backend/tests/test_seed_script.py`** — new test file that imports the rewritten seed script as a module and unit-tests its row-generation helpers. Required tests:
  - `test_recon_transactions_row_count_is_100k` — exact count
  - `test_recon_breaks_row_count_in_range` — ~20k ± 5%
  - `test_recon_match_events_row_count_in_range` — ~80k ± 5%
  - `test_sla_events_row_count_in_range` — ~5k ± 5%
  - `test_dimension_table_cardinalities` — engines/regions/desks/currencies/statuses/aging_buckets at expected sizes
  - `test_high_cardinality_dimension_has_10k_plus_uniques` — `recon_transactions.external_ref` (or chosen column)
  - `test_nulls_present_in_measure_columns` — at least one row per fact table has NULL in a designated measure
  - `test_nulls_present_in_dimension_columns` — at least one row per fact table has NULL in a designated dimension
  - `test_date_range_spans_two_years` — min/max dates ≥730 days apart
  - `test_leap_day_record_present` — at least one row with `2024-02-29`
  - `test_dst_record_present` — at least one row in the DST switch hour
  - `test_year_boundary_records_present` — rows on `12-31` and `01-01` of consecutive years
  - **`test_dataset_data_source_pairing`** — for every row in `recviz_datasets`, a matching `recviz_data_sources` row exists with the same `id` and consistent column metadata. **This is the A10 dual-row architectural pattern guard — the #1 structural risk in the seed.**
  - `test_kpi_thresholds_seed_into_correct_bands` — for each curated KPI, the seed produces a baseline value that lands in the intended threshold band (green/amber/red)
  - `test_seed_is_deterministic` — running the seed twice with `random.seed(42)` produces byte-identical inserts
  - May require a small refactor of `scripts/seed-postgres.py` to expose generator functions without calling `main()` at import time.
- [x] **Verify `backend/tests/test_managed_kpis.py` exists** — confirmed (Phase 7 shipped this).

---

## Manual-Only Verifications

Phase 10's primary deliverable is a manual UAT runbook. The items below are intentionally manual — they cannot be expressed as automated assertions because they involve user judgment, visual inspection, or end-to-end happy-path narrative.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual chart rendering quality | CHRT-01..07 | Visual judgment of color, spacing, label legibility | UAT runbook §Phase 6 — visit each curated chart in `/charts/:id/edit`, confirm preview looks right |
| Dashboard layout polish | BLDR-02 | Visual judgment of spacing, alignment, density | UAT runbook §Phase 8 — open every curated dashboard, confirm grid layout looks clean |
| Cross-filter visual feedback | INTR-02 | Visual judgment of dimming opacity and selection bar feel | UAT runbook §Phase 2 — trigger cross-filter, confirm dimming looks right |
| KPI threshold color polish | KPI-03 | Visual judgment of green/amber/red shade and contrast | UAT runbook §Phase 7 — visit dashboards, confirm threshold colors render correctly |
| Animated counter feel | KPI-03 | Subjective animation quality | UAT runbook §Phase 7 — load dashboard, watch counter roll-up |
| Share-link recipient experience | SHAR-02 | End-to-end happy path with copy-paste-open flow | UAT runbook §Phase 9 — share button, copy URL, open in incognito, confirm filters land |
| Embed mode visual integration | SHAR-03 | Visual judgment in iframe context | UAT runbook §Phase 9 — embed dashboard in test HTML page, confirm chrome looks right |
| Cmd+K palette feel | SHAR-04 | Subjective responsiveness and result ordering | UAT runbook §Phase 9 — open palette, type queries, confirm results are useful |
| Number formatting polish | INFR-05 | Visual judgment of locale + precision | UAT runbook §Phase 1 — visit every KPI, confirm currency/percentage/number formats look right |
| Dark/light mode parity | INFR-04 | Visual judgment | UAT runbook §Phase 1 — toggle theme on each curated dashboard, confirm both modes look right |
| Mock/fallback audit (visual leg) | INFR-04 | Catches mocks that pass automated audit but render fabricated data | UAT runbook §Mock Audit — every screen, watch for fake-looking data |
| Phase 10 final walkthrough | All v1 reqs | The whole point of the phase | User walks `10-UAT-RUNBOOK.md` end-to-end after Claude declares ready |

---

## Validation Sign-Off

- [ ] All tasks in Plan 10-01 have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (mock-audit.sh, _fixtures.ts, test_seed_script.py)
- [ ] No watch-mode flags in any test command
- [ ] Feedback latency < 300 s for full suite
- [ ] Plan 10-02 walkthrough acceptance criteria documented (10 per-dashboard checks per RESEARCH.md §7)
- [ ] Plan 10-03 UAT handoff criteria documented (smoke green + audit clean + perf observations recorded)
- [ ] `nyquist_compliant: true` set in frontmatter once Plan 10-01 Wave 0 is in place

**Approval:** pending
