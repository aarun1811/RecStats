---
phase: 5
slug: dataset-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (backend), vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q --tb=short` / `cd frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` && `cd frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick test command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | DSET-05 | — | N/A | unit | `pytest tests/test_dataset_models.py` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | DSET-01, DSET-04 | — | N/A | unit | `pytest tests/test_dataset_api.py` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | DSET-01 | — | N/A | unit | `pytest tests/test_dataset_sync.py` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | DSET-01, DSET-03 | — | N/A | unit | `vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | DSET-02 | — | N/A | unit | `vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | DSET-01..05 | — | N/A | e2e | Playwright or manual | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_dataset_models.py` — stubs for DSET-05 (persistence models)
- [ ] `backend/tests/test_dataset_api.py` — stubs for DSET-01, DSET-04 (CRUD endpoints)
- [ ] `backend/tests/test_dataset_sync.py` — stubs for Superset sync service
- [ ] `frontend/src/__tests__/` — stubs for dataset hooks and components

*Existing pytest and vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Monaco editor SQL editing UX | DSET-01 | Interactive editor behavior | Open dataset editor, write SQL, verify syntax highlighting and Cmd+Enter execution |
| AG Grid inline column metadata editing | DSET-02 | Complex grid interaction | Click cells in metadata table, verify dropdown selectors and inline editing |
| Format preview toggle | DSET-02 | Visual formatting verification | Toggle "Show formatted" and verify values display correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
