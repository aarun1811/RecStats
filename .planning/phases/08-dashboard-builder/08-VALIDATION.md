---
phase: 8
slug: dashboard-builder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), pytest (backend) |
| **Config file** | `frontend/vitest.config.ts`, `backend/pytest.ini` |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `cd frontend && npx tsc --noEmit && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx tsc --noEmit`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| TBD | TBD | TBD | BLDR-01..08 | type-check + unit | `npx tsc --noEmit && npx vitest run` | ⬜ pending |

*Will be populated by planner with specific task IDs.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. vitest and pytest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop layout | BLDR-02 | Physical interaction | Playwright MCP: drag panel, verify position change |
| Resize panels | BLDR-02 | Physical interaction | Playwright MCP: resize handle, verify panel dimensions |
| Filter bar reorder | BLDR-04 | Drag interaction | Playwright MCP: drag filter, verify order change |
| View/Edit mode toggle | BLDR-06 | Visual verification | Playwright MCP: verify grid lines, handles appear/disappear |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
