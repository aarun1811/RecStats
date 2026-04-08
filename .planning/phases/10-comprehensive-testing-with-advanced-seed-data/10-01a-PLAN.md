---
phase: 10-comprehensive-testing-with-advanced-seed-data
plan: 01a
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/mock-audit.sh
  - frontend/e2e/_fixtures.ts
  - backend/tests/test_seed_script.py
  - frontend/src/hooks/use-chart-data.ts
  - frontend/src/hooks/use-kpi-data.ts
  - frontend/src/hooks/use-breaks-data.ts
  - frontend/src/hooks/use-prefetch.ts
  - frontend/src/types/index.ts
  - frontend/src/components/charts/ag-chart-wrapper.tsx
  - backend/app/api/charts.py
  - backend/app/api/custom.py
  - backend/app/api/router.py
  - backend/app/config/dashboards/chart-showcase.json
  - backend/app/config/dashboards/tlm-stats.json
autonomous: false
requirements:
  - INFR-04
  - INFR-06
  - CHRT-01
  - CHRT-02

must_haves:
  truths:
    - "User has reviewed and approved the proposed schema + curated catalog from RESEARCH.md §1/§2 before any code runs"
    - "scripts/mock-audit.sh exists, is executable, and exits 0 after mock cleanup lands (or exits nonzero pre-cleanup with the expected offenders)"
    - "frontend/e2e/_fixtures.ts exports CURATED_DASHBOARDS, CURATED_CHARTS, CURATED_DATASETS, CURATED_KPIS constants derived from RESEARCH.md §2"
    - "frontend/e2e/_fixtures.ts DASHBOARD_NAMES constant pins the 5 dashboard names using the 'Phase 10 ·' prefix convention, which becomes the canonical source of truth for seed + runbook + E2E specs (M-3 fix)"
    - "backend/tests/test_seed_script.py scaffold exists with 15 skipped test functions (actual assertions implemented in Plan 10-01b Task 4)"
    - "All dead hooks (use-chart-data, use-kpi-data, use-breaks-data, use-prefetch) are removed from frontend/src/hooks/"
    - "frontend/src/types/index.ts (barrel export) is removed"
    - "ag-chart-wrapper.tsx Rules of Hooks violation is fixed — containerRef and containerSize hoisted above all early returns"
    - "backend/app/api/charts.py and backend/app/api/custom.py are deleted; router.py no longer imports or mounts them"
    - "Legacy JSON configs (chart-showcase.json, tlm-stats.json, showcase_*, tlm_*, reconmgmt_* data sources) are deleted"
    - "Full test suite green after cleanup: vitest run + playwright test (existing specs still pass pre-rewrite) + pytest backend/tests/"
  artifacts:
    - path: "scripts/mock-audit.sh"
      provides: "Executable grep sweep that exits 0 when no mock/fallback offenders remain"
      contains: "CHART_DATASOURCE_MAP"
    - path: "frontend/e2e/_fixtures.ts"
      provides: "Shared E2E fixture map of curated dashboards/charts/datasets/kpis, waitForDashboardLoad helper, and DASHBOARD_NAMES canonical name list"
      contains: "DASHBOARD_NAMES"
    - path: "backend/tests/test_seed_script.py"
      provides: "Scaffold of 15 skipped pytest functions (assertions land in Plan 10-01b Task 4)"
      contains: "test_dataset_data_source_pairing"
  key_links:
    - from: "scripts/mock-audit.sh"
      to: "backend/app/api/ + frontend/src/hooks/"
      via: "grep sweep for deleted offender patterns"
      pattern: "CHART_DATASOURCE_MAP|use-chart-data|use-prefetch"
    - from: "frontend/e2e/_fixtures.ts DASHBOARD_NAMES constant"
      to: "scripts/seed-postgres.py CURATED_DASHBOARDS[*].name (Plan 10-01b) AND 10-UAT-RUNBOOK.md phase 8 section headings (Plan 10-01c)"
      via: "canonical prefix convention 'Phase 10 · {Title}' pinned here, referenced by seed script as the source of truth for dashboard.name, cross-checked by test_dashboard_names_match_fixtures in Plan 10-01b"
      pattern: "Phase 10 ·"

