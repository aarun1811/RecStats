---
phase: 12
slug: engine-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 12-01-01 | 01 | 1 | DIAL-01 | unit | `pytest tests/test_portable_json.py -x` | pending |
| 12-01-02 | 01 | 1 | DIAL-03 | unit | `pytest tests/test_migrations.py -x` | pending |
| 12-02-01 | 02 | 1 | CONN-01 | unit | `pytest tests/test_connections.py -x` | pending |
| 12-02-02 | 02 | 1 | CONN-04 | unit | `pytest tests/test_encryption.py -x` | pending |
| 12-03-01 | 03 | 2 | QENG-01 | unit | `pytest tests/test_engine_manager.py -x` | pending |
| 12-03-02 | 03 | 2 | CONN-03 | unit | `pytest tests/test_connection_test.py -x` | pending |
| 12-03-03 | 03 | 2 | CONN-05 | unit | `pytest tests/test_uri_builder.py -x` | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing test infrastructure covers phase requirements. pytest + pytest-asyncio already installed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Oracle dialect DDL compiles | DIAL-01 | No Oracle DB locally | Verify PortableJSON type renders valid DDL via `CreateTable.compile(dialect=oracle_dialect)` |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
