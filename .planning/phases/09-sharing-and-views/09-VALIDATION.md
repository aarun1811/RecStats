---
phase: 9
slug: sharing-and-views
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `09-RESEARCH.md` §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frontend unit framework** | vitest 4.1.2 (verified `frontend/package.json` + `vitest.config.ts`) |
| **Frontend E2E framework** | @playwright/test 1.59.1 (verified `frontend/package.json` + `playwright.config.ts`) |
| **Backend test framework** | pytest via FastAPI TestClient (pattern: `backend/tests/test_managed_*.py`) |
| **Frontend quick run** | `cd frontend && pnpm vitest run <path>` |
| **Frontend full suite** | `cd frontend && pnpm vitest run` |
| **Frontend E2E run** | `cd frontend && npx playwright test --reporter=list` |
| **Backend quick run** | `pytest backend/tests/test_search.py -x` (after Wave 0 creates this) |
| **Backend full suite** | `pytest backend/tests/` |
| **Estimated full suite runtime** | ~90 seconds (vitest ~15s + pytest ~25s + playwright ~50s) |

---

## Sampling Rate

- **After every task commit:** Run quick suite for the touched layer
  - Frontend task → `cd frontend && pnpm vitest run <touched-test-file>`
  - Backend task → `pytest backend/tests/test_search.py -x`
- **After every plan wave:** Run full unit suites + relevant Playwright spec
  - `cd frontend && pnpm vitest run && pytest backend/tests/`
  - Plus the matching `cd frontend && npx playwright test e2e/<spec>.spec.ts`
- **Before `/gsd-verify-work`:** Full vitest + full pytest + full Playwright suite must be green
- **Max feedback latency:** 30 seconds for unit tests, 90 seconds for E2E

---

## Per-Task Verification Map

> Filled in by `gsd-planner` during Step 8. Each task in each PLAN.md must map to at least one row here.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Phase Requirements → Test Coverage Map

Sourced from `09-RESEARCH.md` §"Phase Requirements → Test Map".

### SHAR-02 — URL state sync

| # | Behavior | Test Type | Command |
|---|----------|-----------|---------|
| 1 | Filter parser parses `?filter.region=APAC&filter.product=A,B,C` | unit | `pnpm vitest run src/lib/dashboard-url-state.test.ts` |
| 2 | Filter serializer round-trips Record → URL → parser | unit | `pnpm vitest run src/lib/dashboard-url-state.test.ts` |
| 3 | View route hydrates filter store from URL on mount | integration (component) | `pnpm vitest run src/routes/_app/dashboards/$dashboardId.test.tsx` |
| 4 | View route writes URL on `applied` change with `replace: true` | E2E | `cd frontend && npx playwright test e2e/share-link.spec.ts` |
| 5 | "Copy link" button copies current URL + shows toast | E2E (clipboard perms) | `cd frontend && npx playwright test e2e/share-link.spec.ts` |
| 6 | Stale filter ID silently ignored, known filters apply | unit | `pnpm vitest run src/lib/dashboard-url-state.test.ts` |

### SHAR-03 — Embed mode hardening