user_setup: []
---

<objective>
Plan 10-01a is the first of three sub-plans splitting the original Plan 10-01 (which exceeded the 5-task / 15-file scope ceiling per Dimension 5). This sub-plan covers: (Task 0) the schema + catalog approval gate per D-03, (Task 1) Wave 0 test infrastructure, and (Task 2) mock cleanup per CONCERNS.md §3.1–3.5.

Plan 10-01a does NOT rewrite the seed script and does NOT rewrite E2E specs — those land in 10-01b and 10-01c respectively. This split keeps each sub-plan focused and under budget.

Purpose: Deliver the approval gate, the Wave 0 test harness, and a clean codebase so Plan 10-01b can rewrite the seed script against a known-clean baseline. The A10 dual-row pairing guard scaffold is in place; its assertions are implemented in 10-01b Task 4 once the seed script generators exist.

Output: Approved schema/catalog, mock-audit.sh, _fixtures.ts (with DASHBOARD_NAMES pinning the canonical prefix convention), test_seed_script.py scaffold, dead code removed, RoH fix committed, legacy routers + configs deleted.
</objective>

<execution_context>
@/Users/aarun/Workspace/Projects/RecViz/.claude/get-shit-done/workflows/execute-plan.md
@/Users/aarun/Workspace/Projects/RecViz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-CONTEXT.md
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-VALIDATION.md
@.planning/codebase/STACK.md
@.planning/codebase/STRUCTURE.md
@.planning/codebase/TESTING.md
@.planning/codebase/CONCERNS.md
@CLAUDE.md

<interfaces>
<!-- Key types the executor needs. Extracted from the codebase verbatim. -->

ag-chart-wrapper.tsx Rules of Hooks violation target (frontend/src/components/charts/ag-chart-wrapper.tsx lines ~220-400):
- Existing `useRef<HTMLDivElement>(null)` at line ~230 — the chart container ref used by AG Charts.
- Existing `useState(() => getAgChartsTheme())` at line ~246.
- BUG: A SECOND `useRef<HTMLDivElement>(null)` for containerRef and a `useState<{width, height} | null>(null)` for containerSize exist at lines ~378-379, AFTER the early returns at lines 349-376 (missingColumns, isLoading, error, empty-data guards).
- FIX: Move those two hooks (plus the associated ResizeObserver `useEffect`) to immediately after the existing `useState(() => getAgChartsTheme())` call.

test_seed_script.py module loader pattern:
```python
import importlib.util
import pathlib
import pytest

_SEED_PATH = pathlib.Path(__file__).resolve().parents[2] / "scripts" / "seed-postgres.py"

def _load_seed_module():
    spec = importlib.util.spec_from_file_location("seed_postgres", _SEED_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
```
NOTE: scripts/seed-postgres.py must be structured so main() is guarded by `if __name__ == "__main__":`. Generator helpers must be top-level. This is enforced in Plan 10-01b Task 3.

KPI threshold direction (from frontend/src/lib/kpi-utils.ts:5-13 — RESEARCH.md Q-4 RESOLUTION):
```typescript
export function getThresholdLevel(value, thresholds): ThresholdLevel {
  if (!thresholds) return 'none'
  if (value >= thresholds.greenAbove) return 'green'
  if (value >= thresholds.amberAbove) return 'amber'
  return 'red'
}
```
No direction flag. Thresholds are literal "higher = better". Inverted KPIs use numerically-inverted threshold values per Q-4 RESOLVED (see RESEARCH.md §Open Questions Q-4).

