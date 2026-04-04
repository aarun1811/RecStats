# Pitfalls Research

**Domain:** Internal BI/visualization platform for financial reconciliation (replacing Tableau/Qlik)
**Researched:** 2026-04-04
**Confidence:** HIGH (combines verified codebase analysis, Superset documentation, enterprise BI patterns, and financial domain specifics)

## Critical Pitfalls

### Pitfall 1: Client-Side Cross-Filtering on Million-Row Datasets

**What goes wrong:**
The existing codebase already shows this pattern: `use-breaks-data.ts` fetches up to 1,000 rows from the backend so that KPIs can be recomputed client-side when cross-filters are active. At production scale (millions of rows across 12,000 reconciliations), this approach collapses. Browsers cap memory per tab at roughly 1-2 GB. Downloading even 100K rows of recon data to the browser for client-side filtering causes: (a) multi-second fetch times, (b) `useMemo` recalculations that block the main thread and freeze the UI, and (c) stale aggregates when the in-browser dataset is only a sample of the full data.

**Why it happens:**
Cross-filtering is architecturally the easiest feature to build client-side because it avoids network round-trips. The current CLAUDE.md explicitly states "Cross-filters: client-side only, Zustand, useMemo on cached data, zero network calls." This works for small demo datasets but breaks at production volumes.

**How to avoid:**
Implement a hybrid cross-filter strategy. For aggregated chart data (typically < 10K data points), client-side filtering via `useMemo` on already-fetched chart response data is fine. For KPI recomputation and grid drill-down, send the cross-filter context to the backend and let the database compute filtered aggregates. The Superset SQL Lab API already supports parameterized queries -- inject cross-filter predicates as WHERE clauses alongside global filters. Keep cross-filter state in Zustand (already planned) but use it to construct backend query parameters, not to filter raw data in the browser.

Define a threshold: datasets under 50K rows can be cross-filtered client-side; above that, cross-filter interactions trigger a backend query with debounce (300ms) and `keepPreviousData` in TanStack Query for seamless transitions.

**Warning signs:**
- Chart click interactions take > 500ms to update other panels
- Browser memory usage exceeds 500MB on dashboard load
- KPI values differ between initial load and after applying a cross-filter (sample bias)
- `useMemo` computations appearing in React Profiler as > 16ms (frame budget)

**Phase to address:**
Cross-filtering implementation phase. This must be the architectural decision BEFORE building cross-filter UI. Do not retrofit -- the data flow is fundamentally different between client-side and hybrid approaches.

---

### Pitfall 2: Superset API Version Coupling Without Pinning

**What goes wrong:**
The current `requirements.txt` specifies `apache-superset` without a version pin. Superset has a history of breaking REST API changes between major versions: Superset 4.0 removed fields from the `GET /api/v1/dashboard` response, Superset 5.0 enforced CSRF on the guest token endpoint, and the `fetch_csrf_token` behavior changed in a recent PR. Running `pip install` on a different day pulls a different Superset version with incompatible API behavior. The custom `SupersetClient` at `backend/app/services/superset_client.py` hardcodes endpoint paths and response parsing that may silently break.

**Why it happens:**
Superset is treated as an internal dependency ("just pip install it"), not as an external API contract. The REST API is not formally versioned with stability guarantees -- the `/api/v1/` prefix stays the same even when response shapes change. Most teams discover this during a routine `pip install --upgrade` or a Docker rebuild.

**How to avoid:**
1. Pin Superset to an exact version in `requirements.txt` (e.g., `apache-superset==4.1.1`).
2. Create an integration test suite for the `SupersetClient` that validates every API endpoint RecViz depends on (the 14 endpoints listed in INTEGRATIONS.md). Run these tests before any Superset version upgrade.
3. Wrap all Superset response parsing behind a versioned adapter layer in `superset_client.py`. If Superset changes a response shape, only the adapter changes -- not every consumer.
4. Monitor Superset's UPDATING.md for breaking changes before upgrading. Set a quarterly cadence for Superset version reviews.

**Warning signs:**
- `pip install` succeeds but `SupersetClient.authenticate()` fails with unexpected response shapes
- CSRF errors appearing in logs after a Superset restart/rebuild
- Chart data queries returning empty results or 400 errors that previously worked
- `GET /api/v1/dashboard` responses missing expected fields

**Phase to address:**
Infrastructure/foundation phase (before any new feature development). Pin the version immediately. Build the adapter layer when implementing the builder's dataset management (which requires more Superset API surface area).

---

