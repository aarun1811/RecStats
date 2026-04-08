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