Chart library routes (from frontend/src/routes/_app/charts/new.tsx and $chartId.edit.tsx — RESEARCH.md Q-5 RESOLUTION):
- `/charts/new` → single page, `<ChartBuilder mode="create" />`, accordion wizard with local state (STEP_ORDER = ['dataset', 'type', 'mapping', 'appearance']). No URL segments per step.
- `/charts/:chartId/edit` → single page, `<ChartBuilder mode="edit" />`.
Plan 10-02 walks these as single URLs.
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Grep audit script → backend/app/ + frontend/src/ | Pure read-only file scan; no boundary crossed |
| Developer machine → Git working tree | Mock cleanup deletes files; boundary is trusted dev-only but still exercised |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10a-01 | Tampering (T) | Mock cleanup deleting files that are secretly live dependencies | mitigate | Task 2 Step 1 greps for each hook name across `frontend/src` before deletion. Expected: zero hits. Any non-zero result halts the task with a report. Same for barrel export and backend legacy routers. |
| T-10a-02 | Information disclosure (I) | mock-audit.sh exposing actual secrets while grepping | mitigate | mock-audit.sh scans only `backend/app/` and `frontend/src/` — production code paths — and excludes `*.test.*`, `e2e/`, `node_modules/`, `.venv/`, `backend/tests/`, `.env*`, `*.lock`, `dist/`, `build/`. Grep patterns target code literals (CHART_DATASOURCE_MAP, use-prefetch), not secret patterns. |
| T-10a-03 | Elevation of privilege (E) | Deleting backend routers that unexpectedly expose auth gates | accept | No auth in v1 per PROJECT.md. Legacy routers (`charts.py`, `custom.py`) are confirmed dead per CONCERNS.md §3.4–3.5 — they are not serving any live endpoint. |

All high-rated threats have explicit mitigations.
</threat_model>

<tasks>

<task type="checkpoint:decision" gate="blocking">
  <name>Task 0: SCHEMA + CATALOG APPROVAL GATE (D-03)</name>
  <files>.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md (READ-ONLY)</files>
  <read_first>
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md (full §1 Proposed Schema and full §2 Curated Catalog)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §Open Questions (RESOLVED) — all 6 questions now have concrete answers; reference them in the summary
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-CONTEXT.md (D-03, D-04, D-05 — user decisions this task must honor)
  </read_first>
  <decision>Do you approve the proposed recon_data schema (§1) and the curated catalog of 16 datasets + 24 charts + 12 KPIs + 5 dashboards (§2) from 10-RESEARCH.md, so the seed script rewrite in Plan 10-01b can proceed?</decision>
  <context>
Per D-03, the schema and catalog MUST be presented for explicit user approval before any code runs. Once the seed lands, the shapes and entity catalog are hard to change because downstream plans (E2E specs in 10-01c, UAT runbook in 10-01c, Plan 10-02 walkthrough) reference the stable slugs.
  </context>
  <action>
Post a concise summary (Claude composes, pastes inline in the task reply) covering these exact items:

1. **Schema summary:** 8 dimension tables (recon_engines ×5, regions ×10, desks ×25, currencies ×30, statuses ×8, aging_buckets ×6, counterparties ×200, accounts ×5000) + 4 fact tables (recon_transactions ×100000, recon_breaks ×20000, recon_match_events ×80000, sla_events ×5000). Full DDL lives in RESEARCH.md §1.2 and §1.3 — reference the line ranges, do not re-paste the full DDL.
2. **Edge cases baked in:** NULLs in counterparty_id (~5%), fee (~15%), fx_rate (100% of USD rows); 100k unique external_ref; leap-day row on 2024-02-29; DST spring-forward rows on 2024-03-10; year-boundary rows on 2024-12-31/2025-01-01; ~10% negative amounts.
3. **Curated catalog summary:** 16 datasets, 24 charts covering every AG + ECharts type EXCEPT sunburst, 12 KPIs covering all 4 formats × 3 trend modes × all 3 threshold bands, 5 dashboards with names prefixed `Phase 10 ·` (M-3 convention): `Phase 10 · SLA Overview`, `Phase 10 · Aging Analysis`, `Phase 10 · Match Rate Tracker`, `Phase 10 · Volume Dashboard`, `Phase 10 · Breaks Summary`.
4. **Resolved open questions (reference RESEARCH.md §Open Questions RESOLVED):**
   - Q-1: canonical reset = `docker compose down -v && docker compose up -d && python scripts/seed-postgres.py`
   - Q-3: sunburst skipped, documented as known limitation
   - Q-3b: `chart-txn-trend-area` placed on `dash-volume` (D4 grows to 7 charts)
   - Q-4: KPI thresholds are literal "higher=better"; inverted KPIs (`kpi-total-breaks`, `kpi-avg-aging-days`, `kpi-sla-breach-rate`) use numerically-inverted threshold values with config comments
   - Q-5: `/charts/new` is a single-page accordion wizard (no URL segments per step)
   - Q-6: drill-detail data sources covered by A10 pairing guard
