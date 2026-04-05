---
phase: 4
slug: data-source-connectivity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | DATA-01, DATA-02 | — | N/A | unit | `python -m pytest tests/test_uri_builder.py -v` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | DATA-04 | T-04-01 | Passwords never in API response | unit | `python -m pytest tests/test_database_api.py -v` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | DATA-04 | — | N/A | component | `npx vitest run src/components/settings` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_uri_builder.py` — test oracle+oracledb aliasing, hive, postgresql URI generation
- [ ] `backend/tests/test_database_api.py` — test status tracking, test-before-save, password stripping

*Existing infrastructure covers frontend component testing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Superset Dockerfile builds with all drivers | DATA-01, DATA-02 | Docker build environment | `docker compose build superset && docker compose up -d superset && docker exec superset pip list \| grep oracledb` |
| Dynamic form shows correct fields per backend | DATA-04 | Visual UI validation | Open Settings > Data Sources > Add, select each backend type, verify fields change |
| Status dot color matches connection state | DATA-04 | Visual indicator | Test connection, verify green dot; disconnect, verify red dot |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