### Pitfall 3: Dashboard Config Schema Without Versioning or Migration

**What goes wrong:**
The dashboard builder will produce JSON configuration objects (layout positions, chart configs, filter definitions, KPI sources) that get stored persistently. As the product evolves, the schema inevitably changes: new fields are added (e.g., cross-filter settings), old fields are renamed, chart types get new options, layout grid dimensions change. Without schema versioning, saved dashboards break silently when loaded by newer code. Users see blank charts, missing filters, or layout explosions. With 100+ dashboards expected, manual migration is not viable.

**Why it happens:**
Teams building dashboard builders almost always treat the config format as an internal implementation detail rather than a versioned contract. The existing config-driven system already has this problem -- JSON files in `backend/app/config/dashboards/` have no version field. There is no migration system. Every schema change requires manually updating every config file, and the number of files only grows.

**How to avoid:**
1. Add a `schemaVersion: number` field to every dashboard config from day one.
2. Build a migration pipeline: a chain of transform functions `v1 -> v2 -> v3 -> ... -> vN` that runs on config load. Each migration is a pure function that takes the old shape and returns the new shape.
3. Store configs in the database (Oracle/PostgreSQL) with the version field, not as JSON files on disk.
4. Write a migration for every schema change. No exceptions. Even "just adding an optional field" gets a migration that sets the default.
5. Validate loaded configs against a Zod schema (frontend) or Pydantic model (backend) after migration. Reject configs that don't pass validation rather than rendering broken dashboards.

**Warning signs:**
- "It works on new dashboards but old dashboards are broken"
- TypeScript errors about missing properties on loaded dashboard configs
- Backend validation errors when loading saved dashboards after a deploy
- Users reporting that dashboards they saved last week look different now

**Phase to address:**
Builder foundation phase. The migration system must exist BEFORE the first dashboard is saved through the builder UI. Retrofitting is exponentially harder because you have to handle an unknown number of unversioned configs in the wild.

---

### Pitfall 4: N+1 Query Pattern on Dashboard Load

**What goes wrong:**
The existing codebase already exhibits this: `ConfigChartGrid` renders each chart as a separate `QueryChartItem`, each with its own `useDataSourceQuery` hook. A dashboard with 6 charts + 4 KPIs + 1 filter options request = 11 independent API calls, each triggering a separate SQL query via Superset. Against Oracle over the network, each query has ~100-200ms of connection overhead before execution even begins. A dashboard with 10 panels takes 1-2 seconds just in connection overhead, plus actual query time. At scale (complex queries on millions of rows), dashboard load times balloon to 5-10+ seconds.

**Why it happens:**
The component-level data fetching pattern (each component fetches its own data) is a React best practice for loose coupling. But it creates an N+1 problem when N components all need data from the same database within the same page load.

**How to avoid:**
1. **Batch data source queries:** Charts sharing the same data source should share the same query response. Group chart configs by `dataSourceId`, execute one query per unique data source, and fan out results to individual chart components. TanStack Query's shared query keys already deduplicate this -- ensure all charts using the same data source + filters produce the same query key.
2. **Dashboard-level data prefetch:** Add a `POST /api/dashboards/{id}/load` endpoint that accepts the full filter state and returns all data sources needed for the dashboard in a single response. Execute queries in parallel on the backend (using `asyncio.gather`). This reduces 11 round-trips to 1.
3. **Progressive loading:** Load KPIs first (smallest payload), then charts (medium), then grid (largest). Show skeleton loaders for each stage. This is already documented in CLAUDE.md -- implement it properly.
4. **Redis caching at the query level:** Superset already caches queries in Redis. Ensure `DATA_CACHE_CONFIG` has appropriate TTL (5-10 minutes for recon data that refreshes every ~10 minutes). This makes repeat dashboard loads near-instant.

**Warning signs:**
- Network tab showing > 5 concurrent API calls on dashboard load
- Dashboard load time exceeding 3 seconds on warm cache
- Backend logs showing identical SQL queries executing multiple times within 1 second
- Users complaining about "slow dashboards" even when database queries are fast (< 200ms each)

**Phase to address:**
Early in the dashboard rendering optimization phase, before the builder ships. If users build dashboards with 10-15 panels (likely for recon data), the N+1 problem becomes the dominant UX issue.

---

### Pitfall 5: Silent Mock Data Fallback Masking Production Failures

