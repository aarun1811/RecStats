---
phase: 6
slug: chart-library
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend), pytest (backend) |
| **Config file** | frontend/vitest.config.ts, backend/pytest.ini |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose` / `cd backend && python -m pytest -x` |
| **Full suite command** | `cd frontend && npx vitest run` / `cd backend && python -m pytest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick vitest + pytest
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green + Playwright visual verification
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | CHRT-03 | — | N/A | unit/integration | `python -m pytest tests/test_managed_charts.py -x` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | CHRT-04 | — | N/A | unit | `python -m pytest tests/test_managed_charts.py::test_chart_reference -x` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | CHRT-01 | — | N/A | integration | Playwright | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | CHRT-02 | — | N/A | unit | `npx vitest run src/lib/chart-compatibility.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 2 | CHRT-05 | — | N/A | unit | `npx vitest run src/components/charts/ag-chart-wrapper.test.ts` | ✅ partial | ⬜ pending |
| 06-02-04 | 02 | 2 | CHRT-06 | — | N/A | unit | `npx vitest run src/components/charts/echart-wrapper.test.ts` | ✅ partial | ⬜ pending |
| 06-03-01 | 03 | 3 | CHRT-07 | — | N/A | e2e | Playwright | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_managed_charts.py` — stubs for CHRT-03, CHRT-04 backend CRUD
- [ ] `frontend/src/lib/chart-compatibility.test.ts` — covers CHRT-02 compatibility logic
- [ ] `frontend/src/hooks/use-managed-charts.test.ts` — covers frontend CRUD hooks

*Existing infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live chart preview updates | CHRT-01 | Visual rendering quality | Open builder, select dataset, pick chart type, map columns — verify chart renders correctly |
| Chart type thumbnail grid | CHRT-02 | Visual layout verification | Open builder, select dataset — verify icon grid shows correct compatibility dimming |
| Chart library card thumbnails | CHRT-07 | Visual gallery appearance | Navigate to /charts — verify cards display with type icons and metadata |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