5. **Pause and ask the user:** "Do you approve these schema and catalog decisions? Options: `approve` → proceed to Task 1 / `modify` → discuss changes / `reject` → halt and re-plan."
  </action>
  <verify>
    <automated>MISSING — this is a human decision gate per D-03. Verification is the user response.</automated>
  </verify>
  <done>
User types "approve" (or equivalent). If user requests modifications, Task 0 loops with the updated summary until explicit approval. If user rejects, this plan halts and the planner re-runs with the new constraints.
  </done>
  <resume-signal>Type "approve" to proceed, or describe required changes to the schema/catalog.</resume-signal>
</task>

<task type="auto" tdd="true">
  <name>Task 1: Wave 0 — Build test infrastructure (mock-audit.sh + _fixtures.ts with DASHBOARD_NAMES + test_seed_script.py scaffold)</name>
  <files>scripts/mock-audit.sh, frontend/e2e/_fixtures.ts, backend/tests/test_seed_script.py</files>
  <read_first>
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §3.9 (grep patterns to encapsulate in mock-audit.sh)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-VALIDATION.md (Wave 0 requirements — the exact 15 tests)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §2.1, §2.2, §2.3, §2.4 (the stable slug lists and dashboard names)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §Architecture Pattern 3 (the 'Phase 10 ·' name prefix convention)
    - frontend/e2e/chart-showcase.spec.ts (existing waitForDashboardLoad helper pattern)
    - backend/tests/test_managed_datasets.py (existing pytest structure)
    - .planning/codebase/TESTING.md (project test conventions)
  </read_first>
  <behavior>
    - mock-audit.sh exits 0 when ALL these hold: no `CHART_DATASOURCE_MAP` or `CHART_QUERIES` in backend/app/, no `use-chart-data.ts` / `use-kpi-data.ts` / `use-breaks-data.ts` / `use-prefetch.ts` files in frontend/src/hooks/, no `frontend/src/types/index.ts` file, no `from "@/types"` imports (barrel), no `Lorem`/`lorem_ipsum`/`placeholder data`/`TODO: replace with real` in production paths, no hardcoded integer dataset_id literals in backend/app/api/ Python assignment statements.
    - mock-audit.sh exits 1 when any offender is found, printing each hit with file:line.
    - mock-audit.sh MUST exclude: `*.test.*`, `e2e/`, `node_modules/`, `.venv/`, `backend/tests/`, `backend/app/migrations/`, `dist/`, `build/`, `__pycache__/`, `.env*`, `*.lock`.
    - _fixtures.ts exports a `CURATED_DASHBOARDS` const with EXACTLY these entries using the 'Phase 10 ·' prefix: {sla: {id: 'dash-sla', name: 'Phase 10 · SLA Overview'}, aging: {id: 'dash-aging', name: 'Phase 10 · Aging Analysis'}, matchRate: {id: 'dash-match-rate', name: 'Phase 10 · Match Rate Tracker'}, volume: {id: 'dash-volume', name: 'Phase 10 · Volume Dashboard'}, breaksSummary: {id: 'dash-breaks-summary', name: 'Phase 10 · Breaks Summary'}}.
    - _fixtures.ts exports a `DASHBOARD_NAMES` const — the canonical source of truth for dashboard.name values. Shape: `export const DASHBOARD_NAMES = {'dash-sla': 'Phase 10 · SLA Overview', ...}`. The seed script in Plan 10-01b Task 3 MUST mirror these exact strings via a generated JSON snapshot at `frontend/e2e/_dashboard-names.json` (generated by the seed) that the fixture file imports. This provides the cross-check loop used by `test_dashboard_names_match_fixtures` in Plan 10-01b Task 4. (M-3 fix)
    - _fixtures.ts exports `CURATED_CHARTS`, `CURATED_DATASETS`, `CURATED_KPIS` maps with stable slug → human name.
    - _fixtures.ts exports `waitForDashboardLoad(page, dashboardName)` that waits for h1 + asserts 0 skeletons within 15s.
    - test_seed_script.py SCAFFOLD only at this task. Includes: pytest imports, `_load_seed_module()` helper, 15 placeholder test functions all decorated with `@pytest.mark.skip(reason="Plan 10-01b Task 4 will unskip and implement")`. The critical one (`test_dataset_data_source_pairing`) has a detailed docstring explaining the A10 dual-row pattern. New additional scaffold test: `test_dashboard_names_match_fixtures` — placeholder that asserts the seed-emitted dashboard names in CURATED_DASHBOARDS map match the DASHBOARD_NAMES constant in `frontend/e2e/_fixtures.ts` (M-3 cross-check).
  </behavior>
  <action>
