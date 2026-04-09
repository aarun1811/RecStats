# Project Research Summary

**Project:** RecViz v2.0 -- Remove Superset, Direct Database Engine
**Domain:** Internal BI platform backend migration (heavyweight dependency removal)
**Researched:** 2026-04-09
**Confidence:** HIGH

## Executive Summary

RecViz v2.0 replaces Apache Superset (used as a headless query engine) with direct SQLAlchemy async connections from FastAPI to Oracle/PostgreSQL. This eliminates the Superset process, Redis, and the HTTP proxy layer entirely. The migration is architecturally clean: the frontend never talked to Superset directly, so all changes are behind FastAPI's API surface. Research confirms that SQLAlchemy 2.0.49 with python-oracledb 3.4.2 in thin mode provides a fully async, production-ready query path to Oracle 19c. The critical path is: connection storage table, engine pool, query executor rewrite, API endpoint rewiring, then Superset deletion. Estimated ~880 lines of new code and ~800+ lines deleted -- roughly code-neutral.

The recommended approach is a "build alongside, then swap" strategy. Build the new DataSourceEnginePool and QueryExecutor as new services, wire them into the FastAPI lifespan, verify API response shapes are byte-identical to the Superset-proxied versions, then delete all Superset code in a final cleanup phase. This avoids a risky big-bang cutover. The existing `_build_sql()` template engine and `_resolve_database()` routing logic are reusable as-is -- only the execution layer changes.

The top risks are: (1) PostgreSQL JSONB columns in every ORM model will crash on Oracle -- must be replaced with a cross-dialect type before anything else; (2) Superset's response shape is deeply embedded in frontend parsing -- the new engine must reproduce the exact column/row format; (3) connection pool sizing must account for dashboard concurrency (12-15 queries per page load times concurrent users), not just the number of databases. All three are solvable with known patterns and must be addressed in Phase 1.

## Key Findings

### Recommended Stack

No new libraries are required. The entire migration uses packages already installed (SQLAlchemy 2.0.49, asyncpg 0.31.0) plus one version upgrade (python-oracledb 2.5.1 to 3.4.2). SQLAlchemy's `create_async_engine` with `AsyncAdaptedQueuePool` handles connection pooling for both PostgreSQL and Oracle. Superset, Redis, httpx, psycopg2-binary, and requests are removed.

**Core technologies (all existing):**
- **SQLAlchemy 2.0.49**: Query engine via `text()` + `create_async_engine` -- replaces Superset's SQL execution entirely
- **python-oracledb 3.4.2** (upgrade from 2.5.1): Async Oracle driver in thin mode -- `oracle+oracledb://` auto-selects async dialect
- **asyncpg 0.31.0**: PostgreSQL async driver -- already in use for metadata, now also for dev data queries
- **Fernet (cryptography)**: Credential encryption for stored database passwords -- new usage, library likely already transitive

**Removed:**
- Apache Superset (query engine), Redis (cache/broker), httpx (Superset proxy), psycopg2-binary (sync PG driver), requests (transitive)

**Do NOT add:** orjson/ujson (premature), databases (encode), aiocache/cachetools (defer), Celery (unnecessary), SQLModel (blurs boundaries), pgbouncer (overkill for <50 users)

### Expected Features

**Must have (table stakes for Superset parity):**
- **TS-1: Raw SQL execution** against configured databases via `text()` + async engine
- **TS-2: Database connection CRUD** stored in `recviz_connections` table (replaces Superset metadata + databases.json)
- **TS-3: Connection testing** via direct `SELECT 1` / `SELECT 1 FROM DUAL`
- **TS-4: Dynamic engine pool** -- one async engine per registered connection, lazy creation, dispose on update/delete
- **TS-5: Dataset query with filter injection** -- reuse existing `_build_sql()` template engine, swap execution layer
- **TS-6: Dataset metadata without Superset sync** -- delete `DatasetSyncService`, drop `superset_id`/`sync_status` columns
- **TS-7: Schema browser** -- SQLAlchemy Inspector for table/column introspection (new capability)
- **TS-8: SQL Explorer execution** -- same as TS-1 behind `/api/sql/execute` endpoint

