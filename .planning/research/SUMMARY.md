# Research Synthesis — Oracle-Only Cutover + Frontend Colorization

**Synthesized:** 2026-04-11
**Milestone:** Oracle-Only Cutover + Frontend Colorization (brownfield consolidation)
**Sources:** `SHADCN_COLOR.md`, `ORACLE_CLOUD.md`, `ORACLE_SQLALCHEMY.md`
**Consumer:** Phase 1 DISCUSS + PLAN gates, then page-by-page phases 2–7
**Overall confidence:** HIGH

---

## TL;DR

- **Oracle Cloud Always Free Autonomous 19c is still provisionable in 2026** — explicit 19c radio at provisioning time, Transaction Processing workload, Always Free toggle. The path is real and free, but the user has ~1 hour of manual click-ops + wallet + Instant Client setup **before** any Phase 1 code work can start.
- **Character set parity has an honest gap.** Local Cloud is hard-locked to `AL32UTF8`/`AL16UTF16`; Citi prod is NCS 871 (CESU-8). Mitigation is "force thick mode locally and fail loud if thin mode ever engages" — not actual parity.
- **Sync SQLAlchemy 2 + `oracledb` thick mode has one correct incantation**: pass `thick_mode` as a **dict of kwargs** (not `True`) directly to `create_engine`, **never** call `oracledb.init_oracle_client()` yourself. Conditionally include `lib_dir` (macOS only; never on Linux prod). Everything else flows from this.
- **JSON storage on Oracle 19c = `BLOB IS JSON`** via a rewritten `OracleJSON` `TypeDecorator + SchemaType` that attaches a `CheckConstraint` in `_set_table`. No native JSON type on 19c. All six `recviz_*` models already use `String(128)` UUID PKs, so zero sequence/identity work is needed.
- **Shadcn's "new color thing" is a preset registry + `npx shadcn apply` workflow**, plus four new base colors (mauve/olive/mist/taupe). Recommendation: **Mist base + Blue accent**, with a Strategy-B chart palette (keep shadcn `--chart-1..5` for sequential, add `--series-1..8` for categorical multi-series). `frontend/src/lib/chart-themes.ts` hard-coded hex is the single biggest blocker to colorization landing cleanly.

---

## Key Findings

### Shadcn Color System (`SHADCN_COLOR.md`)

**Timeline:** Feb 2025 Tailwind v4 theming refresh (OKLCH, `@theme inline`, `.dark` class — RecViz already on this); Oct–Nov 2025 four new base colors (mauve/olive/mist/taupe); Dec 2025 `npx shadcn create` interactive picker at `ui.shadcn.com/create`; Mar 2026 `shadcn/cli v4` with `registry:base` payloads and the Luma style (rejected for RecViz); Apr 2026 `npx shadcn apply --preset <id>` patches existing `index.css` in place.

**Recommended palette — Option B: Mist base + Blue accent (★)**
- **Mist** (new Oct-Nov 2025 base) — cool-grey with faint blue undertone, chroma ≤ 0.021. Quietly cool, plays well with blue actions.
- **Blue accent** — `--primary: oklch(0.488 0.243 264.376)` light / `oklch(0.424 0.199 265.638)` dark. Applies to primary, sidebar rail, focus ring, `--chart-1..5`.
- Three backup options: Stone+Blue, Zinc+Indigo, Stone+Teal. Mauve/Olive/Taupe explicitly rejected (tone mismatch for banking).

**CRITICAL blockers to colorization landing:**
- **`frontend/src/lib/chart-themes.ts` hard-codes a 10-colour series array** at line 84. Also hard-codes heatmap/treemap/waterfall overrides. **This is why a palette swap alone won't colorize charts** — the file doesn't read CSS variables for series slots. Must be rewired in Phase 1.
- `frontend/src/components/explorer/query-results.tsx` still uses legacy `ag-theme-quartz-dark` CSS class instead of `themeQuartz.withPart(colorSchemeDark)` — Phase 7 (Explorer) cleanup.
- `frontend/src/types/chart.ts` + `frontend/src/components/charts/builder/step-appearance.tsx` may carry hard-coded hex in chart config shapes — Phase 4 (Charts) audit.
- Dashboard config JSON stored in `recviz_charts.config` (`colorRange` etc.) may carry hex colors from earlier builds — cross-phase concern.

