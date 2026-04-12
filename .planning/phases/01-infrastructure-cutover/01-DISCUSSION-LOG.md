# Phase 1: Infrastructure Cutover - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 01-infrastructure-cutover
**Areas discussed:** Oracle Cloud setup gate, Instant Client setup, Shadcn palette, Chart series colors, Residue boundaries, Config fields, JSON type, Migration, Env vars

---

## Oracle Local Dev Setup (pivoted from Oracle Cloud)

User replaced Oracle Cloud Always Free with Docker `gvenzl/oracle-free:latest` because Oracle Cloud setup was becoming complicated and not feasible.

| Option | Description | Selected |
|--------|-------------|----------|
| Oracle Cloud Always Free | Original plan — wallet, TNS_ADMIN, Instant Client | |
| Docker gvenzl/oracle-free | Local container, direct TCP, no wallet | ✓ |

**User's choice:** Docker gvenzl/oracle-free:latest
**Notes:** User ran: `docker run -d --name oracle-26ai -p 1521:1521 -e ORACLE_PASSWORD=RecViz2026 -e APP_USER=recviz -e APP_USER_PASSWORD=recviz_dev gvenzl/oracle-free:latest`. Still coding for 19c compatibility only. Running lower Oracle version in Docker not feasible on Mac ARM64 (gvenzl only supports 23ai).

---

## Instant Client Path

| Option | Description | Selected |
|--------|-------------|----------|
| /opt/oracle/instantclient | Standard Oracle convention, needs sudo | |
| ~/oracle/instantclient | Home directory, no sudo needed | ✓ |
| Homebrew-managed | brew install, auto-discovered path | |

**User's choice:** ~/oracle/instantclient
**Notes:** No sudo preferred. Less conventional but simpler.

## Thick Mode Config Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Env var ORACLE_CLIENT_LIB_DIR | Set in .env per environment, boot fails if missing | ✓ |
| Auto-detect by platform | sys.platform check, less flexible | |
| Config.py with defaults | Pydantic Settings with platform defaults | |

**User's choice:** Env var ORACLE_CLIENT_LIB_DIR (required, no fallback)

---

## Shadcn Palette Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Mist + Blue | Cool, professional BI feel, muted gray + blue | ✓ |
| Zinc + Blue | Darker neutrals, stronger contrast | |
| Slate + Indigo | Warmer grays, deeper purple-blue | |
| Neutral + Blue | True neutral grays, clean minimal | |

**User's choice:** Mist + Blue

---

## Chart Series Colors

| Option | Description | Selected |
|--------|-------------|----------|
| Shadcn chart vars + extend | Start from --chart-1..5, extend to 8 + ramp/semantic vars | ✓ |
| D3 categorical palette | Proven data viz colors, may not match Mist+Blue | |
| Hand-pick custom colors | Maximum control, needs light+dark variants each | |
| You decide | Claude picks during implementation | |

**User's choice:** Shadcn chart vars + extend
**Notes:** User asked detailed questions about how CSS vars work, multi-color chart types (heatmap ramps, waterfall semantics), and future customizability. Explanation of the full architecture (CSS vars → getComputedStyle → chart wrappers) satisfied the concern.

---

## Docker-compose.yml

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it | PG residue, user runs docker manually | ✓ |
| Rewrite for Oracle | docker-compose service for gvenzl/oracle-free | |
| Keep scripts/oracle-dev.sh | Shell script with docker run reference | |

**User's choice:** Delete entirely

## Seed Script

| Option | Description | Selected |
|--------|-------------|----------|
| Delete entirely | Dead code, Phase 2+ uses real CRUD data | |
| Rewrite for Oracle | Port to Oracle, pre-populated dev data | ✓ |
| Keep but mark deprecated | Reference for data shapes/pairing | |

**User's choice:** Rewrite for Oracle now, delete in Phase 8 cleanup.

## URI Builder Dead Dialects

| Option | Description | Selected |
|--------|-------------|----------|
| Delete now | Remove elasticsearch/hive/postgresql paths | ✓ |
| Keep Oracle + PG paths | Keep PG as fallback | |
| Defer to Phase 8 | Dead code sweep catches it | |

**User's choice:** Delete now

## Docs Directory

| Option | Description | Selected |
|--------|-------------|----------|
| Delete entire docs/ | All stale, .planning/codebase/ is living reference | ✓ |
| Keep DEPLOYMENT.md only | RHEL server paths might be useful | |

**User's choice:** Delete entirely

## EngineManager Dialects

| Option | Description | Selected |
|--------|-------------|----------|
| Oracle only | Remove PG dialect handling | ✓ |
| Keep both dialects | Theoretical PG data sources | |
| You decide | Claude evaluates dead paths | |

**User's choice:** Oracle only

## Config.py DB URL

| Option | Description | Selected |
|--------|-------------|----------|
| No default, require env var | Fail clearly if missing | ✓ |
| Default to Oracle localhost | Works out of box, bakes credentials | |

**User's choice:** No default, require env var

## DB Connection Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Single URL + lib_dir | Standard SQLAlchemy pattern | ✓ |
| Individual fields | Separate user/password/dsn/wallet fields | |
| URL + optional wallet | Flexible for wallet-based prod auth | |

**User's choice:** Single URL + lib_dir
**Notes:** Prod also uses direct TCP (no wallet), so wallet fields unnecessary.

## OracleJSON Type

| Option | Description | Selected |
|--------|-------------|----------|
| OracleJSON + alias | Rename to OracleJSON, keep PortableJSON alias for grace period | ✓ |
| OracleJSON only, drop alias | Clean break, rename all usages immediately | |

**User's choice:** OracleJSON + alias (Phase 8 removes alias)

## Initial Migration Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Include recviz_data_sources | Keep table, seed script + code depend on it | ✓ |
| Omit recviz_data_sources | Force Phase 6 fix earlier | |

**User's choice:** Include it (Phase 6 handles architectural fix)

## .env.example Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal Oracle set | 4 vars: RECVIZ_DB_URL, ORACLE_CLIENT_LIB_DIR, RECVIZ_ENCRYPTION_KEY, VITE_API_BASE_URL | ✓ |
| Full set with optional vars | Above + LOG_LEVEL, CORS_ORIGINS, POOL_SIZE, etc. | |

**User's choice:** Minimal Oracle set

---

## Claude's Discretion

- USAGE-TRACKER.md format (user confirmed: "design it accordingly")
- Exact chart series hex values
- AG Grid override block details
- Startup assertion implementation
- Pool sizing and connection args

## Deferred Ideas

None — discussion stayed within phase scope.
