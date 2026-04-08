# Phase 10 — Closeout Notes

**Closed:** 2026-04-08
**Status:** User-marked complete
**Closed by:** User direct request after walking dash-aging + dash-match-rate visually

---

## What shipped

### Plan 10-01 (test bed) — COMPLETE

| Sub-plan | Commit | Deliverable |
|---|---|---|
| 10-01a | `ee477ce`, `1c39b15`, `62160ac` | Wave 0 infra (mock-audit.sh, _fixtures.ts, test_seed_script.py scaffold) + mock cleanup (4 dead hooks + types barrel + RoH fix in ag-chart-wrapper + 2 legacy backend routers + 2 legacy JSON configs) |
| 10-01b | `8308f0d`, `5d09c36`, `a8f72ee` | scripts/seed-postgres.py rewritten end-to-end. Schema (8 dims + 4 facts at 100k tier), 16 datasets, 22 charts (covering all 18 working chart types), 12 KPIs (with 3 inverted thresholds), 5 dashboards. A10 dual-row pairing guard enforced. 18/18 seed tests pass. |
| 10-01c | `9fc7ce0`, `d1194bd`, `6be6cbb` | 6 E2E specs rewritten against curated catalog, tlm-stats deleted, 716-line UAT runbook draft, full-stack verification gate green |

### Decimal sub-phases (in-flight fixes during Plan 10-02 preflight)

| Sub-phase | Commit | Fix |
|---|---|---|
| **10.1** | `267ffb7` | Delete legacy dashboard backend (`api/dashboards.py`, `models/dashboard_config.py`, narrow `services/config_store.py`) + delete dead frontend hooks (`use-dashboards.ts`, `use-dashboard-config.ts`) + rewrite `useDashboardKpis` to compute client-side from `/api/data-sources/:id/query` instead of the legacy 500ing route. Two parallel dashboard systems collapsed into one. |
| **10.2** | `1597f13` | Sidebar wrapper `min-h-svh` → `h-svh` + SidebarInset `min-h-0`. Inner `overflow-auto` becomes a real scroll container; sticky-header layout works as intended. Fixes "can't scroll to bottom of dashboard" reported on dash-aging. |
| **10.3** | `b4c9a47` | Add `WHERE 1=1` to all 14 SQL templates in seed. Query engine generates `AND <expr>` per filter clause; templates with no preceding WHERE produced invalid SQL when filters were applied. Fixes 500s on dash-match-rate (and any dashboard with filters applied). |
| **10.4** | `c2e402a` | Builder edit page — 0-index all 25 `_layout()` call sites (was 1-indexed, RGL is 0-indexed) + replace hardcoded KPI `{col: 0, row: 0}` collision in `builder-store.ts` with horizontal KPI strip + shift charts/grids down by KPI row count. Fixes "everything is all over the place on edit page". |
| **10.5** | `e827214` | Chart panel heights in builder — `_layout()` default height 1 → 3 (~240px panel) + scale all row positions by 3 + bump grid height to 4. Fixes "chart panels are tiny slivers in edit mode". |
| **chore** | `15dd6ce` | Disable worktree isolation for executors per `feedback_worktree_isolation` memory. |

---

## What was VERIFIED visually

- ✅ `dash-aging` view route — loads, scrolls to bottom, all charts render real data, Break Flow sankey at the bottom is reachable
- ✅ `dash-match-rate` view route — loads with `?filter.date_range_days="730"`, charts render real data (Match Type Funnel, Volume & Amount Combo line series, Transaction Volume — Daily)
- ✅ `dash-aging` edit route — KPIs in horizontal row at top, charts in clean rows below, panels at proper height
- ✅ `dash-match-rate` edit route — KPIs in horizontal row at top, Transaction Volume — Daily full width, Match Type Funnel + Match Status side by side, Volume & Amount Combo below
- ✅ `mock-audit.sh` clean
- ✅ 247/247 frontend vitest pass
- ✅ 18/18 backend test_seed_script.py pass
- ✅ Live data flowing: API → Postgres seed → Superset query engine → backend → frontend
- ✅ A10 dual-row pairing guard enforced (psql verified 0 unpaired rows)
- ✅ Dashboard names cross-check (`_fixtures.ts DASHBOARD_NAMES` ↔ `recviz_dashboards.name`)
- ✅ Clean-slate replace: 0 legacy `chart-showcase` / `tlm-stats` references, all curated entities use `Phase 10 ·` prefix

---

## What was NOT done — explicitly deferred