**Must-decide in Phase 1 UI-SPEC gate:**
1. Exact base color (Mist recommended)
2. Exact accent (Blue recommended)
3. Chart palette strategy B (`--chart-1..5` sequential + `--series-1..8` categorical) vs A (shadcn-only, fails above 5 series)
4. Whether to tokenise status colors (MATCHED/UNMATCHED/PENDING) — recommendation is to **keep semantic utilities** (`text-green-600 dark:text-green-400`), status is data semantics not theme.

---

### Oracle Cloud Provisioning (`ORACLE_CLOUD.md`)

**Can we get 19c? YES.** Always Free Autonomous explicit 19c selector still available in 2026. 19c is LTS and matches what Citi runs. Pick deliberately — cannot upgrade in place without destroy+recreate. Transaction Processing workload matches Citi's OLTP-style recon load.

**Regional lock-in:** Tenancy home region chosen ONCE at signup, permanent. Always Free resources only live in home region. Safe picks: Ashburn, Phoenix, Frankfurt, London. **Confirm 19c radio appears before committing** — if it doesn't, tenancy is wasted (cannot change home region later).

**Manual USER steps before Phase 1 code work starts (~1 hr total):**
1. Sign up at signup.oraclecloud.com — email, phone (SMS, no VoIP), credit card ($1 auth reversed), billing address, pick home region
2. Provision `recvizdev` Autonomous DB — Transaction Processing, Serverless, Always Free ON, **Database version: 19c**, record admin password
3. Download **Instance Wallet** (not Regional), set wallet password (NOT the admin password)
4. Unzip to `~/.oracle/wallets/recvizdev/`, `chmod 700`/`600`
5. Edit `sqlnet.ora` — replace `DIRECTORY="?/network/admin"` with absolute path to wallet dir (otherwise thick mode looks inside Instant Client tree and fails with cert errors)
6. Download Oracle **Instant Client 23.x macOS ARM64** (native, not Rosetta — Rosetta guidance stale since June 2024). Three DMGs: basic (required), sqlplus (recommended), sdk (skip). Verify with `xcrun stapler validate`, run `install_ic.sh`, move out of `~/Downloads` to `~/oracle/instantclient_23_3`
7. `export TNS_ADMIN=~/.oracle/wallets/recvizdev` in `~/.zshrc`
8. Smoke test: `sqlplus ADMIN/"$PW"@recvizdev_low`, `SELECT sysdate FROM dual;`. **HARD GATE** — do not advance to code work until this passes.

**Character set parity gap — HONEST assessment:**
- Always Free forces `AL32UTF8` (DB) / `AL16UTF16` (national). Oracle docs confirm you **cannot change this** on Free Tier.
- Citi prod is `NCS 871` (CESU-8 UTF8, char set ID 871) — legacy pre-Unicode-3.1 encoding used by many enterprise installs.
- **We cannot reproduce NCS 871 locally. Period.** The parity goal has a real gap.
- Mitigation is procedural: (a) force thick mode locally unconditionally, (b) startup assertion that refuses boot if `v$session_connect_info.client_driver` reports `python-oracledb thn` (the `thn` suffix is the sentinel), (c) optionally add a throwaway NVARCHAR2 column to force NCHAR code path to exist locally, (d) document loudly in CLAUDE.md.

**Inactivity / quota constraints affecting ongoing dev:**
- **7 days with no connection → auto-stop** (data preserved). Weekly ping cron needed: `0 10 * * 1 sqlplus -L ADMIN/"$PW"@recvizdev_low @/dev/null || true`
- **90 cumulative stopped days → permanent reclaim + delete** (everything lost, re-provision from scratch)
- **30 simultaneous sessions hard cap on Free Tier.** SQLAlchemy pool must stay conservative: `pool_size=5, max_overflow=5` = hard ceiling of 10, leaving headroom for APEX/ORDS background sessions we don't control
- 20 GB storage cap, 1 OCPU, no scaling. Fine for dev.
- Wallet SSL cert expires after ~5 years; Oracle emails 6 weeks before. Redownload when it does.

