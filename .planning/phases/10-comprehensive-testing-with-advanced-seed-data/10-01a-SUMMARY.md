---
phase: 10-comprehensive-testing-with-advanced-seed-data
plan: 01a
subsystem: testing
tags: [vitest, playwright, pytest, grep-audit, rules-of-hooks, ag-charts, mock-cleanup]

# Dependency graph
requires:
  - phase: 01-foundation-hardening
    provides: INFR-04 mock cleanup baseline (now re-enforced)
  - phase: 06-chart-library
    provides: ag-chart-wrapper.tsx (RoH target)
  - phase: 09-sharing-and-views
    provides: _fixtures.ts companion patterns in existing e2e specs
provides:
  - Wave 0 test harness (mock-audit.sh, _fixtures.ts, test_seed_script.py scaffold)
  - Canonical DASHBOARD_NAMES constant (M-3 cross-check anchor)
  - A10 dual-row pairing guard test scaffold (test_dataset_data_source_pairing)
  - Mock-cleanup baseline — zero offenders detected
  - Rules-of-Hooks guard for AgChartWrapper with 5 render tests
  - Cleaned legacy backend routers and legacy JSON configs
affects: [10-01b, 10-01c, 10-02, 10-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grep-sweep mock audit as the first CI gate (scripts/mock-audit.sh)"
    - "Shared E2E fixture module with canonical name map for cross-check with seed"
    - "Dual-file test split: .test.ts for pure unit tests (node), .test.tsx for render tests (jsdom)"
    - "Seed module loading via importlib.util.spec_from_file_location (dash in filename bypass)"

key-files:
  created:
    - scripts/mock-audit.sh (116 lines)
    - frontend/e2e/_fixtures.ts (313 lines)
    - backend/tests/test_seed_script.py (284 lines, 16 skipped tests)
    - frontend/src/components/charts/ag-chart-wrapper.rules-of-hooks.test.tsx (161 lines, 5 tests)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/deferred-items.md
  modified:
    - frontend/src/components/charts/ag-chart-wrapper.tsx (RoH fix — hoisted containerRef/containerSize/useEffect/sizedOptions above early returns)
    - backend/app/api/router.py (removed charts + custom imports and include_router calls)
  deleted:
    - backend/app/api/charts.py (legacy CHART_DATASOURCE_MAP hardcoded IDs)
    - backend/app/api/custom.py (/api/custom/kpi hardcoded IDs)
    - frontend/src/hooks/use-chart-data.ts (dead)
    - frontend/src/hooks/use-kpi-data.ts (dead)
    - frontend/src/hooks/use-breaks-data.ts (dead)
    - frontend/src/hooks/use-prefetch.ts (dead)
    - frontend/src/types/index.ts (barrel export violating convention)
    - backend/app/config/dashboards/chart-showcase.json
    - backend/app/config/dashboards/tlm-stats.json
    - backend/app/config/data_sources/showcase_*.json (12 files)
    - backend/app/config/data_sources/tlm_*.json (2 files)
    - backend/app/config/data_sources/reconmgmt_*.json (2 files)

key-decisions:
  - "Task 0 (schema + catalog gate) auto-acknowledged — user already approved via orchestrator D-03 gate (commit d07a296). No re-prompt needed."
  - "RoH guard test split into a separate .test.tsx file with jsdom pragma — vitest config uses node env by default, so rendering React components alongside pure unit tests requires a second file per-environment."
  - "Mocked useTheme + ResizeObserver directly in the RoH guard test instead of wrapping with the real ThemeProvider — jsdom does not polyfill window.matchMedia and the test is about hook ordering, not theme resolution."
  - "Commit-to-subrepo not used — this repo is single-repo (sub_repos=[] in init context). Standard git commit flow."

patterns-established:
  - "Pattern 1: mock-audit.sh is the canonical grep sweep — adding new offender patterns goes in this file, not scattered across plans."
  - "Pattern 2: frontend/e2e/_fixtures.ts is the single source of truth for curated catalog slugs and display names. Plan 10-01b seed script must mirror DASHBOARD_NAMES character-for-character."
  - "Pattern 3: test_seed_script.py uses importlib.util to load the dashed filename. Plan 10-01b Task 3 must guard main() with `if __name__ == '__main__':` or the scaffold won't be able to exercise the generator helpers."
  - "Pattern 4: RoH guards for complex wrapper components use jsdom + mock ResizeObserver + mock useTheme — documented in the new rules-of-hooks.test.tsx as a reusable template."

requirements-completed:
  - INFR-04
  - INFR-06
  - CHRT-01
  - CHRT-02

# Metrics
duration: ~35min
completed: 2026-04-08
---

# Phase 10 Plan 01a: Wave 0 Infra + Mock Cleanup Summary

**Wave 0 test harness (mock-audit.sh + _fixtures.ts DASHBOARD_NAMES anchor + 16-test seed scaffold) plus a zero-offender mock cleanup that deletes 19 legacy files and fixes the AgChartWrapper Rules of Hooks violation.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-08T04:02:00Z (approx)
- **Completed:** 2026-04-08T04:40:00Z (approx)
- **Tasks:** 2 (Task 0 auto-acknowledged, Tasks 1 and 2 executed)
- **Files modified:** 30 total (5 created, 2 modified, 23 deleted)

## Accomplishments

- **Wave 0 test harness landed.** `scripts/mock-audit.sh` encapsulates the 11 grep patterns from RESEARCH.md §3.9 with strict scoping (backend/app + frontend/src only, excludes tests/e2e/migrations/etc.). Pre-cleanup it detected all 9 expected offenders; post-cleanup it exits 0 with "mock-audit: clean".
- **Canonical `DASHBOARD_NAMES` constant pinned** in `frontend/e2e/_fixtures.ts` — the M-3 cross-check anchor. All 5 dashboard names use the `Phase 10 ·` prefix convention. Plan 10-01b seed script will mirror these exact strings; Plan 10-01b Task 4 unskips `test_dashboard_names_match_fixtures` to enforce the round-trip.
- **`CURATED_*` maps complete.** 5 dashboards, 22 charts (covering all 18 working chart types), 16 datasets, 12 KPIs — populated from RESEARCH.md §2.1/§2.2/§2.3/§2.4 verbatim. Zero abbreviation.
- **Seed script scaffold delivered.** `backend/tests/test_seed_script.py` has 16 `@pytest.mark.skip` test functions including the critical **A10 dual-row pairing guard** (`test_dataset_data_source_pairing`) with a detailed docstring, plus the M-3 cross-check (`test_dashboard_names_match_fixtures`). `python -m pytest tests/test_seed_script.py -v` reports exactly `16 skipped`.
- **Mock cleanup complete.** 4 dead hooks + types barrel deleted with zero consumer grep hits. Both legacy backend routers (`charts.py`, `custom.py`) deleted; `router.py` no longer imports or registers them. 16 legacy JSON config files deleted. Frontend vitest: 247/247 pass. Backend router imports cleanly with 50 routes.
- **Rules of Hooks violation fixed.** `ag-chart-wrapper.tsx` now declares `containerRef`, `containerSize`, the ResizeObserver `useEffect`, and the `sizedOptions` `useMemo` ABOVE all four early returns (missingColumns, isLoading, error, empty-data). New 5-test jsdom render guard in `ag-chart-wrapper.rules-of-hooks.test.tsx` asserts no "Rendered fewer/more hooks" warnings fire in any of the early-return states.

## Task Commits

1. **Task 0: Schema + Catalog Approval Gate** — `d07a296` (docs) — auto-acknowledged; user approved in orchestrator session, no re-prompt needed.
2. **Task 1: Wave 0 test infrastructure** — `ee477ce` (test) — `scripts/mock-audit.sh`, `frontend/e2e/_fixtures.ts`, `backend/tests/test_seed_script.py`, `.planning/phases/10-.../deferred-items.md`.
3. **Task 2: Mock cleanup + RoH fix** — `1c39b15` (fix) — 28 files changed, +234/-1511 lines. Dead hooks, types barrel, legacy routers, legacy JSON configs all removed. AgChartWrapper RoH fix + new render test file.

## Files Created/Modified

### Created

- `scripts/mock-audit.sh` (116 lines) — executable grep sweep; check_grep + check_file helpers; exits 0 clean, 1 with file:line hits.
- `frontend/e2e/_fixtures.ts` (313 lines) — DASHBOARD_NAMES, CURATED_DASHBOARDS, CURATED_CHARTS (22), CURATED_DATASETS (16), CURATED_KPIS (12), waitForDashboardLoad.
- `backend/tests/test_seed_script.py` (284 lines) — 16 skipped test functions including A10 dual-row guard and M-3 cross-check.
- `frontend/src/components/charts/ag-chart-wrapper.rules-of-hooks.test.tsx` (161 lines) — 5 render tests under jsdom, stubs useTheme/ResizeObserver/ag-charts-react, console.error spy asserts no hook-count warnings.
- `.planning/phases/10-comprehensive-testing-with-advanced-seed-data/deferred-items.md` — logs pre-existing TS errors in share-link.spec.ts and pre-existing backend test fixture drift.

### Modified

- `frontend/src/components/charts/ag-chart-wrapper.tsx` — Rules of Hooks fix: `containerRef`, `containerSize`, `useEffect(observer)`, and `sizedOptions` useMemo hoisted above the four early returns. Comments added explaining why each hook must sit above the guards.
- `backend/app/api/router.py` — removed `from app.api.charts import router as charts_router`, `from app.api.custom import router as custom_router`, and both corresponding `include_router` calls. Other routers untouched and in original order.

### Deleted (23 files)

- `backend/app/api/charts.py`, `backend/app/api/custom.py`
- `backend/app/config/dashboards/chart-showcase.json`, `backend/app/config/dashboards/tlm-stats.json`
- 12 files under `backend/app/config/data_sources/showcase_*.json`
- 2 files under `backend/app/config/data_sources/tlm_*.json`
- 2 files under `backend/app/config/data_sources/reconmgmt_*.json`
- `frontend/src/hooks/use-chart-data.ts`, `use-kpi-data.ts`, `use-breaks-data.ts`, `use-prefetch.ts`
- `frontend/src/types/index.ts`

## Decisions Made

- **Task 0 auto-acknowledged:** The user already approved the schema + catalog via the D-03 gate during the orchestrator session (commit `d07a296`). Re-prompting for approval would contradict the orchestrator directive and waste a checkpoint round-trip. Proceeded directly to Task 1.
- **Chart catalog stabilized at 18 working types (22 charts total):** Per the user correction on 2026-04-08, `bullet`, `box-plot`, and `sunburst` are excluded from the curated catalog because they either fall back to bar (bullet, box-plot) or need hierarchical data transforms (sunburst). The `_fixtures.ts` CURATED_CHARTS map has 22 entries covering the 18 working types with variety — no excluded types referenced.
- **RoH guard split into a second test file (`.test.tsx`)** instead of appending to the existing `.test.ts`:
  - `vitest.config.ts` uses `environment: 'node'` by default.
  - The existing file is a pure `buildSeries()` unit test — no DOM.
  - Rendering React components needs `@vitest-environment jsdom` pragma, which requires JSX, which requires `.tsx`.
  - Keeping the two concerns in two files is cleaner than polluting the pure unit tests with a jsdom environment switch.
- **Mocked `useTheme` + `ResizeObserver` directly** in the RoH guard rather than wrapping the real `ThemeProvider`. jsdom does not polyfill `window.matchMedia`, which the real provider uses on mount. The test is about hook call order, not theme resolution, so stubbing is correct.
- **Commit-to-subrepo not used:** Init context reported `sub_repos: []` — this is a single-repo setup. Used standard `git commit` flow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Separate `.test.tsx` file for RoH guard test**
- **Found during:** Task 2 Step 3 verification
- **Issue:** Plan §Step 3 said "append to existing describe" in `ag-chart-wrapper.test.ts`, but that file imports `@testing-library/react` style rendering impossible (node env, no JSX, no DOM).
- **Fix:** Created `ag-chart-wrapper.rules-of-hooks.test.tsx` as a sibling `.test.tsx` file with `@vitest-environment jsdom` pragma. Left the existing `.test.ts` untouched (pure `buildSeries` unit tests unchanged).
- **Files modified:** New file only; existing test file imports restored to original.
- **Verification:** `pnpm vitest run src/components/charts/ag-chart-wrapper` → 20/20 pass (15 existing + 5 new).
- **Committed in:** `1c39b15`

**2. [Rule 3 - Blocking] Mocked ThemeProvider/ResizeObserver in RoH guard test**
- **Found during:** Task 2 Step 3 first test run
- **Issue:** Initial attempt used the real `ThemeProvider`. jsdom does not polyfill `window.matchMedia`, causing `TypeError: window.matchMedia is not a function` in all 5 tests.
- **Fix:** Added `vi.mock('@/components/layout/theme-provider', ...)` with a stub `useTheme`, plus a `MockResizeObserver` assigned to `globalThis.ResizeObserver`. The `renderInTheme` helper simplified to render `AgChartWrapper` directly.
- **Files modified:** `ag-chart-wrapper.rules-of-hooks.test.tsx` only.
- **Verification:** Re-run reported 20/20 pass, zero jsdom errors.
- **Committed in:** `1c39b15` (amended into same Task 2 commit via pre-commit iteration)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues)
**Impact on plan:** Both auto-fixes were necessary to deliver a passing RoH guard test. Neither changed the scope or introduced new surface area. Pattern documented for future wrapper-component render tests.