| # | Behavior | Test Type | Command |
|---|----------|-----------|---------|
| 7 | Embed route loads dashboard from managed endpoint | integration (mocked fetch) | `pnpm vitest run src/routes/embed/dashboards/$dashboardId.test.tsx` |
| 8 | `?theme=dark` applies dark theme | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` |
| 9 | `?filter.region=APAC` pre-applies filter | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` |
| 10 | `?filter.lock=region` disables filter UI | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` |
| 11 | `?hide=filter-bar` hides filter bar | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` |
| 12 | `?hide=title` hides title in EmbedTopbar | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` |
| 13 | `?hide=toolbar` hides DashboardToolbar (NOT EmbedTopbar) | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` |
| 14 | Cross-filter and drill-down work in embed (D-10) | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` |

### SHAR-04 — Command palette rewrite

| # | Behavior | Test Type | Command |
|---|----------|-----------|---------|
| 15 | `POST /api/search` returns dashboards from managed table | unit | `pytest backend/tests/test_search.py::test_search_dashboards_by_name -x` |
| 16 | `POST /api/search` returns charts from managed_charts | unit | `pytest backend/tests/test_search.py::test_search_charts_by_name -x` |
| 17 | `POST /api/search` returns datasets from managed_datasets | unit | `pytest backend/tests/test_search.py::test_search_datasets_by_name -x` |
| 18 | `POST /api/search` returns KPIs from managed_kpis (NEW) | unit | `pytest backend/tests/test_search.py::test_search_kpis_by_name -x` |
| 19 | `POST /api/search` makes ZERO Superset/HTTP calls | unit (mock httpx) | `pytest backend/tests/test_search.py::test_search_no_superset_calls -x` |
| 20 | Results ordered: prefix → substring → alpha, grouped by type | unit | `pytest backend/tests/test_search.py::test_search_ranking -x` |
| 21 | `types: ['dashboard']` filter narrows results | unit | `pytest backend/tests/test_search.py::test_search_type_filter -x` |
| 22 | Cmd+K palette renders KPI results with Gauge icon → `/kpis/:id/edit` | E2E | `cd frontend && npx playwright test e2e/command-palette.spec.ts` |
| 23 | Chart result navigates to `/charts/:id/edit` (NOT `/dashboards/:id`) | E2E | `cd frontend && npx playwright test e2e/command-palette.spec.ts` |
| 24 | Dataset result navigates to `/datasets/:id/edit` (NOT `/explorer`) | E2E | `cd frontend && npx playwright test e2e/command-palette.spec.ts` |

### Cross-cutting regression (highest priority)

| # | Behavior | Test Type | Command |
|---|----------|-----------|---------|
| 25 | Phase 8 dashboards still load in view route after hook upgrade | E2E (regression) | `cd frontend && npx playwright test e2e/dashboard-view-regression.spec.ts` |
| 26 | Phase 8 dashboards still load in edit route after hook upgrade | E2E (regression) | `cd frontend && npx playwright test e2e/dashboard-edit-regression.spec.ts` |

**Regression class to watch:** Hook upgrade (`useDashboardConfig` → `useManagedDashboard`) is the highest-risk change. Tests #25 and #26 are mandatory before merge.

---

## Wave 0 Requirements

These test files do not exist yet — Wave 0 of the first plan must create them as scaffolding (failing tests OK at Wave 0; they go green as tasks land in subsequent waves).

- [ ] `frontend/src/lib/dashboard-url-state.test.ts` — covers SHAR-02 parser/serializer/round-trip
- [ ] `frontend/src/routes/embed/dashboards/$dashboardId.test.tsx` — embed route hook upgrade
- [ ] `frontend/e2e/share-link.spec.ts` — Playwright E2E for SHAR-02 (URL sync + Copy link)
- [ ] `frontend/e2e/embed.spec.ts` — Playwright E2E for SHAR-03 (theme, filter, lock, hide tokens, interactivity)
- [ ] `frontend/e2e/command-palette.spec.ts` — Playwright E2E for SHAR-04 (KPI, route corrections)
- [ ] `frontend/e2e/dashboard-view-regression.spec.ts` — regression: Phase 8 dashboards still load (view)
- [ ] `frontend/e2e/dashboard-edit-regression.spec.ts` — regression: Phase 8 dashboards still load (edit)
- [ ] `backend/tests/test_search.py` — covers SHAR-04 (4 managed table queries, ranking, type filter, no-Superset assertion)

**Consolidation note:** The view-route URL→store hydration test (originally listed as a separate vitest component test at `frontend/src/routes/_app/dashboards/$dashboardId.test.tsx`) is consolidated into `e2e/share-link.spec.ts` Test 2 (navigates with `?filter.region=APAC` and asserts the filter shows applied on mount) plus the Playwright MCP visual verification in Plan 09-01 Task 5. Rationale: per project memory `feedback_playwright_thoroughness.md` and `feedback_no_mock_shortcuts.md`, real-API Playwright verification is preferred over mock-heavy component tests when both are available. The consolidated test exercises the same URL→store hydration code path with higher fidelity (real renderer, real filter store, real router) than a vitest component test would.

**Playwright clipboard permission setup** (for `share-link.spec.ts`):
```ts
test.use({
  permissions: ['clipboard-read', 'clipboard-write'],
})
```

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual: share popover/toast styling matches Shadcn library | SHAR-02 | Visual aesthetic | Playwright MCP screenshot of `/dashboards/:id` after click |
| Visual: embed mode chrome alignment with dark/light themes | SHAR-03 | Visual aesthetic | Playwright MCP screenshot of `/embed/dashboards/:id?theme=dark` and `?theme=light` |
| Visual: command palette result group spacing/density | SHAR-04 | Visual aesthetic | Playwright MCP screenshot of palette open with results |

All other phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 30s (unit) / < 90s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

*Phase: 09-sharing-and-views*
*Validation strategy created: 2026-04-08*
