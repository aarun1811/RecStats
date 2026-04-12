# Phase 5: KPIs Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 05-kpis-page
**Areas discussed:** List page polish, Builder wizard polish, Detail panel polish, CRUD + rendering verification

---

## List Page — Card Accent Color

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregation type color | SUM=emerald, AVG=blue, COUNT=violet, MIN/MAX=amber, COUNT_DISTINCT=teal | ✓ |
| Fixed primary accent | All KPI cards get primary/blue left border | |
| Threshold-tinted accent | Use live threshold color (green/amber/red) as border | |

**User's choice:** Aggregation type color (Recommended)
**Notes:** This is a library page — threshold accents would be misleading. Aggregation type provides stable categorization signal, matching how chart library uses chart-type colors.

---

## Builder Wizard Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Match Phase 4 chart builder | Accordion motion, preview crossfade, step completion checkmark | ✓ |
| Light polish only | Just accordion motion transitions | |
| No builder changes | Focus elsewhere | |

**User's choice:** Match Phase 4 chart builder (Recommended)

---

## Detail Panel Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Full mirror of Phase 4 | Sheet motion, section icons, threshold accent, sticky footer | ✓ |
| Light polish | Just Sheet motion entrance | |
| No panel changes | Panel already works | |

**User's choice:** Full mirror (Recommended)

---

## Verification Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full Playwright E2E | Create → all 5 steps → save → verify counter → edit → delete. Light + dark. | ✓ |
| Manual spot check | Verify CRUD and counters render | |
| CRUD only | Just create/edit/delete | |

**User's choice:** Full Playwright E2E (Recommended)

---

## Claude's Discretion

- Exact animation timing for builder step transitions
- Aggregation-to-color exact mapping (suggested mapping may be adjusted)
- Detail panel section layout
- Builder preview animation specifics
- Whether aggregation badge on cards gets accent color treatment

## Deferred Ideas

None — discussion stayed within phase scope.
