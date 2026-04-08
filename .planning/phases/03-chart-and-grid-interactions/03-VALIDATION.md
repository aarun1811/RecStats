---
phase: 3
slug: chart-and-grid-interactions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit) + playwright (e2e) |
| **Config file** | `frontend/vitest.config.ts` / `frontend/playwright.config.ts` |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd frontend && npx vitest run && npx playwright test` |
| **Estimated runtime** | ~30 seconds (unit) + ~60 seconds (e2e) |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd frontend && npx vitest run && npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | INTR-05 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | INTR-06 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | INTR-07 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | INTR-08, INTR-09 | — | N/A | unit+e2e | `npx vitest run && npx playwright test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Unit test stubs for chart toolbar, fullscreen dialog, export functions
- [ ] Unit test stubs for grid toolbar, refresh, auto-refresh hooks
- [ ] Playwright test stubs for fullscreen modal, export download, refresh indicator

*Existing vitest and playwright infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PNG/SVG export image quality | INTR-06 | Visual quality check — automated tests verify download triggers, not image fidelity | Open dashboard, export chart as PNG, verify image is crisp at 2x DPI |
| Fullscreen chart interactive feel | INTR-05 | Subjective UX — cross-filter clicks and drill-down in modal | Expand chart to fullscreen, click a bar to cross-filter, verify dimming works in modal |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