### Plans not executed
- **Plan 10-02** (autonomous Playwright MCP walkthrough — 57 checkpoints) — never started. Pre-flight discovery uncovered enough bugs (10.1 → 10.5) that the user moved to a different testing rhythm: walk-and-fix-as-found instead of the formal 57-checkpoint enumeration.
- **Plan 10-03** (UAT runbook finalization + handoff) — never started. The runbook draft from 10-01c (`10-UAT-RUNBOOK.md`, 716 lines) exists but was not walked through by the user. Plan 10-03 is the prerequisite for the formal "UAT PASS" sign-off in `must_haves.truths`.

### Dashboards not visually verified
- `dash-sla` (SLA Overview)
- `dash-volume` (Volume Dashboard)
- `dash-breaks-summary` (Breaks Summary)

These exist in the seed and should work given the fixes that landed for dash-aging + dash-match-rate, but they were not walked.

### Known visual bugs caught but NOT fixed
- **Donut chart `chart-txn-status-donut` (Match Status)** — empty render. AG Charts warning: `invalid value of type [string] for [DonutSeries / angleRaw] ignored: [Matched]`. The donut is being passed `status` (string column) as the angle key instead of `txn_count` (numeric). Fix is in the seed's `chart-txn-status-donut` columnMapping — swap categoryColumn and the metric column to put a number in the angle slot.
- **Combo chart `chart-txn-combo` (Volume & Amount Combo)** — only the line series renders, the bar series is missing. Likely a column-mapping issue in the seed similar to the donut.
- **Builder previews show "No data available" in some chart cards** — `BuilderPanelContent.useDatasetPreview` calls `/api/sql/execute` directly with the dataset's `sql` field. The seed strips `{{filters}}` from the managed_sql shape but the `WHERE 1=1` remnant SHOULD still produce valid SQL. Verify whether the issue is the `databaseId` resolution (managed_dataset returns `databaseId: 1` but Superset may have a different internal id after re-sync).
- **AG Charts license noise** in console — cosmetic, not blocking.

### Deferred since before Phase 10 (still deferred)
- 4 pre-existing broken backend test files (`test_config_store.py`, `test_query_engine.py`, `test_dataset_sync.py`, plus 1 failing assertion) — documented in `deferred-items.md`. Same state as before Phase 10.
- 41 pre-existing TypeScript errors in `tsconfig.app.json` — unchanged baseline.
- SHAR-01 Saved Views, DATA-03 Elasticsearch — deferred per PROJECT.md.
- Reports / Export endpoints — "Coming Soon" empty states, intentional.

### Phase 11 territory (per CONTEXT.md D-02)
- 1M row scaling
- 10M row scaling
- Performance budgets / timing assertions
- Backend load / concurrency testing

---

## Honest assessment

Phase 10's stated done criteria from `10-CONTEXT.md` D-15 was:
1. Every UAT runbook checkbox ticked by the user ❌ (runbook not walked)
2. Playwright MCP smoke pass walks all 4–5 dashboards green ⚠️ (only 2 of 5 walked manually)
3. Zero mock/fallback paths render anywhere in the frontend ✅ (mock-audit.sh clean)
4. All P0/P1 findings fixed ✅ (5 P0/P1 bugs fixed via decimal sub-phases)
5. P2/P3 deferrable ⚠️ (donut/combo bugs are P1 visual issues that remain open)

**Strict interpretation:** Phase 10 is not complete by its own gates.
**Pragmatic interpretation:** The seed is solid, the legacy/managed sprawl is gone, the SQL pipeline works end-to-end with filters, the builder edit page works, two of the five dashboards are visually verified. The remaining items are catalogued and tractable.

User explicitly asked to mark Phase 10 + milestone complete despite the open items. Honoring the request because:
- The user owns the project and the call
- The remaining items are documented and tractable
- The session context budget is depleted (~83% used)
- A handoff note is more valuable than half-finishing one more bug

---

## Next-session priorities

If resumed in a future session (under a different milestone or as Phase 11):

1. **Donut + Combo column mapping bugs** — single seed config edits each
2. **Walk dash-sla, dash-volume, dash-breaks-summary** via Playwright MCP
3. **Builder preview "No data available"** — investigate `useDatasetPreview` databaseId resolution
4. **AG Charts license** — apply trial key or accept watermark
5. **Plan 10-02 / 10-03 formal walkthrough** — if a structured UAT pass is wanted
6. **Phase 11**: 1M / 10M tier scaling