**Step 1 — Write scripts/mock-audit.sh.** Create the file with `#!/usr/bin/env bash`, `set -euo pipefail`, an EXCLUDES array, and a `check()` function using `grep -rn --include='*.py' --include='*.ts' --include='*.tsx' <pattern> backend/app frontend/src` with excludes. Accumulate hits. After all patterns run, if hit counter > 0, print all hits and exit 1; else print `mock-audit: clean` and exit 0. Patterns (copy verbatim):
- `CHART_DATASOURCE_MAP`
- `CHART_QUERIES`
- `use-chart-data` (as filename — `find frontend/src/hooks -name 'use-chart-data.ts' 2>/dev/null`)
- `use-kpi-data` (find)
- `use-breaks-data` (find)
- `use-prefetch` (find)
- `frontend/src/types/index.ts` (test -f)
- `from ['"]@/types['"];?$` (barrel import regex at end of line)
- `[Ll]orem [Ii]psum`
- `placeholder data`
- `TODO.*replace with real` (case-insensitive)
- Hardcoded integer dataset_id in Python assignment (scoped per m-3 fix): `^[^#]*datasource_id\s*=\s*[0-9]+` with `--include="*.py"` and `--exclude-dir=tests` to skip test fixtures.

Make executable via `chmod +x scripts/mock-audit.sh`. Use `bash scripts/mock-audit.sh` invocation in verify.

**Step 2 — Write frontend/e2e/_fixtures.ts.** Paste the const definitions exactly:
```typescript
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

// Canonical source of truth for dashboard names. The seed script in Plan 10-01b
// mirrors these strings exactly. Cross-checked by test_dashboard_names_match_fixtures
// in Plan 10-01b Task 4.
export const DASHBOARD_NAMES = {
  'dash-sla': 'Phase 10 · SLA Overview',
  'dash-aging': 'Phase 10 · Aging Analysis',
  'dash-match-rate': 'Phase 10 · Match Rate Tracker',
  'dash-volume': 'Phase 10 · Volume Dashboard',
  'dash-breaks-summary': 'Phase 10 · Breaks Summary',
} as const

export const CURATED_DASHBOARDS = {
  sla: { id: 'dash-sla', name: DASHBOARD_NAMES['dash-sla'] },
  aging: { id: 'dash-aging', name: DASHBOARD_NAMES['dash-aging'] },
  matchRate: { id: 'dash-match-rate', name: DASHBOARD_NAMES['dash-match-rate'] },
  volume: { id: 'dash-volume', name: DASHBOARD_NAMES['dash-volume'] },
  breaksSummary: { id: 'dash-breaks-summary', name: DASHBOARD_NAMES['dash-breaks-summary'] },
} as const

// 24 charts from RESEARCH.md §2.2 — paste the full slug list.
export const CURATED_CHARTS = {
  // ... populated from RESEARCH.md §2.2 (all 24)
} as const

// 16 datasets from RESEARCH.md §2.1.
export const CURATED_DATASETS = {
  // ... populated from RESEARCH.md §2.1 (all 16)
} as const

// 12 KPIs from RESEARCH.md §2.3.
export const CURATED_KPIS = {
  // ... populated from RESEARCH.md §2.3 (all 12)
} as const

export async function waitForDashboardLoad(page: Page, dashboardName: string): Promise<void> {
  await page.locator('h1', { hasText: dashboardName }).waitFor({ state: 'visible', timeout: 15_000 })
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 15_000 })
}
```

Fill in the `// ...` sections with the ACTUAL slug lists from RESEARCH.md §2.1, §2.2, §2.3 — do not abbreviate.