**What goes wrong:**
Every backend API route currently follows a `try: superset_call() except Exception: return MOCK_DATA` pattern (documented in CONCERNS.md with 22 instances). In development this feels convenient -- the app "always works." In production, this is catastrophic for a financial data platform. Users see hardcoded numbers (e.g., "149,819 total breaks") with zero indication that the real data source failed. Analysts make decisions based on stale mock data. Auditors see fabricated numbers. When the Superset connection drops for 5 minutes, nobody notices because the dashboards still render with fake data.

**Why it happens:**
The mock fallback was built for developer convenience -- keep the frontend working even without Superset running. But it was implemented at the wrong layer (API handlers) instead of behind an explicit dev-mode toggle.

**How to avoid:**
1. Remove all `except Exception: return MOCK_DATA` patterns immediately. Replace with proper error handling that returns HTTP 502/503 status codes when Superset is unavailable.
2. Move mock data behind an explicit `MOCK_MODE=true` environment variable. When `MOCK_MODE` is false (production), errors propagate to the frontend.
3. Add structured error responses: `{"error": "superset_unavailable", "message": "Query engine is temporarily unavailable", "retry_after": 30}`.
4. Frontend already has error boundary and TanStack Query error state support. Use them. Display clear error states ("Data source unavailable - showing last cached data" or "Unable to load data - please retry").
5. Add health check monitoring: the existing `GET /health` endpoint checks Superset connectivity. Surface this status in the frontend header as a connection indicator.

**Warning signs:**
- KPI values that never change despite filter changes (mock data is static)
- All dashboards showing identical data regardless of date range
- No errors in backend logs despite known Superset downtime
- Dashboard data that doesn't match what analysts see when querying Oracle directly

**Phase to address:**
First phase. This is a pre-existing defect that must be fixed before any new feature development. Every new endpoint added inherits this pattern if not addressed.

---

### Pitfall 6: Dashboard Builder Scope Creep Into Full IDE

**What goes wrong:**
Teams building Tableau/Qlik replacements consistently over-scope the builder. The initial plan is "let business users arrange charts on a canvas." Then requests arrive for: conditional formatting rules, calculated fields, custom SQL (now you are building a SQL editor for non-technical users -- explicitly out of scope), dynamic parameters, dashboard-to-dashboard navigation, custom color palettes, annotations, trend lines, forecasting, thresholds, alerts. Each is "just one more feature." After 6 months, the builder is 80% built but feels 20% complete because it cannot match Tableau's 20+ years of feature depth.

**Why it happens:**
Tableau and Qlik have massive feature sets. Users migrating from these tools bring expectations calibrated to that feature depth. Every demo triggers "but in Tableau I could..." requests. The team has no prior Tableau/Qlik experience (stated in the context), so they lack calibration for which features are table stakes vs. nice-to-have vs. years of investment.

**How to avoid:**
1. Define the builder's scope explicitly and defend it. The PROJECT.md already says "Dev team creates datasets, business users build dashboards from datasets." This is the right boundary. Business users should NOT be able to write SQL, create calculated fields, or configure complex data transformations.
2. Use a template-first approach: provide 5-8 pre-built dashboard templates (KPI overview, breaks analysis, aging report, trend analysis, comparison). Business users customize these (change data source, adjust filters, rearrange layout) rather than building from scratch.
3. Implement a feature request backlog with ROI scoring. "How many of our 100+ dashboards need this feature?" If the answer is < 10%, defer it.
4. Ship the builder with the minimum viable feature set, get it into users' hands within 2-3 phases, and iterate based on actual usage data rather than anticipated needs.

**Warning signs:**
- Builder phase estimated at > 3 months of work
- Feature requests that start with "In Tableau you can..."
- Builder UI becoming complex enough to need its own tutorial/documentation
- More time spent on builder UX than on core dashboard rendering/performance

**Phase to address:**
Research and planning phase (now). Define the builder's feature boundary before implementation begins. Revisit the boundary at each phase transition.

---

### Pitfall 7: Oracle Query Performance Without Pre-Aggregation

**What goes wrong:**
Oracle is the primary production data source with millions of recon rows. Running ad-hoc `GROUP BY` aggregations across millions of rows for every dashboard load is slow (5-30+ seconds per query depending on complexity). Superset adds its own `GROUP BY` on top, so a poorly written data source SQL that already aggregates will cause double-aggregation. Dashboard auto-refresh every 10 minutes means these expensive queries run continuously. Multiple users viewing the same dashboard multiply the load.

