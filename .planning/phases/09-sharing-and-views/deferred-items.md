# Phase 09 — Deferred Items

Items discovered during execution that are out-of-scope for Phase 9 plans. Recorded
per execute-plan workflow scope-boundary rule.

## Pre-existing failures (not introduced by Phase 9)

### tlm-stats-regression.spec.ts — strict-mode locator violation

- **File:** `frontend/e2e/tlm-stats-regression.spec.ts`
- **Failure:** `locator('text=TLM Instance')` resolves to 3 elements (page description "Reconciliation statistics for TLM instances", filter label, and select-value combobox).
- **Status:** Failing on commit `da908f5` (Phase 9 Task 4) AND on the prior commit. NOT a Phase 9 regression.
- **Root cause:** The test pre-dates several UI additions to the dashboard view. The text locator was too broad from day one and only worked accidentally because some of the matching elements weren't rendered yet. After Phases 5-8 added the dashboard description paragraph, the locator now matches multiple elements and Playwright's strict mode fires.
- **Fix (deferred):** Tighten the locator to a role-based one, e.g. `page.getByRole('combobox', { name: 'TLM Instance' })` or use `.first()`. This is a 2-line change but is unrelated to Phase 9 plan 09-01.
- **Suggested home:** Phase 10 (testing pass) or a small Quick fix.

### useDashboardKpis fires for dashboards with zero KPIs (404 noise)

- **File:** `frontend/src/hooks/use-dashboard-kpis.ts`
- **Symptom:** Any dashboard with `config.kpis = []` still fires `POST /api/dashboards/{id}/kpis` on mount. The legacy dashboards router does not recognize managed dashboard IDs on this path and returns 404, which surfaces as a console error ("Failed to load resource"). Observed during Plan 09-02 Task 5 E2E baseline test.
- **Status:** Pre-existing gap, same behavior on view route and embed route. NOT introduced by Plan 09-02. Same behavior on the 09-01 baseline commit.
- **Workaround applied in 09-02:** The `embed.spec.ts` baseline test filters out "Failed to load resource" and "/kpis" console errors so the plan-scope assertion still passes. Direct regression signals (title visible, "Dashboard not found" absent) are unchanged.
- **Fix (deferred):** Add `config.kpis.length > 0` to the `enabled` gate in `use-dashboard-kpis.ts`, OR mount the managed KPI endpoint on the legacy path so the 404 resolves to an empty response, OR migrate the hook to a managed-table endpoint. Smallest fix is the first option — roughly a 2-line change.
- **Suggested home:** Phase 10 (testing pass) or a small Quick fix alongside the tlm-stats locator fix.