**Differentiators (free or low-cost improvements):**
- **D-1: 50-200ms faster per query** (eliminate HTTP double-hop) -- free
- **D-2: Better error messages** (native Oracle/PG error codes preserved) -- free
- **D-3: Streaming large result sets** for exports via `StreamingResponse` -- medium effort
- **D-4: Connection pool observability** (`engine.pool.status()`) -- low effort
- **D-5: Simplified infrastructure** (Docker: just PostgreSQL; prod: just FastAPI + Oracle) -- free
- **D-6: Per-query timeout control** -- low effort
- **D-7: True async all the way down** (no fake-async httpx blocking) -- free

**Anti-features (Superset complexity we must NOT rebuild):**
- Superset virtual dataset abstraction (redundant with RecViz datasets)
- Superset chart data API / JSON-to-SQL compiler (RecViz has simpler template SQL)
- Redis result caching (TanStack Query handles client-side caching)
- Superset auth/RBAC (deferred to future milestone)
- Superset metadata DB (50+ tables -- RecViz has 6)
- Celery async query execution (use streaming instead)

**Defer to later:**
- In-memory server-side query cache (only if TanStack Query proves insufficient)
- Persistent query history (in-memory works for now)
- Query cost estimation (EXPLAIN before execute)

### Architecture Approach

The architecture introduces a "dual engine" strategy: one fixed metadata engine (existing `db/engine.py`, unchanged) for RecViz ORM tables, plus a new `DataSourceEnginePool` managing N dynamic engines for user-defined database connections. The pool creates engines lazily on first query, disposes them on connection update/delete, and uses `pool_size=5, max_overflow=10` per engine. A `ConnectionResolver` replaces `DatabaseRegistrar` to map logical database names to connection IDs. The rewritten `QueryExecutor` keeps the existing `_build_sql()` and `_resolve_database()` methods, replacing only the `execute()` call from Superset HTTP to direct `text()` execution.

**Major components:**
1. **DataSourceEnginePool** -- manages async SQLAlchemy engines per database connection (create, cache, dispose, test)
2. **QueryExecutor** (rewritten `query_engine.py`) -- builds SQL via existing template engine, executes via engine pool, returns identical response shape
3. **ConnectionResolver** (replaces `DatabaseRegistrar`) -- maps logical DB names to `recviz_connections` row IDs, caches in-memory, invalidated on CRUD
4. **RecvizConnection ORM model** -- new `recviz_connections` table with encrypted credentials
5. **PortableJSON type** -- `JSON().with_variant(JSONB, "postgresql")` cross-dialect type replacing all JSONB columns

**Key architectural decisions:**
- One engine per database (not one shared engine) because each connection targets a different physical DB
- `text()` for all data queries (not ORM) because recon table schemas are unknown at compile time
- Fernet encryption for passwords (build URI at runtime from decrypted fields, never store full URI)
- API response shapes kept byte-identical to avoid any frontend changes

### Critical Pitfalls

1. **JSONB columns crash on Oracle (P1)** -- All 5 ORM models import `JSONB` from `sqlalchemy.dialects.postgresql`. Replace with `PortableJSON = JSON().with_variant(JSONB(), "postgresql")`. Must be Phase 1 -- nothing works on Oracle without this.

2. **Superset response shape deeply embedded in frontend (P2)** -- Frontend parses `columns` as `[{column_name, name, type}]` objects and `data`/`rows` as column-keyed dicts. The new engine must reproduce this exact format. Build a response adapter and test against every existing dashboard.

3. **Connection pool exhaustion under concurrent load (P3)** -- A dashboard fires 12-15 queries on load. 10 concurrent users = 120-150 concurrent queries. Size pools for dashboard concurrency (`pool_size=10, max_overflow=20`), set `pool_timeout=10` (fast failure), `pool_pre_ping=True`, `pool_recycle=1800`.

4. **Engine lifecycle leaks on connection update/delete (P4)** -- Each undisposed engine leaks its entire pool. The `DataSourceEnginePool` must `await engine.dispose()` on every update/delete. Write tests asserting pool status returns to zero after CRUD operations.

5. **Oracle identifier UPPERCASE breaks column matching (P11)** -- Oracle returns `STATUS` not `status`. The query engine's result adapter must lowercase all column names. One normalization point, not scattered across consumers.

6. **`database_id` semantic shift (P9)** -- Currently stores Superset integer IDs throughout the stack. Must migrate to string-based logical names. Data migration required for existing datasets. Frontend sends opaque IDs so the type change is transparent if list endpoints return the new format.