A known Superset issue (GitHub #8568) documents "Superset dashboard runs very slow when Datasource as Oracle database" -- Oracle's query planner and network latency make it particularly susceptible to the aggregation-on-demand pattern.

**Why it happens:**
In development with PostgreSQL and seed data (1M transactions, ~150K breaks), queries run in < 200ms. Oracle in production with real data volumes, network latency, and concurrent users is 10-50x slower. The team does not discover this until production deployment.

**How to avoid:**
1. **Create materialized views** in Oracle for common dashboard aggregations (daily break counts by status/aging/entity, auto-match rates by recon, trend data). These pre-compute the expensive `GROUP BY` operations on a schedule (every 10-30 minutes).
2. **Design data source SQL to query aggregated tables**, not raw transaction tables. The QueryEngine's SQL templates should target `mv_daily_break_summary` rather than `SELECT COUNT(*) FROM breaks GROUP BY ...`.
3. **Configure Superset's Redis cache aggressively** for recon data: `DATA_CACHE_CONFIG` with 5-10 minute TTL matches the data freshness requirement. Cache hits avoid Oracle entirely.
4. **Tune SQLAlchemy connection pooling**: `pool_size=30`, `max_overflow=10`, `pool_timeout=30`, `pool_recycle=1800`. These are recommended for Superset-to-Oracle connections.
5. **Set query timeouts** at both the Superset level (`SQLLAB_ASYNC_TIME_LIMIT_SEC`) and the Oracle connection level to prevent runaway queries from consuming database resources.
6. **Load test with production-scale data** before deploying. Create a PostgreSQL dataset that mirrors Oracle's volume and query patterns.

**Warning signs:**
- Dashboard load time > 3 seconds in development (will be 5-10x worse in production)
- SQL queries using `SELECT *` or aggregating raw tables with > 1M rows
- Superset cache hit rate below 50% (check via stats logging)
- Oracle DBA complaints about high query load from the RecViz service account

**Phase to address:**
Data layer / infrastructure phase, before building dashboards that users will depend on. Materialized views and connection tuning must be in place before the builder ships.

---

### Pitfall 8: Superset CSRF and Session Management Brittleness

**What goes wrong:**
The `SupersetClient` authenticates via `POST /api/v1/security/login`, fetches a CSRF token from `/api/v1/security/csrf_token/`, and uses a simple 25-minute timer for token refresh. This has multiple failure modes: (a) CSRF tokens must be used in the same session they were created -- if the httpx client doesn't persist cookies correctly, every mutating API call fails with "CSRF session token is missing"; (b) Superset 5.0+ enforces CSRF on additional endpoints that were previously unprotected; (c) the retry-on-401 logic has only one retry attempt; (d) clock skew between the FastAPI server and Superset can cause pre-emptive or late re-authentication.

**Why it happens:**
Superset's CSRF implementation is tied to Flask's session management, which uses cookies. HTTP API clients (like httpx) don't manage cookies the way browsers do. The Superset GitHub has dozens of open issues about CSRF token problems in API integrations (issues #8382, #16398, #17206, #19525, discussions #32751, #34738).

**How to avoid:**
1. Ensure the httpx `AsyncClient` instance is long-lived and persists cookies across requests (already the case if using a single client instance, which the codebase does via `app.state.superset`).
2. Configure Superset to relax CSRF for API-only access: set `WTF_CSRF_ENABLED = False` for the API endpoints if RecViz is the only consumer and runs in a trusted network (common for headless Superset deployments). Alternatively, use `WTF_CSRF_EXEMPT_LIST` to exempt specific API routes.
3. Add retry logic with re-authentication: on any 400/403 response mentioning "CSRF", re-fetch the CSRF token and retry. Current code only retries on 401.
4. Make the token refresh interval configurable (not hardcoded to 25 minutes). Set it to match Superset's `PERMANENT_SESSION_LIFETIME` config minus a safety margin.
5. Add health monitoring: log CSRF token age, authentication state, and failure counts. Alert on repeated auth failures.

**Warning signs:**
- Intermittent 400 "CSRF session token is missing" errors in backend logs
- Mutating operations (database registration, dataset sync) failing while read operations succeed
- Errors that appear only after the service has been running for > 25 minutes
- Authentication failures after Superset restarts (stale tokens)

**Phase to address:**
Infrastructure / backend hardening phase. Fix before the builder ships, because the builder will require mutating Superset API calls (creating datasets, registering databases) that are CSRF-protected.

---

### Pitfall 9: Layout Persistence Without Undo/Redo or Conflict Resolution

**What goes wrong:**
The dashboard builder allows users to rearrange panels, resize charts, and customize layouts. Every layout change must be persisted. Without undo/redo, a user who accidentally drags a panel or resizes a chart has no way back. Without debounced auto-save, users lose work on browser crashes. Without conflict resolution, two users editing the same dashboard overwrite each other's changes (last-write-wins). In financial operations where dashboards are critical daily tools, any of these is a show-stopper.

**Why it happens:**
Layout persistence seems simple (save the grid positions array to the database). But the UX around persistence -- save timing, undo/redo, draft vs. published states, multi-user conflicts -- is where dashboard builders get stuck. React Grid Layout emits `onLayoutChange` on every drag pixel, creating a flood of state updates that must be debounced before persisting.

**How to avoid:**
1. **Undo/redo from day one:** Maintain a history stack of layout states (capped at ~50 entries). Ctrl+Z/Ctrl+Y support. This is non-negotiable for a builder UX.
2. **Explicit save, not auto-save for layout changes:** Show a "Save" button and "Unsaved changes" indicator. Auto-save is appropriate for filter selections, not for structural layout changes.
3. **Draft/published states:** Edits create a draft version. Explicit "Publish" makes changes visible to other users. This prevents half-finished layouts from disrupting other users.
4. **Debounce `onLayoutChange` aggressively:** Update local state immediately for UI responsiveness, but debounce backend persistence to 1-2 seconds after the last change.
5. **Optimistic locking for concurrent edits:** Store a version counter with each dashboard. On save, compare versions. If someone else saved in between, show a conflict dialog rather than silently overwriting.

**Warning signs:**
- Users afraid to touch the layout because they can't undo
- "My dashboard looks different than yesterday" reports from users who didn't make changes
- Rapid-fire API calls in the network tab during drag operations
- Data loss complaints after browser crashes during editing

**Phase to address:**
Builder UI phase. Undo/redo and save semantics must be designed before building the layout editor. They affect the entire state architecture.

---

### Pitfall 10: Financial Data Precision and Display Errors

**What goes wrong:**
Reconciliation data involves currency amounts, rates, and computed differences (breaks). JavaScript's floating-point arithmetic produces well-known precision errors: `0.1 + 0.2 = 0.30000000000000004`. When a KPI shows a break amount of `$1,234,567.8900000001` instead of `$1,234,567.89`, users lose trust in the entire platform. Worse, rounding errors in aggregations (summing millions of small amounts) can produce visible discrepancies between drill-down totals and summary KPIs. In financial operations, a 1-cent discrepancy triggers investigation.

**Why it happens:**
JavaScript uses IEEE 754 double-precision floating point for all numbers. Most BI tools handle this transparently because they do all arithmetic server-side (in the database, which uses DECIMAL types). RecViz's cross-filter design does client-side aggregation on raw numbers, which introduces floating-point errors.

**How to avoid:**
1. **All aggregation happens in the database or backend.** Never sum, average, or compute differences in JavaScript. The database's DECIMAL/NUMBER types handle this correctly.
2. **Format display values, don't compute them.** Backend returns pre-computed, pre-formatted values where possible. KPI values come from the database's `SUM()`, not from `array.reduce()` in React.
3. **Use `Intl.NumberFormat` for all currency/number display.** This handles locale-specific formatting and rounding correctly:
   ```typescript
   new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
   ```
4. **For unavoidable client-side math** (cross-filter KPI recomputation on small datasets), round results to the appropriate precision before display: `Math.round(value * 100) / 100` for 2-decimal currency.
5. **Test with real financial data patterns:** Large sums of small amounts, very large amounts (> 1 billion), negative amounts, zero amounts, mixed currencies.

**Warning signs:**
- Numbers with > 2 decimal places appearing in currency displays
- KPI summary not matching the sum of drill-down detail rows
- Users reporting "the numbers don't add up" even when the data is correct
- Break amounts showing as `-0.00` or `0.000000001` instead of `0.00`

**Phase to address:**
Foundational formatting utilities phase (very early). Create a shared `formatCurrency()`, `formatNumber()`, `formatPercentage()` utility module and enforce its use across all components. Never use `toFixed()` or string interpolation for financial numbers.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| JSON config files on disk instead of database | No DB schema needed, easy to edit | No versioning, no migration, no concurrent edits, server restart needed for changes | Only during initial development; migrate to DB before builder ships |
| In-memory Python dicts for state (`_views`, `_jobs`, `_query_history`) | No DB dependency for prototyping | Lost on restart, not shared across workers, not thread-safe | Never in production; acceptable only in local dev with explicit `DEV_MODE` flag |
| `except Exception: return MOCK_DATA` everywhere | App always renders something | Masks production failures, shows fake financial data to analysts | Never. Replace with proper error handling immediately |
| Hardcoded Superset admin credentials as defaults | Easy local setup | Security vulnerability if `.env` is missing in production | Only in local dev; production must require explicit env vars (fail fast on missing) |
| Client-side row model for AG Grid | Simpler implementation, no server-side pagination API needed | Browser memory exhaustion above ~100K rows | Acceptable for dashboards showing aggregated data (< 10K rows); use Server-Side Row Model for detail grids |
| Single SQL query per chart component | Clean component architecture | N+1 problem on dashboards with many panels | Acceptable for < 4 panels per dashboard; optimize for larger dashboards |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Superset REST API | Treating it as a stable, versioned API | Pin Superset version, build adapter layer, test all 14 consumed endpoints before upgrades |
| Superset CSRF tokens | Fetching token once and reusing forever | Re-fetch on session expiry; persist cookies in httpx client; handle "CSRF missing" errors with retry |
| Superset SQLLab | Sending raw user SQL without limits or timeouts | Add `LIMIT` clause enforcement, configure `SQLLAB_ASYNC_TIME_LIMIT_SEC`, use read-only DB users |
| Oracle via SQLAlchemy | Using default connection pool settings | Configure `pool_size=30`, `max_overflow=10`, `pool_timeout=30`, `pool_recycle=1800` for Oracle |
| Oracle date functions | Using PostgreSQL date syntax (`NOW()`, `INTERVAL`) | Use Oracle-specific functions (`SYSDATE`, `TRUNC()`, `ADD_MONTHS()`). The QueryEngine already handles some dialect differences -- ensure all date operations are dialect-aware |
| Redis cache | Assuming cache is always populated | Handle cache misses gracefully; set appropriate TTLs; warm caches on deploy for critical dashboards |
| Elasticsearch (future) | Treating ES as a relational database | ES excels at search and aggregation, not joins. Design ES queries for search/autocomplete, not for dashboard data |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Client-side aggregation of raw rows | Freezing UI, incorrect totals | Do all aggregation in database; backend returns pre-computed results | > 50K rows in cross-filter context |
| One API call per chart panel | Dashboard load time > 3s | Batch queries by data source; deduplicate via TanStack Query keys; add dashboard-level prefetch endpoint | > 6 panels per dashboard, or Oracle latency > 100ms |
| AG Grid Client-Side Row Model for detail data | Browser memory > 1GB, tab crashes | Use Server-Side Row Model with pagination for grids showing raw recon data | > 100K rows in grid |
| No Superset query caching | Oracle overloaded, queries timing out | Configure `DATA_CACHE_CONFIG` in Redis with 5-10 min TTL | > 10 concurrent users viewing dashboards with auto-refresh |
| Rendering all charts simultaneously | Layout jank, CPU spike, dropped frames | Progressive loading: KPIs -> charts -> grid. Use `IntersectionObserver` to defer off-screen chart rendering | > 8 charts per dashboard |
| Storing layout configs as JSON files | Server restart required for changes, no concurrent edits | Migrate to database storage with API endpoints for CRUD | > 20 dashboards, or when builder ships |
| Unthrottled auto-refresh | Redundant queries flooding the backend | Pause refresh when tab is hidden (`document.visibilityState`); only refresh if data is stale (compare with `staleTime`) | > 20 dashboards with auto-refresh across concurrent users |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| SQL Explorer forwarding arbitrary SQL to Superset | Data exfiltration, accidental DML (UPDATE/DELETE) on recon tables | Parse SQL to reject non-SELECT statements; use read-only database users; add query audit logging |
| No authentication on any endpoint | Any user/script on the network can query all recon data and execute SQL | Implement at minimum an API key middleware for internal use before production; SSO/OIDC for production |
| Hardcoded default admin credentials for Superset (`admin`/`admin`) | Unauthorized access to Superset if `.env` is missing | Remove defaults; require explicit env vars; fail fast on startup if credentials are not set |
| `X-Frame-Options: ALLOWALL` on all endpoints | Clickjacking attacks on the API | Restrict to `SAMEORIGIN` or specific allowed origins via CSP headers |
| SQLAlchemy URIs containing embedded passwords | Credentials appear in logs, error messages, Superset metadata | Use Superset's encrypted credentials feature; sanitize URIs in log output |
| No audit trail for dashboard changes | Cannot track who changed what, when. Compliance risk in financial operations | Add audit logging for all dashboard CRUD operations (create, edit, delete, publish) with user ID, timestamp, and before/after snapshots |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing > 12 KPIs per dashboard | 40% lower engagement; cognitive overload; users don't know where to focus | Limit to 4-6 KPIs per dashboard; additional metrics available via drill-down or secondary views |
| No visual hierarchy between KPIs | Every metric looks equally important; users miss critical breaks | Use size, color, and position to signal importance. Primary KPIs (total breaks, auto-match rate) get hero treatment; secondary metrics are smaller |
| Flat filter bar without context | Users don't understand what filters affect; unclear which filters are active | Show active filter count badge, "clear all" button, and visual feedback (highlight/dim) on affected panels when filters change |
| Builder with blank canvas start | Business users stare at an empty screen; don't know where to begin | Template-first approach: offer pre-built layouts users can customize. "Start from template" > "Start from scratch" |
| Chart type selection by name only | Users don't know which chart type fits their data; pick wrong visualization | Show chart type recommendations based on selected columns (e.g., "1 category + 1 metric = bar chart"). Visual thumbnails for each type |
| No indication of data freshness | Users don't know if they're seeing today's data or yesterday's | Show "Last refreshed: X minutes ago" on every dashboard. Use subtle visual indicator (green = fresh, amber = > 30 min, red = > 1 hour). Pair with manual refresh button |
| Cross-filter without visual feedback | Users click a chart segment and nothing visually happens; or they don't know cross-filtering exists | Highlight the source selection; dim/highlight affected panels; show a cross-filter breadcrumb bar (the legacy codebase has this pattern) |
| Layout editor that allows broken layouts | Users create overlapping panels, empty gaps, or layouts that look bad at different zoom levels | Snap-to-grid with collision prevention; minimum panel sizes; maximum panel count per dashboard; layout validation before publish |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Dashboard rendering:** Often missing error states for individual panels -- one failed chart should not blank the whole dashboard. Verify: each chart, KPI, and grid handles loading/error/empty states independently.
- [ ] **Filter bar:** Often missing reset-to-defaults, missing "Apply" button (filters should not trigger queries on every keystroke), missing filter persistence across navigation. Verify: filter state survives route changes, URL sync works for sharing.
- [ ] **Charts:** Often missing empty state ("No data matches your filters"), missing loading skeleton, missing axis label truncation for long labels (recon entity names can be 40+ characters). Verify all three states.
- [ ] **AG Grid:** Often missing column auto-sizing to content, missing Excel-style copy (Ctrl+C on selected cells), missing column reorder persistence. These are expected by finance users. Verify they work.
- [ ] **Dark mode:** Often broken in AG Grid themes, chart tooltips, Monaco editor, and PDF exports. Verify every component in both themes after each phase.
- [ ] **Builder save flow:** Often missing validation before save (empty title, no charts, duplicate names), missing confirmation on destructive actions (delete dashboard, remove panel). Verify with QA checklist.
- [ ] **Embed mode:** Often missing locked filter handling, missing theme parameter, missing error state when dashboard ID is invalid. Verify: `?filter.lock=region&theme=dark` works.
- [ ] **Cross-filtering:** Often missing clear selection action (how does the user undo a cross-filter click?), missing indicator of what is cross-filtered. Verify: click to filter, click again to clear, visual breadcrumb shows active cross-filters.
- [ ] **Export (chart-level):** Often missing: PNG export captures loading state or no-data state, CSV export doesn't include filters applied, clipboard copy loses formatting. Verify exports contain the correct data with correct formatting.
- [ ] **Number formatting:** Often missing: locale-aware thousand separators, negative number display (parentheses vs minus sign for finance), percentage formatting (x100 or not). Verify with real recon data patterns.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Client-side cross-filter at scale | MEDIUM | Add backend query endpoint for cross-filter aggregations; change cross-filter hook to use backend above threshold; keep client-side for small datasets |
| Superset version break | LOW-MEDIUM | Rollback Superset to pinned version; update adapter layer for new API shape; re-pin at new version |
| Dashboard config schema breakage | HIGH | Write retroactive migration for all saved configs; add version field to existing configs (assume v0); test migration on backup data first |
| N+1 query performance | MEDIUM | Add dashboard-level batch endpoint; adjust query keys for deduplication; implement progressive loading |
| Mock data masking production failure | LOW | Remove mock fallback; add proper error responses; deploy -- frontend error states already exist in config-driven components |
| Builder scope creep | HIGH | Freeze feature scope; ship what exists; create backlog for future phases; communicate explicitly with users about what is/isn't supported |
| Oracle query performance | MEDIUM-HIGH | Create materialized views; rewrite data source SQL to target views; tune connection pool; this requires DBA involvement and schema changes |
| CSRF/session failures | LOW | Disable CSRF for API-only access in trusted network; or implement proper cookie-based session management in httpx client |
| Layout persistence without undo | MEDIUM | Retrofit undo/redo stack into existing state management; add version counter for optimistic locking; more work if users have already saved layouts |
| Financial precision errors | LOW-MEDIUM | Create centralized formatting utilities; replace all inline number formatting; audit all client-side arithmetic |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Mock data fallback masking failures | Phase 1 (Foundation cleanup) | All endpoints return HTTP errors when Superset is down; frontend shows error states; zero instances of `except Exception: return MOCK_DATA` |
| Financial data precision | Phase 1 (Foundation) | Shared formatting utilities exist; no raw `toFixed()` or string interpolation for numbers; all KPI/grid values use `Intl.NumberFormat` |
| Superset version pinning | Phase 1 (Infrastructure) | `requirements.txt` has exact Superset version pin; integration tests exist for all 14 consumed API endpoints |
| CSRF/session hardening | Phase 1 (Backend) | CSRF strategy decided (disable for API or handle properly); retry logic covers 400/403 CSRF errors; token refresh is configurable |
| N+1 query pattern | Phase 2 (Dashboard rendering optimization) | Dashboard-level batch endpoint exists; charts sharing data sources share query keys; progressive loading implemented |
| Oracle query performance | Phase 2 (Data layer) | Materialized views created for common aggregations; connection pool tuned; load tested with production-scale data |
| Dashboard config schema versioning | Phase 3 (Builder foundation) | Schema version field exists on all configs; migration pipeline exists; Zod/Pydantic validation on load |
| Cross-filtering at scale | Phase 3 (Interactivity) | Hybrid cross-filter strategy implemented; client-side for < 50K rows; backend for larger datasets; threshold is configurable |
| Builder scope control | Phase 3 (Builder planning) | Feature boundary document exists; template-first approach implemented; feature request backlog with ROI scoring |
| Layout persistence + undo/redo | Phase 4 (Builder UI) | Undo/redo stack works (Ctrl+Z/Y); explicit save with unsaved indicator; optimistic locking for concurrent edits |
| Silent data staleness | Phase 4 (Polish) | Data freshness indicator on every dashboard; auto-refresh pauses when tab is hidden; manual refresh button works |

## Sources

- RecViz codebase analysis: `.planning/codebase/CONCERNS.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/ARCHITECTURE.md`
- Apache Superset UPDATING.md: https://github.com/apache/superset/blob/master/UPDATING.md
- Superset caching configuration: https://superset.apache.org/docs/configuration/cache/
- Superset async queries via Celery: https://superset.apache.org/docs/configuration/async-queries-celery/
- Superset CSRF issues: https://github.com/apache/superset/discussions/32751, https://github.com/apache/superset/issues/8382
- Superset Oracle performance: https://github.com/apache/superset/issues/8568
- Superset query timeout: https://github.com/apache/superset/issues/27473
- AG Grid Server-Side Row Model: https://www.ag-grid.com/react-data-grid/server-side-model/
- AG Charts large dataset optimization: https://blog.ag-grid.com/optimizing-large-data-set-visualisations-with-the-m4-algorithm/
- Dashboard design principles: https://www.uxpin.com/studio/blog/dashboard-design-principles/
- BI dashboard design best practices: https://julius.ai/articles/business-intelligence-dashboard-design-best-practices
- Cross-filtering patterns: https://square.github.io/crossfilter/, https://cloud.google.com/looker/docs/cross-filtering-dashboards
- Reconciliation dashboard patterns: https://www.osfin.ai/blog/reconciliation-dashboard, https://www.neoxam.com/aro/reconciliation-dashboards-reporting-audit-trails/
- BI failure rates and lessons: https://designingforanalytics.com/resources/failure-rates-for-analytics-bi-iot-and-big-data-projects-85-yikes/
- Build vs. buy analytics: https://www.sigmainfo.net/blog/custom-analytics-modules-vs-third-party-bi-tools-the-saas-builders-decision-framework-for-2026/
- Superset performance optimization: https://celerdata.com/glossary/best-practices-to-optimize-apache-superset-dashboards, https://preset.io/blog/the-data-engineers-guide-to-lightning-fast-apache-superset-dashboards/

---
*Pitfalls research for: RecViz internal BI platform for financial reconciliation*
*Researched: 2026-04-04*