**Step 3 — Write backend/tests/test_seed_script.py.** Import pattern:
```python
import importlib.util
import json
import pathlib
import pytest

_SEED_PATH = pathlib.Path(__file__).resolve().parents[2] / "scripts" / "seed-postgres.py"
_FIXTURES_PATH = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "e2e" / "_fixtures.ts"

def _load_seed_module():
    spec = importlib.util.spec_from_file_location("seed_postgres", _SEED_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
```

Add the 15 test functions listed in VALIDATION.md lines 85-101 verbatim, each decorated with `@pytest.mark.skip(reason="Plan 10-01b Task 4 will unskip and implement")`. Add a 16th test `test_dashboard_names_match_fixtures` (also skipped) with docstring explaining the M-3 cross-check: it will parse `frontend/e2e/_fixtures.ts` DASHBOARD_NAMES via regex and compare against the seed module's CURATED_DASHBOARDS name values.

Detailed `test_dataset_data_source_pairing` docstring must explain the A10 dual-row pattern.
  </action>
  <verify>
    <automated>bash scripts/mock-audit.sh; echo "mock-audit exit=$?" && cd frontend && pnpm exec tsc --project tsconfig.e2e.json --noEmit && cd ../backend && python -m pytest tests/test_seed_script.py -v 2>&1 | grep -E "(skipped|passed|error)"</automated>
  </verify>
  <done>
(1) scripts/mock-audit.sh exists and runs without shell syntax errors; (2) frontend/e2e/_fixtures.ts type-checks and exports DASHBOARD_NAMES + CURATED_* constants + waitForDashboardLoad; (3) backend/tests/test_seed_script.py collects 16 test functions with `@pytest.mark.skip` decorators (pytest output shows `16 skipped` not `collection error`).
  </done>
</task>

