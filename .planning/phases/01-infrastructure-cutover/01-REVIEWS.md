---
phase: 1
reviewers: [gemini]
reviewed_at: 2026-04-12
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md, 01-05-PLAN.md, 01-06-PLAN.md]
---

# Cross-AI Plan Review — Phase 1

## Gemini Review

This review covers implementation plans **01-01 through 01-06** for Phase 1: Infrastructure Cutover of the RecViz project.

### 1. Summary
The implementation plans are exceptionally detailed, demonstrating a deep understanding of both the RecViz codebase and the specific quirks of Oracle 19c (e.g., thick mode requirements, `BLOB IS JSON` storage, and DDL auto-commit behavior). The transition from Oracle Cloud to local Docker is handled smoothly, and the "Mist+Blue" colorization strategy is well-integrated into the global CSS variables. The hard enforcement of thick mode via startup assertions is a standout safety feature that directly addresses the project's history of environmental drift.

### 2. Strengths
* **Thick Mode Enforcement:** The startup assertion querying `v$session_connect_info.client_driver` is a robust "kill switch" that prevents the app from running in an unsupported (Thin) state.
* **Surgical Oracle Migration:** Moving from 7 legacy PG migrations to a single, hand-reviewed `001_initial_oracle_schema.py` ensures a clean baseline for the new infrastructure.
* **Intelligent Type Mapping:** Implementing `OracleJSON` via `TypeDecorator` and `SchemaType` to auto-emit `IS JSON` check constraints is the correct idiomatic approach for Oracle 19c's lack of a native JSON type.
* **Palette Future-Proofing:** Rewiring `chart-themes.ts` to read CSS variables at runtime ensures that charts will automatically respect theme toggles and palette changes without further JS modifications.
* **Clean Residue Removal:** The inclusion of a repo-wide grep audit for banned tech (Postgres, Redis, etc.) ensures the milestone's "zero residue" goal is met empirically.

### 3. Concerns
* **HIGH: Initialization Order in `main.py`:** `oracledb.init_oracle_client` must be called before *any* module imports `oracledb`. While the plan places the call before `from app.*` imports, any utility imports (like `logging` or `os`) that might transitively touch a DB-related module could trigger an early, irreversible thin-mode lock.
* **MEDIUM: Seed Script Parity:** `scripts/seed-oracle.py` is a stripped-down version of a much larger PG script. If subsequent page phases (e.g., Phase 3 Datasets) rely on specific complex data relationships not present in the new "minimal" script, developers may hit friction during manual verification.
* **MEDIUM: Oracle Identifier Limits:** While Oracle 19c generally supports 128-byte identifiers, the naming convention results (e.g., `ck_recviz_connections_extra_params_json`) reach ~40 bytes. If the production `COMPATIBLE` parameter is set low, these could fail. (The plan notes this for audit in Phase 8, which is acceptable).
* **LOW: `getComputedStyle` Timing:** Using `getComputedStyle` in `chart-themes.ts` requires the DOM to be fully painted for accurate color resolution. If charts are initialized via a high-priority effect, they might capture "neutral" gray values before the Mist+Blue variables are computed.

### 4. Suggestions
* **Validation of `v$session_connect_info` Access:** In Plan 06, explicitly include a check for the `SELECT` privilege on the `v$` view before running the backend. Some restricted Docker environments may require `GRANT SELECT ON v_$session_connect_info TO recviz` specifically.
* **Alembic Migration Guard:** In `001_initial_oracle_schema.py`, add a manual check or comment reminding users that `DROP TABLE` in Oracle auto-commits, making `alembic downgrade` risky if interrupted.
* **Chart Color Fallbacks:** In `chart-themes.ts`, provide hard-coded hex fallbacks inside `resolveColor` to prevent charts from disappearing if CSS variables fail to load (e.g., in a headless testing environment if one is added later).

### 5. Risk Assessment
**Overall Risk: MEDIUM**

The technical risk is centered on the total infrastructure swap (DB engine, driver, and async removal). However, the mitigation strategies provided — specifically the thick-mode startup check, the 9-point Alembic checklist, and the systemic grep audits — are highly effective. The lack of automated tests is the primary reason for the "Medium" rather than "Low" rating, but the comprehensive end-to-end smoke test in Plan 06 provides sufficient manual coverage for this brownfield cutover.

---

## Consensus Summary

*Single reviewer (Gemini) — consensus analysis requires 2+ reviewers.*

### Key Takeaways
- Plans are assessed as "exceptionally detailed" with strong Oracle-specific knowledge
- HIGH concern: `oracledb.init_oracle_client` initialization order in main.py — transitive imports could trigger thin-mode lock
- MEDIUM concern: Seed script may be too minimal for later page phases
- MEDIUM concern: Oracle identifier limits if COMPATIBLE is set low on Citi prod
- LOW concern: getComputedStyle timing for chart color resolution
- Overall risk rated MEDIUM — mitigated by thick-mode assertion, Alembic checklist, and grep audits