## Deferred Issues

Pre-existing failures NOT introduced by Plan 10-01a, logged in
`.planning/phases/10-comprehensive-testing-with-advanced-seed-data/deferred-items.md`:

1. **`frontend/e2e/share-link.spec.ts`** — 4 TS errors (`Cannot find name 'window'`, `Navigator.clipboard`). Root cause: `tsconfig.e2e.json` lacks DOM lib types. Deferred to Plan 10-01c E2E rewrite.
2. **`backend/tests/test_config_store.py`** — fixture instantiates `ConfigStore()` without the required `session` arg. Drifted from the service signature. Deferred to a decimal sub-phase or Plan 10-01b.
3. **`backend/tests/test_dataset_sync.py`** — stale assertion `assert result == {"id": 42}` vs actual `{"result": {"id": 42}}`. Deferred alongside Issue 2.
4. **`backend/tests/test_query_engine.py`** — 11 errors, all same root cause as Issue 2 (ConfigStore fixture).

All four issues were verified as pre-existing by `git stash && pytest` on the pristine tree BEFORE Plan 10-01a ran. Plan 10-01a has zero regressions.

## Verification

- `bash scripts/mock-audit.sh` → `mock-audit: clean`, exit 0
- `cd frontend && pnpm vitest run` → **247/247 pass (17 files)** — includes 5 new RoH guard tests
- `cd frontend && pnpm exec tsc --project tsconfig.app.json --noEmit` → 41 errors (**3 fewer** than pre-cleanup baseline of 44). Zero errors in `ag-chart-wrapper.tsx` or other Plan 10-01a touched files.
- `cd backend && python -c "from app.api import router; print(len(router.api_router.routes))"` → **50 routes, OK**
- `cd backend && python -m pytest tests/test_seed_script.py -v` → **16 skipped**, 0 errors/failures
- Backend pre-existing failures verified unchanged via `git stash` comparison

