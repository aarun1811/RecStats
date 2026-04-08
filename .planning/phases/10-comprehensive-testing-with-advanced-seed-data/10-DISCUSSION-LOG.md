# Phase 10: Comprehensive Testing with Advanced Seed Data - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 10-comprehensive-testing-with-advanced-seed-data
**Areas discussed:** Seed data shape & volume, Test surface, Done criteria & bug-handling, Test mix, Build sequence

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Seed data shape & volume | Single most important decision. How big, what schema, what date range, what cardinalities, what edge cases. Replace, parallel, or layer? | ✓ |
| Test surface — what flows get covered | Renderer only? Full builder loop? Cross-cutting interactions? | ✓ |
| Test mix & automation level | E2E only, perf budgets, manual runbook, visual regression, load testing? | ✓ (revisited later) |
| Done criteria & bug-handling policy | What makes Phase 10 complete; how findings get fixed | ✓ |

---

## Seed data shape & volume

### Q1: How big should the 'advanced' seed actually be?

| Option | Description | Selected |
|--------|-------------|----------|
| 10M+ row stress tier | Largest fact at 10M+, near-prod scale, slow seeding, multi-GB Postgres | |
| 1M row realistic tier | Fact at 1M, dimensions 10k–50k, matches PROJECT.md "millions of rows" line | |
| 100k row 'rich' tier | Fact at 100k, edge cases covered, snappy dev loop | ✓ |

**User's choice:** "I want first the test to work with 100k rows. Once it passes, we will implement and test for 1M/10M rows."
**Notes:** Iterative scaling — 100k baseline first, then expand. This shaped the Phase 10 / Phase 11 split.

### Q2: What schema should the advanced seed model?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing 6 tables | Keep current recon tables, blow them up, add a few columns | |
| New richer GRU recon model | Build a deliberately realistic GRU schema alongside existing tables | |
| Anonymized real recon dump | Sanitized snapshot of actual GRU data | |

**User's choice:** "Drop all the existing tables and models along with chart or other saved data. We will re-seed with more data, datasets, charts, KPIs and dashboard with global filters, cross filters and drill down filters enabled. The purpose of the seed data is to ensure all the work done till now is tested."
**Notes:** Major re-frame — clean-slate replace, not extension. Drops the existing managed entities AND the source recon tables. Build a new test bed designed to exercise every interaction (global filters, cross-filter, drill-down).

### Q3: Replace, parallel, or layer the seed?

| Option | Description | Selected |
|--------|-------------|----------|
| Layered — small + advanced both seeded | Existing small seed kept; advanced seed adds new entities alongside | |
| Parallel scripts, one or the other | Two scripts, devs run whichever | |
| Replace and adapt | Delete small seed, replace with advanced, rewrite existing tests | ✓ |

**User's choice:** Replace and adapt
**Notes:** Confirms the clean-slate intent from Q2.

### Q4: What edge cases must the seed include?

| Option | Description | Selected |
|--------|-------------|----------|
| NULLs in measure and dimension columns | Forces null handling in renderer/aggregator/KPI | ✓ |
| High-cardinality dimensions (10k+ uniques) | Stress cross-filter dropdown, multi-select, palette search | ✓ |
| Very large + very small + negative numbers | Exercise financial formatter at extremes | |
| Dates spanning leap years, time zones, year boundaries | Date-range filters, time-series, Y/Y trend logic | ✓ |

**User's choice:** Nulls, high-cardinality, date edges (NOT extreme number values explicitly, though those will arise naturally from realistic monetary distributions)
**Notes:** —

### Q5 (follow-up): How does volume scaling fit into Phase 10?

| Option | Description | Selected |
|--------|-------------|----------|
| All within Phase 10 (sub-tasks) | 100k → 1M → 10M all within Phase 10 | |
| Phase 10 is 100k-only; 1M and 10M become Phase 11 | Cleaner phase boundaries, ship Phase 10 quickly | ✓ |
| Phase 10 is 100k-only; 1M/10M deferred to next milestone | Lowest commitment now | |

**User's choice:** Phase 10 is 100k-only; 1M and 10M become Phase 11
**Notes:** Locks the Phase 10 / Phase 11 split.

### Q6 (follow-up): Who designs the new schema?

| Option | Description | Selected |
|--------|-------------|----------|
| I'll propose, you approve | Claude drafts, user approves in PLAN.md before execution | ✓ |
| You give me the entity list, I expand | User names entities, Claude fills in columns/types | |
| You design the schema, I implement | User hands DDL, Claude implements | |

