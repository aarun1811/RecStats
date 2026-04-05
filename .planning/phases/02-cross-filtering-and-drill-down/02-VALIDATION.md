---
phase: 2
slug: cross-filtering-and-drill-down
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 (frontend), pytest (backend) |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && pnpm vitest run --reporter=verbose` |
| **Full suite command** | `cd frontend && pnpm vitest run && cd ../backend && python -m pytest tests/` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | INTR-01 | unit | `cd frontend && pnpm vitest run src/lib/cross-filter.test.ts -t "applyCrossFilters"` | No — W0 | pending |
| 02-01-02 | 01 | 1 | INTR-01 | unit | `cd frontend && pnpm vitest run src/stores/filter-store.test.ts -t "crossFilter"` | No — W0 | pending |
| 02-01-03 | 01 | 1 | INTR-01 | unit | `cd frontend && pnpm vitest run src/lib/cross-filter.test.ts -t "skips"` | No — W0 | pending |
| 02-01-04 | 01 | 1 | INTR-01 | unit | `cd frontend && pnpm vitest run src/lib/cross-filter.test.ts -t "self"` | No — W0 | pending |
| 02-01-05 | 01 | 1 | INTR-02 | unit | `cd frontend && pnpm vitest run src/components/charts/ag-chart-wrapper.test.ts` | No — W0 | pending |
| 02-02-01 | 02 | 2 | INTR-03 | unit | `cd frontend && pnpm vitest run src/stores/drill-store.test.ts` | No — W0 | pending |
| 02-02-02 | 02 | 2 | INTR-03 | unit | `cd frontend && pnpm vitest run src/hooks/use-drill-down.test.ts` | No — W0 | pending |
| 02-02-03 | 02 | 2 | INTR-04 | unit | `cd frontend && pnpm vitest run src/hooks/use-drill-detail.test.ts` | No — W0 | pending |
| 02-02-04 | 02 | 2 | INTR-04 | unit | `cd backend && python -m pytest tests/test_query_engine.py -k "drill"` | No — W0 | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/cross-filter.test.ts` — covers INTR-01 (applyCrossFilters, rowPassesCrossFilters, column matching, self-exclusion)
- [ ] `frontend/src/stores/filter-store.test.ts` — covers INTR-01 (addCrossFilter toggle, removeCrossFilter, clearCrossFilters)
- [ ] `frontend/src/stores/drill-store.test.ts` — covers INTR-03 (per-chart drill state management)
- [ ] `frontend/src/hooks/use-drill-down.test.ts` — covers INTR-03 (hierarchy-based drill depth)
- [ ] `frontend/src/hooks/use-drill-detail.test.ts` — covers INTR-04 (drill detail query construction)
- [ ] `backend/tests/test_query_engine.py` drill tests — covers INTR-04 (backend drill filter queries)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Opacity dimming visual appearance | INTR-02 | Visual rendering requires browser | Open dashboard, click chart segment, verify excluded items at ~30% opacity |
| Detail grid slide-down animation | INTR-03 | Layout/animation requires browser | Drill to detail level, verify grid appears below drilled chart's row |
| Cross-filter badge bar UX | INTR-02 | Visual/interactive component | Apply cross-filter, verify badge bar appears with filter info and X buttons |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