---

### Sync SQLAlchemy + oracledb + Alembic (`ORACLE_SQLALCHEMY.md`)

**THE ONE PATTERN for thick mode:**

```python
thick_mode_args: dict[str, str] = {
    "config_dir": settings.oracle_config_dir,
    "driver_name": "recviz:1.0",
}
if settings.oracle_client_lib_dir:   # macOS only; UNSET on RHEL prod
    thick_mode_args["lib_dir"] = settings.oracle_client_lib_dir

engine = create_engine(
    settings.recviz_db_url,           # oracle+oracledb://
    thick_mode=thick_mode_args,       # DICT, not True
    connect_args={
        "user": settings.recviz_db_user,
        "password": settings.recviz_db_password.get_secret_value(),
        "dsn": settings.recviz_db_dsn,   # e.g. "recvizdev_low"
    },
    pool_size=5,                      # Free Tier 30-session cap awareness
    max_overflow=5,
    pool_pre_ping=True,
    pool_recycle=1800,                # Autonomous DB idle drops ~30 min
)
```

Rules:
- **Never** call `oracledb.init_oracle_client()` yourself — SQLAlchemy calls it lazily from engine init
- `thick_mode=True` bare bool is **wrong**: no way to override `lib_dir`/`config_dir`
- Do **not** pass `lib_dir` on Linux — Linux client libs must be on system library path before process launch
- **Once-per-process constraint**: every engine in the process must use thick mode. Audit `backend/app/services/engine_manager.py` to ensure secondary engines (user data sources) share the pattern — extract `build_oracle_engine(url, connect_args)` helper
- Password in URL is a trap (special chars `#$@` require `quote_plus`). Keep URL as `oracle+oracledb://` with empty userinfo, pass credentials via `connect_args`

**Session lifecycle — almost nothing changes.** The existing `get_db_session()` generator in `backend/app/core/dependencies.py` is already correct: sync generator, commits on success, rolls back on exception. Works under Starlette's threadpool (FastAPI runs `def` handlers in `anyio.to_thread.run_sync`, one worker thread per request, fresh `Session` per request, sessions never shared across threads). Do NOT use `scoped_session`. Do NOT convert to async.