## Issues Encountered

- **jsdom window.matchMedia** — blocked initial RoH render test (auto-fixed via Rule 3 above).
- **File-extension mismatch for TSX render tests** — blocked appending to `.test.ts` (auto-fixed via Rule 3 above by creating a sibling `.test.tsx`).
- **No user-facing issues. Frontend builds. Backend imports. Mock audit clean.**

## User Setup Required

None. Task 2 deletes files the user never had to configure.

## Next Phase Readiness

**Plan 10-01b can proceed immediately** against a known-clean working tree:

- The Wave 0 test harness exists — `test_seed_script.py` has 16 skipped tests ready for Plan 10-01b Task 4 to unskip and implement.
- The canonical `DASHBOARD_NAMES` constant is pinned — Plan 10-01b Task 3 must mirror those exact strings in `CURATED_DASHBOARDS[*].name`.
- The backend `config/dashboards/` and `config/data_sources/` directories are now empty — Plan 10-01b Task 3 seeds the new curated catalog directly into `recviz_dashboards`, `recviz_data_sources`, `recviz_datasets`, `recviz_charts`, and `recviz_kpis` via direct INSERT.
- The legacy JSON config loader path (`seed_recviz_configs` reading from disk) is now a no-op — no files to load. Plan 10-01b will remove the glob-based loader entirely.
- `mock-audit.sh` exits 0 — any regression during Plan 10-01b will surface immediately via the same command.

