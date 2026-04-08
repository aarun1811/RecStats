# Phase 10 — Deferred Items

Issues discovered during Phase 10 execution that are out of scope for the
current plan. Each entry names the phase/plan where it was discovered and the
target plan that will fix it.

## Pre-existing TS errors in `frontend/e2e/share-link.spec.ts`

**Discovered during:** Plan 10-01a Task 1 (out of scope — existed before
Phase 10 started).

**Issue:** `pnpm exec tsc --project tsconfig.e2e.json --noEmit` reports:

- `share-link.spec.ts(108,15): Cannot find name 'window'`
- `share-link.spec.ts(136,11): Cannot find name 'window'`
- `share-link.spec.ts(169,19): Property 'clipboard' does not exist on type 'Navigator'`
- `share-link.spec.ts(195,15): Cannot find name 'window'`

Root cause: `tsconfig.e2e.json` only declares `"types": ["node"]` and
`"lib": ["ES2023"]` — it lacks DOM typings. `share-link.spec.ts` calls
`page.evaluate(() => window.navigator.clipboard.readText())` which needs
DOM lib types to type-check. The tests RUN fine because Playwright executes
them in a real browser context; only the offline `tsc` check fails.

**Deferred to:** Plan 10-01c (E2E spec rewrite). When `share-link.spec.ts`
is rewritten against the new curated catalog, add `"lib": ["ES2023", "DOM"]`
(or an equivalent Playwright lib reference) to `tsconfig.e2e.json`, OR
refactor the clipboard reads to use Playwright's `page.evaluate` with a
typed return signature that doesn't reference `window` bare.

**Scope justification:** Plan 10-01a is infrastructure + mock cleanup only —
its fixture file (`frontend/e2e/_fixtures.ts`) type-checks cleanly. Fixing
unrelated spec files in Plan 10-01a would scope-creep into Plan 10-01c's
rewrite territory.

## Pre-existing backend test failures

**Discovered during:** Plan 10-01a Task 2 verification.

**Issue 1 — `backend/tests/test_config_store.py` fixture broken:**
```
ERROR at setup of test_list_dashboards
  TypeError: ConfigStore.__init__() missing 1 required positional argument: 'session'
```
The `store` fixture calls `ConfigStore()` without a `session` argument, but
`ConfigStore.__init__` now requires one. Both the fixture and the service
signature drifted at some point without re-running the tests.

**Issue 2 — `backend/tests/test_dataset_sync.py::test_superset_create_dataset_posts_to_correct_endpoint`:**
```
assert result == {"id": 42}
AssertionError: {'result': {'id': 42}} != {'id': 42}
```
The assertion expects `{"id": 42}` but the service now returns the full
Superset envelope `{"result": {"id": 42}}`. Test is stale.

**Issue 3 — `backend/tests/test_query_engine.py` — 11 errors:**
All errors of the form `TypeError: ConfigStore.__init__() missing ...` —
same root cause as Issue 1. The QueryEngine tests also instantiate
ConfigStore without a session.

**Verification:** Running `git stash && pytest ...` on the pristine tree
BEFORE any Plan 10-01a changes produces the identical 1 failure + 11 errors,
proving these are pre-existing and not introduced by Plan 10-01a.

**Deferred to:** Next passing plan in Phase 10 (likely 10-01b or a decimal
sub-phase spawned during 10-02). The fix is small: pass a session mock to
`ConfigStore(session=...)` in the fixtures, and update the
`test_superset_create_dataset_posts_to_correct_endpoint` assertion to unwrap
`result["result"]`. Plan 10-01a intentionally does not fix them because
fixing backend test fixtures is unrelated to "mock cleanup + RoH fix" and
would scope-creep.

**Scope justification:** Plan 10-01a's verification command explicitly said
"no new failures" — it did not demand fixing pre-existing failures. The
mock-audit, frontend vitest (247 pass), RoH guard tests (5 new tests pass),
TypeScript check (3 fewer errors than baseline), and router.py import all
pass. Plan 10-01a has zero regressions.