**JSON storage — decided: `BLOB IS JSON`**
- Oracle 19c has **no native JSON datatype** (21c+, backported only to 19.24+; don't rely on it)
- `VARCHAR2` hard-capped at 4000 bytes standard / 32767 extended (not guaranteed) — dashboard configs exceed this
- `CLOB IS JSON` slower due to NLS char-set conversion on read/write
- `BLOB IS JSON` stores bytes, skips NLS pass, supports `JSON_VALUE`/`JSON_QUERY`/`JSON_TABLE`/`JSON_EXISTS`, indexable via JSON search index

**Implementation — rewrite `backend/app/db/types.py`:**
```python
class OracleJSON(TypeDecorator, SchemaType):
    impl = BLOB
    cache_ok = True
    # process_bind_param: json.dumps(value).encode("utf-8")
    # process_result_value: json.loads(value.decode("utf-8"))
    # _set_table: attach CheckConstraint(text(f'"{col}" IS JSON'), _type_bound=True)
```
`SchemaType + _set_table` needed because `TypeDecorator` alone can't attach table-level constraints. Confirmed against SQLAlchemy GitHub #10374 + #9112 (maintainer-sanctioned).

**Primary keys — NOT a problem.** All six `recviz_*` models use `String(128)` UUIDs. Zero integer autoincrement PKs, zero sequences, zero Identity, zero triggers. Least-Oracle-hostile choice possible.

**String audit passed.** Every `String(n)` column under 4000 bytes. `Text` columns (`RecvizDataset.sql`, `RecvizConnection.encrypted_password`) compile to `CLOB` — correct for both.

**Migration strategy — decided: NUKE AND REGENERATE**
- Delete `versions/001_initial_schema.py` through `versions/007_dataset_database_id_to_string.py`. All seven use PG-specific DDL (`JSONB`, `postgresql_using` casts, Superset churn). Alembic silently ignores unknown dialect kwargs, so some would "look" like they ran but do nothing on Oracle.
- Target is empty Oracle schema. Nothing to preserve.
- Run `alembic revision --autogenerate -m "initial oracle schema"` against empty Oracle.
- **Hand-review the output.** Autogenerate is not trustworthy — `IS JSON` check constraints may or may not appear. Expect hand-correction.
- Verify 9-point checklist: six tables, `BLOB IS JSON` on `config`/`columns`/`extra_params`, `VARCHAR2(128 CHAR)` PKs, `CLOB` for `sql`/`encrypted_password`, `TIMESTAMP(6) WITH TIME ZONE` defaults, expected indexes, `UniqueConstraint("name")` on `recviz_connections`.

**Oracle DDL auto-commit — gotcha.** Unlike Postgres, Oracle `CREATE TABLE` implicit-commits. Alembic's `transaction_per_migration=True` is ceremonial on Oracle — a half-applied migration cannot roll back. Recovery: manual `DROP TABLE ... CASCADE CONSTRAINTS` + re-run. Document in Phase 1 runbook. No FKs in current models (verified), so `create_table` order is safe.

**Identifier length** — `ck_recviz_connections_extra_params_is_json` is 42 bytes. Fine under Oracle Cloud default `COMPATIBLE=19.0.0` (128-byte limit), unknown for Citi prod. Phase 1 should run `SELECT name, value FROM v$parameter WHERE name = 'compatible';` and document.

**Files that change in Phase 1:**

| File | Change | Reason |
|---|---|---|
| `backend/requirements.txt` | Remove `psycopg2-binary`, `asyncpg`, `sqlalchemy[asyncio]` extra; keep `oracledb>=3.3.0`, `sqlalchemy==2.0.49` | Async/PG residue |
| `backend/app/config.py` | Add `oracle_client_lib_dir`, `oracle_config_dir`, `recviz_db_user`, `recviz_db_password: SecretStr`, `recviz_db_dsn`. Drop `recon_db_url`. Replace `recviz_db_url` default with `oracle+oracledb://` | Wallet-based config |
| `backend/app/db/engine.py` | Build `thick_mode` dict + `connect_args`; extract `build_oracle_engine()` helper | Thick mode wiring |
| `backend/app/db/base.py` | Add `MetaData(naming_convention=...)` to `Base` | Clean constraint names |
| `backend/app/db/types.py` | Rewrite — `OracleJSON(TypeDecorator, SchemaType)` via `BLOB IS JSON`, drop PG branch, keep `PortableJSON = OracleJSON` alias | 19c JSON pattern |
| `backend/app/api/views.py` | Flip 3 `async def` handlers to `def` | Async straggler |
| `backend/app/services/engine_manager.py` | Use `build_oracle_engine()` helper for secondary engines | Once-per-process constraint |
| `backend/app/main.py` lifespan | Add thick-mode startup assertion querying `v$session_connect_info` | Fail loud on thin-mode fallback |
| `backend/app/migrations/alembic.ini` | Clear `sqlalchemy.url =` | env.py owns URL |
| `backend/app/migrations/env.py` | Wire `thick_mode` + `connect_args` in online mode; add `compare_type`, `compare_server_default`, `transaction_per_migration`, `include_schemas=False`; keep `version_table="recviz_alembic_version"` | Alembic needs thick mode too |
| `backend/app/migrations/versions/001–007_*.py` | **DELETE all 7** | PG-specific, superseded |
| `backend/app/migrations/versions/001_initial_oracle_schema.py` | **CREATE** — autogen + hand review | New initial migration |
| `backend/.env.example` | Create/update with all new Oracle env vars | Documentation |

---

## Phase 1 Readiness Matrix

| Phase 1 Sub-Task | Research Source | Decided | Still TBD |
|---|---|---|---|
| Oracle Cloud provisioning | ORACLE_CLOUD §2 | Everything (19c, TP, Always Free, Instance Wallet, admin+wallet passwords) | Home region (latency-based user call) |
| Instant Client install | ORACLE_CLOUD §4 | Everything (native ARM64, 23.x, validate+install+move) | — |
| Wallet wiring | ORACLE_CLOUD §3, §5.1 | Everything (absolute DIRECTORY, TNS_ADMIN, chmod) | — |
| Async → sync stragglers | ORACLE_SQLALCHEMY §2 | Pattern (3 `def` handlers, keep `get_db_session`) | — |
| `config.py` / `.env` shape | ORACLE_SQLALCHEMY §6, ORACLE_CLOUD §5.1 | Field names, empty-URL + `connect_args` | SecretStr vs str for password |
| Thick-mode engine wiring | ORACLE_SQLALCHEMY §1 | Everything (dict-not-bool, conditional `lib_dir`, pool sizing) | — |
| Secondary engine audit | ORACLE_SQLALCHEMY §1 | Pattern (`build_oracle_engine()` helper) | Phase 1 scope vs defer |
| JSON column type | ORACLE_SQLALCHEMY §3 | `BLOB IS JSON` + `OracleJSON TypeDecorator` | Rename PortableJSON outright vs alias |
| `alembic.ini` + `env.py` rewrite | ORACLE_SQLALCHEMY §6, §7 | Everything (empty URL in ini, thick mode in online mode, four autogen flags) | `compare_server_default` timestamp churn |
| Delete old migrations | ORACLE_SQLALCHEMY §8 | Delete all 7 | Archive folder vs outright delete |
| New initial migration | ORACLE_SQLALCHEMY §8 | Nuke+regenerate via autogen + hand review | Autogen may miss `IS JSON` constraints |
| Startup thick-mode assertion | ORACLE_CLOUD §5.5 | Pattern (`v$session_connect_info.client_driver`) | — |
| Metadata naming convention | ORACLE_SQLALCHEMY §10 | Add explicit `NAMING_CONVENTION` to `Base` | — |
| Docker/PG/Superset/Redis sweep | All files | Delete docker-compose, superset/, PG seed SQL | File list needs fresh grep sweep |
| CLAUDE.md refresh | — | Done in init | User tweak decision |
| Shadcn palette pick | SHADCN_COLOR §4, §6, §7 | 4 options, Mist+Blue recommended | **Pick ONE visually in UI-SPEC** |
| Chart series tokens | SHADCN_COLOR §5 | Strategy B recommended, 8 OKLCH values captured | User confirmation |
| `chart-themes.ts` rewire | SHADCN_COLOR §8.2 | Replace hard-coded array with `resolveColor()` reads | — |
| AG Grid theme overrides | SHADCN_COLOR §8.1 | One-time `.ag-theme-quartz` block in `index.css` | — |
| Test NVARCHAR2 smoke column | ORACLE_CLOUD §7 | Recommended but optional | Discuss decision |

---

## Cross-Cutting Risks

1. **NCS 871 character-set parity gap (permanent)** — Local Cloud `AL32UTF8`/`AL16UTF16` vs prod Citi `NCS 871`. Thick mode hides this at driver level but NCHAR/NVARCHAR2-specific bugs cannot surface locally. Mitigation procedural: force thick mode, startup assertion, optional test NVARCHAR2 column, document in CLAUDE.md. Every phase touching new query paths (Datasets, Dashboards, Explorer) needs a mental "does this touch NCHAR?" check.

2. **Free Tier 7-day inactivity auto-stop + 30-session cap** — Unattended DB auto-stops (data preserved, dev flow breaks until console Start click). 90 cumulative stopped days = permanent delete. Weekly ping cron needed. Pool sizing must stay conservative across all phases.

3. **`chart-themes.ts` hard-coded hex blocks Phase 1** — Until rewired to read CSS vars, any palette swap looks partially applied (surfaces colorize, charts don't). Single biggest blocker, must be in Phase 1 scope.

4. **Hardcoded hex in chart config JSON stored in Oracle** — `recviz_charts.config` may carry hex from earlier builds. Cross-phase: Phase 4 audits, final sweep verifies.

5. **Oracle DDL auto-commit** — Half-applied migrations cannot roll back. Recovery is manual `DROP TABLE ... CASCADE CONSTRAINTS`. Phase 1 runbook must document.

6. **Oracle identifier length vs `COMPATIBLE` parameter** — Longest `IS JSON` constraint name is 42 bytes. Fine under 19c default (128-byte limit), unknown for Citi prod. Phase 1 should verify `v$parameter` on Autonomous and document for future Citi verification.

7. **Secondary engines must share thick mode** — Once-per-process constraint on `init_oracle_client()`. If `EngineManager` creates a thin-mode engine first, whole process stuck thin. Extract `build_oracle_engine()` helper, reuse. Phase 1 scope.

8. **`shadcn apply` rewrites `index.css` in place** — Custom `@layer components` rules are owned code. Git-commit before running, diff result, restore clobbered hand-edits.

---

## Decisions Made (write into PROJECT.md / ROADMAP.md)

**Infrastructure / Oracle:**
- Oracle Cloud Always Free Autonomous **19c** (not 26ai), **Transaction Processing** workload, Serverless, Always Free ON, Instance Wallet
- Oracle **Instant Client 23.x macOS ARM64** (native, not Rosetta)
- Thick mode **unconditionally**, even locally
- Startup assertion refuses boot if `v$session_connect_info.client_driver` reports `python-oracledb thn`
- Wallet at `~/.oracle/wallets/recvizdev/`, absolute `DIRECTORY` in `sqlnet.ora`, `TNS_ADMIN` in `~/.zshrc`
- DSN: `recvizdev_low` (serial execution, highest concurrency, best for BI aggregations)

**Config / Engine:**
- `pydantic-settings` `SecretStr` for `recviz_db_password` and `oracle_wallet_password`
- URL stays `oracle+oracledb://` with empty userinfo; credentials via `connect_args`
- `thick_mode` as **dict of kwargs** (`config_dir`, `driver_name`, conditional `lib_dir`)
- Pool: `pool_size=5`, `max_overflow=5`, `pool_pre_ping=True`, `pool_recycle=1800`
- `get_db_session` sync generator stays as-is. No `scoped_session`. FastAPI `def` handlers in Starlette threadpool.
- Extract `build_oracle_engine()` helper, reuse from `EngineManager`

**Schema / Models:**
- **JSON: `BLOB IS JSON`** via `OracleJSON(TypeDecorator, SchemaType)` with `_set_table` `CheckConstraint`, `_type_bound=True`
- Rename `PortableJSON` → `OracleJSON`, keep `PortableJSON = OracleJSON` alias for one milestone of grace, remove in final cleanup
- `String(n)` compiles to `VARCHAR2(n CHAR)` — existing lengths all fit under 4000 bytes, no changes
- `Text` compiles to `CLOB` — kept for `sql` and `encrypted_password`
- PKs: `String(128)` UUIDs everywhere — already correct, no sequences/Identity/triggers
- `Base.metadata` gets explicit `NAMING_CONVENTION` dict before autogen runs

**Migrations:**
- **Delete all seven existing migrations** outright. Git history preserves them.
- Autogen single clean `001_initial_oracle_schema.py`, hand-review 9-point checklist, manually add `IS JSON` constraints if autogen drops them
- `recviz_alembic_version` table name retained (env.py only, not `alembic.ini`)
- `alembic.ini` `sqlalchemy.url = ` blank; `env.py` loads from `settings`
- `env.py` online mode wires `thick_mode` + `connect_args`. `transaction_per_migration=True`, `compare_type=True`, `compare_server_default=True` (flip False if timestamp churn), `include_schemas=False`

**Frontend / Colorization:**
- **Palette: Option B — Mist base + Blue accent** (recommendation; UI-SPEC gate confirms or swaps to Stone+Blue, Zinc+Indigo, Stone+Teal)
- **Chart palette: Strategy B** — shadcn `--chart-1..5` for sequential, new `--series-1..8` extension for categorical multi-series. 8 OKLCH values captured from shadcn's own accent themes.
- Apply via `pnpm dlx shadcn@latest apply --preset <id>` or hand-paste. Git-commit before running.
- `chart-themes.ts` rewired to read CSS vars via `resolveColor('--chart-*')` + `resolveColor('--series-*')`
- One-time `.ag-theme-quartz { --ag-*: var(--...) }` override block in `index.css`
- Status colors stay as semantic Tailwind utilities
- Luma, Mauve, Olive, Taupe explicitly rejected

**Scope / Process:**
- No automated tests this milestone — manual verification per page against real Oracle
- Reports page dropped entirely
- Stay on `feature/add-color-remove-postgres` branch, no phase branches

---

## Phase 1 Task Inventory (ordered)

**Block A — USER manual (gate Block B on Block A completion)**
1. [USER, ~1 hr] Sign up Oracle Cloud, pick home region, create tenancy
2. [USER, ~5 min] Provision `recvizdev` Autonomous DB — 19c, TP, Always Free
3. [USER, ~2 min] Download Instance Wallet, record wallet password
4. [USER, ~5 min] Unzip wallet, chmod, edit `sqlnet.ora` to absolute DIRECTORY path
5. [USER, ~10 min] Download Instant Client 23.x ARM64, validate, install, move
6. [USER, ~1 min] `export TNS_ADMIN=` in `~/.zshrc`
7. [USER, ~1 min] Smoke test `sqlplus ADMIN/"$PW"@recvizdev_low` — **GATE, do not proceed until passes**

**Block B — CLAUDE backend infrastructure**
8. [CLAUDE, small] Update `requirements.txt` — remove PG/async residue
9. [CLAUDE, small] Update `config.py` — add Oracle fields, `SecretStr` passwords, drop `recon_db_url`
10. [CLAUDE, small] Update `.env.example`
11. [USER, small] Update local `.env` with wallet paths and credentials
12. [CLAUDE, medium] Rewrite `db/engine.py` — thick mode dict, `build_oracle_engine()` helper, pool sizing
13. [CLAUDE, small] Update `db/base.py` — add `NAMING_CONVENTION`
14. [CLAUDE, medium] Rewrite `db/types.py` — `OracleJSON` with `BLOB IS JSON` + `_set_table`, alias `PortableJSON`
15. [CLAUDE, small] Audit `services/engine_manager.py` — use `build_oracle_engine()`
16. [CLAUDE, small] Flip 3 `async def` handlers in `api/views.py` to `def`
17. [CLAUDE, small] Add startup thick-mode assertion in `main.py` lifespan

**Block C — CLAUDE migrations**
18. [CLAUDE, small] Clear `alembic.ini` `sqlalchemy.url =`
19. [CLAUDE, medium] Rewrite `env.py` — load URL from settings, thick mode in online mode, autogen flags, keep `version_table`
20. [CLAUDE, small] Delete `versions/001_*.py` through `007_*.py`
21. [CLAUDE, medium] `alembic revision --autogenerate`, hand-review 9-point checklist, manually add `IS JSON` constraints
22. [CLAUDE, small] `alembic upgrade head`, inspect via `sqlplus` or SQL Developer
23. [CLAUDE, small] Smoke test: `uvicorn`, `GET /health`, `POST /api/dashboards` with ≥5 KB JSON, read back

**Block D — CLAUDE dead code sweep**
24. [CLAUDE, small] Delete `docker-compose.yml`, `superset/`, PG seed SQL, `scripts/docker*`. Grep for `postgresql`, `JSONB`, `asyncpg`, `psycopg2`, `superset`, `redis`, `celery`
25. [CLAUDE, small] Update `.gitignore`

**Block E — CLAUDE frontend colorization groundwork**
26. [CLAUDE/USER, small] UI-SPEC gate: confirm Mist+Blue or swap. Generate preset URL on `ui.shadcn.com/create`
27. [CLAUDE, small] Git-commit, run `pnpm dlx shadcn@latest apply --preset <id>` (or hand-paste), diff, restore clobbered custom `@layer components`
28. [CLAUDE, small] Add `--series-1..8` tokens (light + dark) to `index.css`, expose via `@theme inline`
29. [CLAUDE, small] Add `.ag-theme-quartz { ... }` override block to `index.css`
30. [CLAUDE, medium] Rewire `chart-themes.ts` — replace hard-coded `series` array with CSS-var reads, replace heatmap/treemap/waterfall hex
31. [CLAUDE, small] Grep audit `frontend/src/` for `#` hex, `rgb(`, `hsl(` — flag for owning phases

**Block F — verification**
32. [USER, small] Start backend + frontend, toggle dark/light, verify palette applied, AG Grid responds
33. [CLAUDE, small] Commit, tag end of Phase 1

---

## Open Questions for Phase 1 DISCUSS

1. **`SecretStr` vs plain `str`** for `recviz_db_password` / `oracle_wallet_password`. Research recommends `SecretStr` (credentials stay wrapped until driver, less accidental logging). User may prefer plain `str` for simpler `.env` round-tripping.

2. **Test NVARCHAR2 smoke column.** Add a throwaway `NVARCHAR2` column to one `recviz_*` table to force NCHAR driver code path locally? Pros: catches thick-mode regressions, guards against silent thin-mode fallback. Cons: cruft. Recommendation: add.

3. **Final palette choice — Mist+Blue vs alternatives.** Must look at it visually on `ui.shadcn.com/create` or applied to `index.css` before committing. Headline UI-SPEC gate decision.

4. **`docs/` directory** — delete entirely or audit first?

5. **`scripts/` directory** — keep or delete? (User already said KEEP scripts/ during init — confirm persisted.) Some legacy Docker setup scripts are clearly dead (`superset-entrypoint.sh`), others may still have value. Per-file audit.

6. **CLAUDE.md refresh** — good enough as-done-in-init, or user wants a pass before Phase 1? Especially Oracle-only framing and NCS 871 parity gap language.

7. **Secondary engine audit (`EngineManager`)** — Phase 1 scope or defer? Research recommends Phase 1 (once-per-process constraint makes it unavoidable).

8. **Rename `PortableJSON` → `OracleJSON`** outright, or keep permanent alias? Recommendation: rename with one-milestone alias grace, then delete.

9. **Wallet path in `.env`** — hardcode absolute (`/Users/aarun/...`) or add `os.path.expanduser` logic for `~/`?

10. **`_references/shadcn-ui-kit-dashboard/`** — keep as visual baseline for frontend-design skill, or dead-code delete in final sweep? (User already said KEEP during init — confirm persisted.)

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Oracle Cloud provisioning path | HIGH | Every click verified against current Oracle docs |
| Instant Client macOS ARM64 | HIGH | Native ARM64 since June 2024, verified on download page |
| Thick-mode dict pattern | HIGH | Cross-verified across SQLAlchemy docs, Oracle Medium, python-oracledb docs |
| NCS 871 parity gap | HIGH (negative result) | Free Tier char set locked, no workaround exists |
| Session lifecycle | HIGH | Existing `get_db_session` already correct |
| `BLOB IS JSON` decision | HIGH | Maintainer-sanctioned in SQLAlchemy #10374, Oracle docs |
| String column audit | HIGH | Hand-checked every model file |
| Nuke-and-regenerate migration | HIGH | PG-specific DDL definitively breaks on Oracle |
| Shadcn palette values | HIGH | Verbatim from shadcn themes registry |
| AG Grid Theming API wiring | HIGH | Verified against RecViz source |
| `chart-themes.ts` hard-coded hex | HIGH | Verified against file |
| Mist+Blue recommendation | MEDIUM | Opinionated; UI-SPEC gate confirms visually |
| `compare_server_default=True` behavior | MEDIUM | May cause timestamp churn; flip to False if so |
| Secondary engine audit scope | MEDIUM | `EngineManager` implementation not directly read |

**Permanent gaps (cannot close without Citi prod access):** Exact NLS character set + `COMPATIBLE` parameter of Citi's 19c, unusual session/connection constraints at Citi, NCHAR/NVARCHAR2 column exercise against real Citi schema. Mitigation is procedural (force thick mode, startup assertion, document in CLAUDE.md).