7. **No query timeout without Superset (P15)** -- Use `oracledb.call_timeout` + `asyncio.wait_for()` from day one. Different timeouts for dashboard queries (30s), SQL Explorer (60s), schema introspection (10s).

## Implications for Roadmap

Based on combined research, the migration decomposes into 5 phases with a clear dependency chain.

### Phase 1: Engine Foundation
**Rationale:** Everything depends on the data-query infrastructure. Connection storage, engine pooling, and cross-dialect types must exist before any query can execute. This phase has the highest pitfall density (JSONB, pool sizing, Oracle thin mode, URI format, timeouts, case sensitivity).
**Delivers:** `recviz_connections` table, `DataSourceEnginePool`, `ConnectionResolver`, `PortableJSON` type, credential encryption, query timeout infrastructure. No API-visible changes yet.
**Addresses:** TS-2 (connection storage), TS-3 (connection testing), TS-4 (engine pool), foundation for TS-1
**Avoids:** P1 (JSONB crash), P3 (pool exhaustion), P4 (engine leaks), P7 (thick mode), P14 (URI format), P15 (no timeout), P11 (case sensitivity)

### Phase 2: Query Execution + API Migration
**Rationale:** With engines available, rewrite the query execution path and rewire API endpoints. This is where the frontend starts talking to the new code. Response shape fidelity is critical.
**Delivers:** `QueryExecutor` (rewritten), databases.py CRUD against `recviz_connections`, sql.py direct execution, managed_datasets.py cleanup (remove sync), schema browser endpoints. Main.py lifespan rewrite.
**Addresses:** TS-1 (raw SQL), TS-5 (dataset queries with filters), TS-6 (remove dataset sync), TS-7 (schema browser), TS-8 (SQL Explorer), D-1 (faster queries), D-2 (better errors), D-6 (timeout control), D-7 (true async)
**Avoids:** P2 (response shape mismatch), P5 (superset_id orphans), P9 (database_id semantic shift), P10 (SQL injection surface), P12 (async session leaks)

### Phase 3: Superset Removal + Cleanup
**Rationale:** Only after the new engine is verified working do we delete Superset code. This is the "cut the cord" phase. Systematic removal across 29 files that reference Superset.
**Delivers:** Delete `superset_client.py`, `database_registrar.py`, `dataset_sync.py`, `superset/` directory. Remove Redis and Superset from Docker Compose. Clean config, dependencies, health endpoint. Rename `superset_db_*` connection names.
**Addresses:** D-5 (simplified infrastructure), cleanup of all Superset ghost references
**Avoids:** P13 (incomplete removal -- use systematic grep), P17 (Redis left behind), P18 (psycopg2-binary confusion)

### Phase 4: Hardening + Observability
**Rationale:** With Superset gone, add production-grade features that were impossible or unnecessary before. Pool monitoring, streaming exports, SQL safety, dialect validation.
**Delivers:** Pool observability endpoint (`/api/health/pools`), streaming CSV/Excel exports, read-only transaction enforcement, SQL statement classifier (reject DDL/DML), portable SQL subset documentation for dev team
**Addresses:** D-3 (streaming results), D-4 (pool observability), enhanced security (P10 hardening)
**Avoids:** P6 (dialect differences in user SQL), P10 (SQL injection from filter interpolation)

### Phase 5: Verification + Migration
**Rationale:** Final validation that every dashboard, chart, KPI, grid, and SQL Explorer query works identically to the Superset-backed version. Data migration for existing datasets with Superset integer IDs.
**Delivers:** Full regression testing, data migration script (Superset IDs to logical names), Oracle-specific test coverage, deployment documentation
**Addresses:** Confidence that v1.0 parity is achieved
**Avoids:** P6 (silent wrong data from dialect differences), P19 (false confidence from PG-only testing)

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** The engine pool is a prerequisite for every query execution path. Building it first allows Phase 2 to focus purely on API wiring without infrastructure concerns.
- **Phase 2 before Phase 3:** "Build alongside, then swap" is safer than "delete then rebuild." Phase 2 can be tested while Superset is still present as a fallback.
- **Phase 3 after verification:** Deleting Superset code is irreversible (in terms of easy rollback). Do it only after the new path is proven.
- **Phase 4 is optional for parity** but important for production readiness. It can be done in parallel with Phase 5 or deferred.
- **Phases 1-3 are the critical path.** Phases 4-5 are hardening.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Oracle connection string formats for RHEL production (TNS aliases vs Easy Connect), pool sizing validation under realistic concurrent load
- **Phase 2:** Exact Superset response shapes for every endpoint (need to capture and snapshot current responses as test fixtures)
- **Phase 4:** Parameterized query migration for `_build_sql()` filter injection -- the current string interpolation must be replaced with bind parameters, which changes how templates work

