---
phase: 1
slug: foundation-hardening
status: active
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (backend) / vitest (frontend) |
| **Config file** | `backend/pyproject.toml` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && pytest tests/ -x -q` |
| **Full suite command** | `cd backend && pytest tests/ -v && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/ -x -q`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-T1 | 01 | 1 | INFR-01, INFR-02 | import check | `python -c "from app.db.engine import engine"` | ❌ W0 | ⬜ pending |
| 01-T2 | 01 | 1 | INFR-01 | import check | `python -c "from app.services.config_store import ConfigStore"` | ❌ W0 | ⬜ pending |
| 02-T1 | 02 | 1 | INFR-05 | unit test | `npx vitest run src/lib/formatters.test.ts` | ❌ W0 | ⬜ pending |
| 02-T2 | 02 | 1 | INFR-03, INFR-06 | grep check | `grep "apache-superset==" backend/requirements.txt` | ✅ | ⬜ pending |
| 03-T1 | 03 | 2 | INFR-04 | file check | `test ! -f backend/app/mock_data.py` | ✅ | ⬜ pending |
| 03-T2 | 03 | 2 | INFR-04 | grep check | `grep -c "export function ErrorPanel" frontend/src/components/shared/error-panel.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. All 6 tasks have inline automated verification commands — no separate Wave 0 test stubs needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Error toast displays on Superset failure | INFR-04 | Visual UI behavior | Disconnect Superset, load dashboard, verify toast + inline error |
| Number formatting renders correctly | INFR-05 | Visual rendering | Load dashboard with mixed currency data, verify formatting |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-04