**Blockers:** None.

**Concerns for Plan 10-01b:** The pre-existing `test_config_store.py` / `test_query_engine.py` fixture drift blocks a clean `pytest tests/` green bar. Plan 10-01b should consider fixing the fixture-setup signature (small surgical fix — pass a session mock) before adding more tests on top, otherwise the full suite green gate in Plan 10-01c will be hard to achieve.

## Self-Check: PASSED

Verified post-write:

- `scripts/mock-audit.sh` — FOUND
- `frontend/e2e/_fixtures.ts` — FOUND
- `backend/tests/test_seed_script.py` — FOUND
- `frontend/src/components/charts/ag-chart-wrapper.rules-of-hooks.test.tsx` — FOUND
- `.planning/phases/10-.../10-01a-SUMMARY.md` — FOUND
- `.planning/phases/10-.../deferred-items.md` — FOUND
- `backend/app/api/charts.py` — GONE
- `backend/app/api/custom.py` — GONE
- All 4 dead hook files — GONE
- `frontend/src/types/index.ts` — GONE
- `backend/app/config/dashboards/chart-showcase.json` — GONE
- `backend/app/config/dashboards/tlm-stats.json` — GONE
- Commit `d07a296` (Task 0 approval) — FOUND
- Commit `ee477ce` (Task 1 Wave 0 infra) — FOUND
- Commit `1c39b15` (Task 2 mock cleanup) — FOUND
- `bash scripts/mock-audit.sh` → clean, exit 0
- `pnpm vitest run` → 247/247 pass
- `pytest tests/test_seed_script.py` → 16 skipped

---
*Phase: 10-comprehensive-testing-with-advanced-seed-data*
*Completed: 2026-04-08*