**User's choice:** I'll propose, you approve
**Notes:** Schema design becomes a research/planning artifact requiring user approval before execution.

### Q7 (follow-up): How many curated test entities?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal coverage | 5–6 datasets, 8–10 charts, 4–5 KPIs, 2 dashboards | |
| Full coverage | 10+ datasets, 20+ charts, 10+ KPIs, 4–5 recon-domain dashboards | ✓ |
| Scale-to-feature — minimal at 100k, expand later | Tight Phase 10, expand with volume | |

**User's choice:** Full coverage
**Notes:** The seed doubles as a demo asset, not just test fixtures.

### Q8 (check-in): More on seed, or move on?

| Option | Description | Selected |
|--------|-------------|----------|
| Move to Test surface | Have enough on the seed | ✓ |
| More questions on seed | Idempotency, env vars, reset vs full re-run | |

**User's choice:** Move to Test surface

### Mid-discussion user message

> "this phase will have lot of manual testing being done. entire UAT flow testing is being focused for the phases we did"

**Notes:** This significantly reframed Test surface — Phase 10 is primarily a manual UAT phase, not an automated test phase. The seed becomes the UAT staging environment; the deliverable centers on a phase-by-phase UAT runbook covering every flow built in Phases 1–9.

---

## Test surface

### Q1: How is the UAT runbook organized?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase-by-phase UAT checklist | One section per phase, mirrors roadmap, traceable regressions | ✓ |
| Capability-driven UAT | One section per capability area | |
| Persona-driven UAT | Dev day vs business user day | |

**User's choice:** Phase-by-phase UAT checklist
**Notes:** —

### Q2: What does the runbook look like as an artifact?

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown checklist in .planning/phases/10 | Single .md file, version-controlled, inline notes | ✓ |
| Markdown checklist + companion ISSUES log | Same plus structured findings log | |
| Spreadsheet / external tool | Google Sheet or Linear | |

**User's choice:** Markdown checklist in .planning/phases/10
**Notes:** Single artifact at `10-UAT-RUNBOOK.md`. A separate `10-FINDINGS.md` may emerge if issue volume warrants triage, but the default is inline notes.

### Q3: How much do automated regression tests matter?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — only update existing tests for new seed | Rewrite existing E2E specs, no new comprehensive suite | |
| Substantial — build E2E suite alongside UAT | Manual UAT validates UX, E2E catches regressions | |
| None — pure manual | Drop or leave existing E2E broken | |

**User's choice:** "you do playwright mcp test once. i will be doing manual test afterwards bro"
**Notes:** Claude does ONE Playwright MCP smoke pass for visual sanity; user does the comprehensive manual UAT. Existing E2E specs get rewritten to point at the new advanced seed but no new comprehensive suite is built.

### Mid-discussion user message

> "no mock or fallback response should render in frontend or get propogated to frontend bro."

**Notes:** Reaffirmed the existing `feedback_no_mock_shortcuts.md` memory as a non-negotiable for Phase 10. Captured as D-15.3 / D-16.

---

## Done criteria & bug-handling

### Q1: What makes Phase 10 'complete'?

| Option | Description | Selected |
|--------|-------------|----------|
| All UAT items ticked + zero mock/fallback responses | UAT green + smoke green + zero mocks + P0/P1 fixed | ✓ |
| All UAT items ticked, P2/P3 deferred | P0/P1 in-phase, P2/P3 to backlog | |
| All UAT items ticked, every issue fixed before close | Strictest, balloon risk | |

**User's choice:** All UAT items ticked + zero mock/fallback responses
**Notes:** Captured as D-15.

### Q2: When UAT or smoke surfaces a bug, where does the FIX live?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in-phase via decimal sub-phases | 10.1, 10.2, … each with own PLAN.md | ✓ |
| Fix inline within Phase 10's plans | All fixes in a single 10-04 plan | |
| Log to backlog, fix in next milestone | Phase 10 produces no fixes | |

**User's choice:** Fix in-phase via decimal sub-phases
**Notes:** Captured as D-13.

### Q3: How do we audit for mock/fallback responses?

| Option | Description | Selected |
|--------|-------------|----------|
| Codebase grep + endpoint review + UAT validation | Three-pronged audit | ✓ |
| UAT-only — catch them during the manual walkthrough | Lower upfront, miss risk | |
| Tooling-based — add a 'no-mock' marker check | CI scan, sustainable | |