<task type="auto">
  <name>Task 2: Mock cleanup — delete dead hooks, barrel export, legacy routers; fix RoH violation</name>
  <files>
    frontend/src/hooks/use-chart-data.ts (DELETE),
    frontend/src/hooks/use-kpi-data.ts (DELETE),
    frontend/src/hooks/use-breaks-data.ts (DELETE),
    frontend/src/hooks/use-prefetch.ts (DELETE),
    frontend/src/types/index.ts (DELETE),
    frontend/src/components/charts/ag-chart-wrapper.tsx (EDIT),
    backend/app/api/charts.py (DELETE),
    backend/app/api/custom.py (DELETE),
    backend/app/api/router.py (EDIT — remove imports + mounts),
    backend/app/config/dashboards/chart-showcase.json (DELETE),
    backend/app/config/dashboards/tlm-stats.json (DELETE),
    backend/app/config/data_sources/*.json (DELETE showcase_*, tlm_*, reconmgmt_* only)
  </files>
  <read_first>
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §3.1 through §3.5 (enumerated offender list)
    - frontend/src/components/charts/ag-chart-wrapper.tsx (lines 200-400 — full component structure)
    - backend/app/api/router.py (full file — understand import order)
    - backend/app/api/charts.py (confirm CHART_DATASOURCE_MAP + CHART_QUERIES before deleting)
    - backend/app/api/custom.py (confirm /api/custom/kpi hardcoded dataset IDs before deleting)
    - .planning/codebase/CONCERNS.md §"Legacy hooks reference non-existent store property" and §"Hardcoded Superset dataset IDs in legacy charts API"
  </read_first>
  <action>
**Step 1 — Delete the 4 dead hooks.** Before deleting, grep each hook name across `frontend/src` to verify no active consumer. Expected: zero hits. Any hit = STOP and report.

Remove:
- `frontend/src/hooks/use-chart-data.ts`
- `frontend/src/hooks/use-kpi-data.ts`
- `frontend/src/hooks/use-breaks-data.ts`
- `frontend/src/hooks/use-prefetch.ts`

**Step 2 — Delete the barrel export.** Remove `frontend/src/types/index.ts`. Before: grep for `from '@/types'` and `from "@/types"` across `frontend/src` — expected zero hits.

**Step 3 — Fix the Rules of Hooks violation in ag-chart-wrapper.tsx.** Read the file. Locate the existing `useRef<HTMLDivElement>(null)` at line ~230 and `useState(() => getAgChartsTheme())` at line ~246. The bug: a SECOND `useRef<HTMLDivElement>(null)` for containerRef and a `useState<{width, height} | null>(null)` for containerSize sit AFTER the early returns on lines 349-376 (missingColumns, isLoading, error, empty-data guards).

**Fix:** Move both hooks to immediately AFTER the existing `useState(() => getAgChartsTheme())` call. Also move the associated ResizeObserver `useEffect` that wires against containerRef — it MUST move with containerSize to keep declaration order consistent.

Verify with: `cd frontend && pnpm exec tsc --project tsconfig.app.json --noEmit`.

Add a unit test case in `frontend/src/components/charts/ag-chart-wrapper.test.ts` (append to existing describe) that renders with `{ isLoading: true }`, then `{ error: "x" }`, then `{ data: { data: [] } }`, asserting no "Rendered fewer hooks" warnings via `vi.spyOn(console, 'error')`.

**Step 4 — Delete the legacy backend routers.**
- `rm backend/app/api/charts.py`
- `rm backend/app/api/custom.py`

Edit `backend/app/api/router.py`: remove the `from . import charts` and `from . import custom` lines, and the `router.include_router(charts.router)` and `router.include_router(custom.router)` lines. Do NOT touch `managed_charts` or any other import.

After editing, `cd backend && python -c "from app.api import router"` must succeed.

**Step 5 — Delete legacy JSON configs:**
- `rm backend/app/config/dashboards/chart-showcase.json`
- `rm backend/app/config/dashboards/tlm-stats.json`
- `rm backend/app/config/data_sources/showcase_*.json`
- `rm backend/app/config/data_sources/tlm_*.json`
- `rm backend/app/config/data_sources/reconmgmt_*.json`

Only those three prefix patterns. Leave any other data source configs.

**Step 6 — Run mock-audit.sh to confirm cleanup:**
```
bash scripts/mock-audit.sh
```
Expected: exit 0 with `mock-audit: clean`. If exit 1, read hits and address.
  </action>
  <verify>
    <automated>bash scripts/mock-audit.sh && cd frontend && pnpm vitest run ag-chart-wrapper && pnpm exec tsc --project tsconfig.app.json --noEmit && cd ../backend && python -m pytest tests/ -x --ignore=tests/test_seed_script.py</automated>
  </verify>
  <done>
mock-audit.sh exits 0. Frontend unit tests pass including the new RoH guard test. Backend pytest passes (excluding scaffold test_seed_script.py still skipped). TypeScript check passes with zero errors.
  </done>
</task>

</tasks>

<verification>
Plan 10-01a is complete when:

1. Task 0 schema + catalog gate was approved by the user
2. `bash scripts/mock-audit.sh` exits 0 with "mock-audit: clean"
3. `cd frontend && pnpm vitest run` passes (including new ag-chart-wrapper RoH guard test)
4. `cd backend && python -m pytest tests/ -v --ignore=tests/test_seed_script.py` passes
5. `cd backend && python -m pytest tests/test_seed_script.py -v` shows `16 skipped` (scaffold only)
6. `frontend/e2e/_fixtures.ts` type-checks and exports DASHBOARD_NAMES, CURATED_DASHBOARDS, CURATED_CHARTS, CURATED_DATASETS, CURATED_KPIS, waitForDashboardLoad
7. Dead hooks, barrel export, legacy routers, legacy JSON configs all removed
</verification>

<success_criteria>
After Plan 10-01a:
- The approval gate has passed
- The Wave 0 test harness exists with all the scaffolding Plan 10-01b Task 4 needs to unskip
- The codebase is clean of mock/fallback offenders
- The M-3 dashboard naming convention is pinned in `_fixtures.ts` DASHBOARD_NAMES as the canonical source of truth
- Plan 10-01b can proceed immediately
</success_criteria>

<output>
After completion, create `.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-01a-SUMMARY.md` documenting:
- Approval decision from Task 0 (approve / modify / reject + any notes)
- Mock cleanup outcomes (files deleted, RoH fix committed)
- Test harness file paths and line counts
- DASHBOARD_NAMES canonical constant location
- mock-audit.sh first clean run output
</output>