Phases with standard patterns (skip research-phase):
- **Phase 3:** Pure deletion/cleanup -- well-defined file list, systematic grep, no design decisions
- **Phase 5:** Testing and verification -- standard integration test patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries already installed or have verified async Oracle support. Version compatibility confirmed via PyPI and official docs. |
| Features | HIGH | Complete audit of every Superset API call RecViz makes. Feature list derived from codebase analysis, not speculation. Migration surface fully mapped (files to delete, modify, create). |
| Architecture | HIGH | Dual-engine pattern is standard for multi-database FastAPI. DataSourceEnginePool pattern verified in SQLAlchemy docs and community projects. Existing code reuse paths clearly identified. |
| Pitfalls | HIGH | 19 pitfalls identified from codebase analysis, SQLAlchemy docs, python-oracledb docs, and community patterns. Phase-specific warnings mapped. Critical pitfalls have concrete prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Oracle production connection format:** The RHEL servers may use TNS aliases, not host:port Easy Connect strings. The `uri_builder.py` update needs to support both. Validate with the deployment team during Phase 1 planning.
- **Exact Superset response shapes:** Need to capture actual Superset API responses as JSON fixtures before removing Superset. Run every endpoint with real data and snapshot the output. This becomes the contract test suite.
- **`_build_sql()` parameterization:** The current filter injection uses string interpolation (`str.replace`). Converting to SQLAlchemy bind parameters is the right long-term fix but changes how the template system works. Needs design during Phase 2 planning -- may be deferred to Phase 4 if the existing escaping is sufficient for internal use.
- **Oracle 19c vs 21c JSON support:** If production Oracle is 21c+, `sa.JSON()` maps natively and the `OracleJSON` TypeDecorator is unnecessary. Confirm Oracle version with infrastructure team.
- **Connection credential encryption key management:** Fernet key from env var works for single-server deployment. If RecViz scales to multiple servers, key distribution needs a solution. Defer to auth milestone.

## Sources

### Primary (HIGH confidence)
- [SQLAlchemy 2.0 Oracle Dialect](https://docs.sqlalchemy.org/en/20/dialects/oracle.html) -- async dialect, connection URLs, type mapping
- [SQLAlchemy 2.0 Async I/O](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) -- create_async_engine, async sessions, run_sync
- [SQLAlchemy 2.0 Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html) -- AsyncAdaptedQueuePool configuration
- [python-oracledb Async Docs](https://python-oracledb.readthedocs.io/en/latest/user_guide/asyncio.html) -- thin mode, async connections, call_timeout
- [python-oracledb Thin vs Thick Mode](https://python-oracledb.readthedocs.io/en/latest/user_guide/appendix_b.html) -- mode selection, feature matrix
- [SQLAlchemy Oracle Async Issue #10679](https://github.com/sqlalchemy/sqlalchemy/issues/10679) -- oracledb_async dialect confirmed in 2.0.25
- RecViz codebase audit: `superset_client.py`, `query_engine.py`, `database_registrar.py`, `dataset_sync.py`, all API routes

### Secondary (MEDIUM confidence)
- [SQLAlchemy JSON with_variant Discussion #9112](https://github.com/sqlalchemy/sqlalchemy/discussions/9112) -- cross-database JSON patterns
- [Alembic dialect support](https://deepwiki.com/sqlalchemy/alembic/3.4-dialect-support) -- migration compatibility
- [RecViz RHEL Oracle Deployment Design](docs/superpowers/specs/2026-04-09-rhel-oracle-no-sudo-deployment-design.md) -- verified async Oracle, JSON on 19c

### Tertiary (LOW confidence)
- Community blog posts on FastAPI + multi-database SQLAlchemy patterns -- used for pattern validation, not specific implementation details

---
*Research completed: 2026-04-09*
*Ready for roadmap: yes*