**User's choice:** Codebase grep + endpoint review + UAT validation
**Notes:** Captured as D-16. CONCERNS.md is the starting offender list.

### Q4: What happens to Reports/Export stubs?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove the routes entirely | Delete Reports + Export, no stub surface | |
| Keep stubs but mark as 'Coming Soon' explicitly | Empty states, honest with users | |
| Hide from UI but keep code | Feature flag / comment out | |

**User's choice:** "it is already marked as coming soon currently bro. don't worry about it"
**Notes:** Reports and Export already render explicit "Coming Soon" empty states. Captured as D-17 — they are exempt from the mock audit because they are honest empty states, not fake-data shims.

---

## Test mix (revisited)

### Q1: Performance benchmarking?

| Option | Description | Selected |
|--------|-------------|----------|
| Light — record observations only | Timings logged to 10-PERF-OBSERVATIONS.md, no assertions | ✓ |
| Strict — enforce timing budgets in tests | Test failures on slow operations | |
| None — perf is Phase 11's problem | Pure functional UAT | |

**User's choice:** Light — record observations only
**Notes:** Captured as D-18.

### Q2: Visual regression?

| Option | Description | Selected |
|--------|-------------|----------|
| No | Skip pixel snapshots; manual UAT covers visual issues | ✓ |
| Yes — Playwright snapshots for key dashboards | Light + dark baselines | |

**User's choice:** No
**Notes:** Captured as D-19.

### Q3: Backend load testing?

| Option | Description | Selected |
|--------|-------------|----------|
| No | Skip; single-tenant at v1, defer to Phase 11 | ✓ |
| Yes — lightweight concurrent-request smoke | 10–20 concurrent requests | |

**User's choice:** No
**Notes:** Captured as D-20.

---

## Build sequence

### Q1: How does the build sequence inside Phase 10 unfold?

| Option | Description | Selected |
|--------|-------------|----------|
| Plan 10-01: seed + schema first — unblock UAT early | Minimum viable catalog first, full catalog later, parallel UAT | |
| Plan 10-01: seed + schema only. Plan 10-02: full catalog. Plan 10-03: E2E rewrite + smoke + runbook | Strict sequencing | |
| Single big-drop plan | One plan, all at once | |

**User's choice:** "you will do seed + schema + load all pages and see if everything is working as expected. i will be putting you in autonomous mode at that point. fix all the issues as phases immediately or later as it should be done. Once you feel there are no more issues, i step in and do the manual regress UAT testing"
**Notes:** Reframed the build sequence into a Claude pre-flight model:
- Plan 10-01: Claude builds schema + seed + curated catalog
- Plan 10-02: Claude enters autonomous mode, walks every page with Playwright MCP, fixes issues (inline if trivial, decimal sub-phases if substantive), loops until clean
- Plan 10-03: Claude finalizes UAT runbook + perf observations + posts "ready for UAT" → user does the manual regression walkthrough
Captured as D-12 / D-13 / D-14 / D-21 / D-22 / D-23.

### Q2: Smoke pass target — all 4–5 dashboards or one kitchen sink?

| Option | Description | Selected |
|--------|-------------|----------|
| All 4–5 dashboards in the smoke pass | Walk every curated dashboard; comprehensive visual sanity | ✓ |
| One 'kitchen sink' dashboard | Maximally exercises every type, faster | |
| You decide during execution | Claude's discretion | |

**User's choice:** All 4–5 dashboards in the smoke pass
**Notes:** Captured as D-11.

---

## Claude's Discretion

- Exact column lists and FK relationships within the schema (drafted in `10-RESEARCH.md`, surfaced in `10-01-PLAN.md` for user approval)
- Exact recon-domain dashboard themes within the 4–5 dashboard catalog
- Decision to spawn a decimal sub-phase or fix inline within 10-02 (judged by complexity)
- Ordering of pages walked during autonomous pre-flight
- Format of `10-PERF-OBSERVATIONS.md`
- Whether rewritten E2E specs become 7 spec files or get reorganized

## Deferred Ideas

See `<deferred>` section in `10-CONTEXT.md` for the full list. Highlights:
- 1M / 10M row scaling → Phase 11
- Performance budgets / load testing → Phase 11
- Saved Views (SHAR-01), Reports/Export, Auth → next milestone
- Visual regression, comprehensive E2E suite, mock detector tooling → v2
