# Data Sources — Testing Guide

> Covers the Settings > Data Sources tab built across Tasks 1–15.

---

## Prerequisites

### Start the Backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Start the Frontend

```bash
cd frontend
pnpm dev
```

### Navigate to the Feature

Open `http://localhost:5173/settings` and click the **Data Sources** tab.

### Mock Mode vs Superset Mode

The backend tries Superset first and falls back to an in-memory mock store. If Superset is running and configured, you'll see live data. If not, you'll see 3 seeded mock databases:

| ID | Name | Backend | Datasets | Status |
|----|------|---------|----------|--------|
| 1 | recon_data | PostgreSQL | 4 | connected |
| 2 | oracle_prod | Oracle | 47 | connected |
| 3 | hive_warehouse | Hive | 12 | untested |

**To force mock mode**: stop Superset (or set `SUPERSET_URL` to an invalid host). The backend catches all Superset errors and silently falls back.

---

## 1. Database List View

### 1.1 Grid View (default)

| # | Test | Expected |
|---|------|----------|
| 1 | Page loads with Data Sources tab selected | Grid of database cards visible, 3 columns layout |
| 2 | Each card shows | DB icon (colored by backend), name, backend label, table count, status badge |
| 3 | Icon colors | PostgreSQL = blue, Oracle = red, Hive = yellow/amber, Elasticsearch = green |
| 4 | Status badges | "Connected" = green/emerald, "Untested" = amber, "Unreachable" = red |
| 5 | Hover on card | Subtle shadow lift (`hover:shadow-md`, `-translate-y-0.5`) |
| 6 | Click card | Detail sheet opens from right side |

### 1.2 List View

| # | Test | Expected |
|---|------|----------|
| 1 | Click list icon in toggle group | View switches to horizontal rows |
| 2 | Each row shows | DB icon, name, backend + table count, status badge, chevron |
| 3 | Click row | Detail sheet opens |
| 4 | Toggle back to grid | Cards return, no data refetch |

### 1.3 Search

| # | Test | Expected |
|---|------|----------|
| 1 | Type "oracle" in search | Only oracle_prod card/row shown |
| 2 | Type "postgresql" | Only recon_data shown (matches backend field) |
| 3 | Type "xyznotfound" | "No databases matching 'xyznotfound'" message |
| 4 | Clear search field | All databases return |
| 5 | Search is case-insensitive | "ORACLE" matches oracle_prod |
| 6 | Search persists across view mode toggle | Switching grid/list keeps filter active |

### 1.4 Empty State

| # | Test | Expected |
|---|------|----------|
| 1 | Delete all databases (or start with empty mock) | Shows empty state with Database icon, "No data sources configured" title, description, and "Add Data Source" button |
| 2 | Click "Add Data Source" in empty state | Create sheet opens |

### 1.5 Loading State

| # | Test | Expected |
|---|------|----------|
| 1 | Throttle network in DevTools, reload page | Grid: 3 skeleton rectangles (120px tall). List: 3 skeleton rectangles (56px tall) |

---

## 2. Detail Sheet

Click any database card/row to open the detail sheet.

### 2.1 Header

| # | Test | Expected |
|---|------|----------|
| 1 | Sheet opens from right, 540px wide | Smooth slide-in animation |
| 2 | Header shows DB icon + name + backend label | Icon colored by backend type |
| 3 | Created date shown if available | Format: locale date string |
| 4 | Status badge in header | Same styling as card badges |
| 5 | Close button (X) in top-right | Closes sheet |

### 2.2 Datasets Section

| # | Test | Expected |
|---|------|----------|
| 1 | Heading shows "Datasets (N of T)" | N = loaded count, T = total |
| 2 | Each dataset row | Chevron icon, table name, column count ("N cols") |
| 3 | Click dataset row | Chevron rotates down, expands to show "Column details loaded on demand" |
| 4 | Click expanded row again | Collapses back |
| 5 | Only one dataset expanded at a time | Clicking another collapses the previous |
| 6 | **Pagination** — oracle_prod has 47 datasets | First load shows 50 (all fit in 1 page), no "Load more" button |
| 7 | If a DB had 100+ datasets | "Load more" button appears at bottom, fetches next 50 |
| 8 | Sync button | Triggers POST `/{db_id}/sync`, shows spinner, toast: "Synced N datasets" |
| 9 | No datasets (e.g. newly created DB) | Shows "No datasets found. Click Sync to refresh." |

### 2.3 Test Connection (Detail View)

| # | Test | Expected |
|---|------|----------|
| 1 | Click "Test Connection" | Spinner shows while request in-flight |
| 2 | Mock mode result | Green checkmark + "Connection successful (mock mode)" |
| 3 | Superset mode failure | Red X + error message |
| 4 | Result persists until sheet re-opens | Close and reopen clears result |

### 2.4 Footer Actions

| # | Test | Expected |
|---|------|----------|
| 1 | Click "Edit" | Sheet transitions to edit form (prefilled) |
| 2 | Click "Delete" | Browser confirm dialog: `Delete "recon_data"? This cannot be undone.` |
| 3 | Confirm delete | Database removed, toast: `Deleted "recon_data"`, sheet closes, list refreshes |
| 4 | Cancel delete | Nothing happens, sheet stays open |

---

## 3. Create Database

Click "+ Add Source" button in toolbar.

### 3.1 Database Type Selector

| # | Test | Expected |
|---|------|----------|
| 1 | 4 buttons: PostgreSQL, Oracle, Hive, Elasticsearch | PostgreSQL selected by default |
| 2 | Each button shows DB icon + label | Icons use backend-specific colors |
| 3 | Click Oracle | Oracle highlighted, port field changes to 1521 |
| 4 | Click Hive | Port changes to 10000 |
| 5 | Click Elasticsearch | Port changes to 9200 |
| 6 | Switch back to PostgreSQL | Port changes to 5432 |

### 3.2 Display Name

| # | Test | Expected |
|---|------|----------|
| 1 | Placeholder: "e.g. recon_data_prod" | Text input field |
| 2 | Type a name | Save button remains disabled until host/URI also provided |
| 3 | Name with special characters | Accepted (no frontend validation beyond non-empty) |

### 3.3 Simple Connection Tab (default)

| # | Test | Expected |
|---|------|----------|
| 1 | Fields shown | Host, Port, Database, Schema, Username, Password |
| 2 | Port pre-filled with default | 5432 for PostgreSQL |
| 3 | Password field masked | `type="password"` |
| 4 | Placeholders | Host: "db-host.example.com", Database: "mydb", Schema: "public", Username: "db_user", Password: "........" |
| 5 | Host + Display Name filled | Save button becomes enabled |
| 6 | Only Display Name filled (no host) | Save button stays disabled |

### 3.4 Advanced Connection Tab

| # | Test | Expected |
|---|------|----------|
| 1 | Click "Advanced" toggle | Form fields replaced by SQLAlchemy URI textarea |
| 2 | Placeholder | "postgresql://user:pass@host:5432/dbname" |
| 3 | URI + Display Name filled | Save button enabled |
| 4 | Switch back to "Simple" | Form fields return (URI value preserved separately) |

### 3.5 Test Connection (Create Form)

| # | Test | Expected |
|---|------|----------|
| 1 | Fill simple fields, click "Test Connection" | Sends `{ backend, host, port, database, username, password }` |
| 2 | Fill advanced URI, click "Test Connection" | Sends `{ backend, sqlalchemyUri }` |
| 3 | Success response | Green checkmark + message below button |
| 4 | Failure response | Red X + error message |

### 3.6 Save

| # | Test | Expected |
|---|------|----------|
| 1 | Fill name + host, click "Save" | POST to `/api/databases`, spinner on button |
| 2 | Success | Toast: `Created "my_database"`, sheet closes |
| 3 | New database appears in list | List auto-refreshes (query invalidation) |
| 4 | New DB has status "untested" | Amber badge |
| 5 | Click "Cancel" | Sheet closes, nothing created |

### 3.7 URI Builder Verification (Backend)

Test these via the create flow or directly via API:

| Backend | Simple Fields | Expected URI |
|---------|--------------|--------------|
| PostgreSQL | host=localhost, port=5432, db=mydb, user=admin, pass=secret | `postgresql://admin:secret@localhost:5432/mydb` |
| Oracle | host=orahost, port=1521, db=ORCL, user=sys, pass=p@ss | `oracle+cx_oracle://sys:p%40ss@orahost:1521/?service_name=ORCL` |
| Hive | host=hivehost, port=10000, db=default, user=hive | `hive://hive@hivehost:10000/default` |
| Elasticsearch | host=eshost, port=9200 | `elasticsearch+http://eshost:9200/` |
| Elasticsearch | host=eshost, port=443 | `elasticsearch+https://eshost:443/` |

**Special character test**: password `p@ss!w#rd` should become `p%40ss%21w%23rd` in the URI.

---

## 4. Edit Database

From detail view, click "Edit".

| # | Test | Expected |
|---|------|----------|
| 1 | Form opens pre-filled | Display name populated from current DB |
| 2 | Backend type selected | Matches current DB backend |
| 3 | Title reads "Edit Data Source" | Subtitle: "Update connection details" |
| 4 | Button reads "Update" (not "Save") | Disabled until form valid |
| 5 | Change display name, click "Update" | PUT to `/api/databases/{id}`, toast: `Updated "new_name"` |
| 6 | After update | Returns to detail view (not closes sheet), detail shows new name |
| 7 | Click "Cancel" in edit mode | Returns to detail view without saving |
| 8 | Test Connection works in edit | Same as create flow |

---

## 5. Dark Mode

Toggle dark mode using the sun/moon button in the top-right header.

| # | Test | Expected |
|---|------|----------|
| 1 | Grid view in dark mode | Cards have dark background, white text, proper border contrast |
| 2 | List view in dark mode | Rows have dark background with muted borders |
| 3 | Backend icon colors | PostgreSQL = `blue-400`, Oracle = `red-400`, Hive = `yellow-400`, ES = `green-400` |
| 4 | Status badges in dark mode | Connected = dark emerald bg, Unreachable = dark red bg, Untested = dark amber bg |
| 5 | Detail sheet in dark mode | Proper contrast on header, datasets list, buttons |
| 6 | Create/Edit form in dark mode | Input fields, textarea, buttons all readable |
| 7 | DB type selector in dark mode | Selected button has visible border highlight |
| 8 | Test connection result in dark mode | Green/red icons visible against dark background |
| 9 | Toast notifications in dark mode | Sonner toasts adapt to theme |
| 10 | Toggle theme with sheet open | Sheet re-renders correctly without closing |

---

## 6. API Endpoints Reference

For manual testing with `curl` or Postman:

```bash
# List all databases
curl http://localhost:8000/api/databases

# Get single database
curl http://localhost:8000/api/databases/1

# Get datasets (paginated)
curl "http://localhost:8000/api/databases/2/datasets?page=1&page_size=50"

# Create database
curl -X POST http://localhost:8000/api/databases \
  -H "Content-Type: application/json" \
  -d '{
    "databaseName": "test_db",
    "backend": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "testdb",
    "username": "admin",
    "password": "secret"
  }'

# Update database
curl -X PUT http://localhost:8000/api/databases/4 \
  -H "Content-Type: application/json" \
  -d '{"databaseName": "renamed_db"}'

# Delete database
curl -X DELETE http://localhost:8000/api/databases/4

# Test connection
curl -X POST http://localhost:8000/api/databases/test \
  -H "Content-Type: application/json" \
  -d '{
    "backend": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "testdb",
    "username": "admin",
    "password": "secret"
  }'

# Sync datasets
curl -X POST http://localhost:8000/api/databases/1/sync
```

---

## 7. Known Limitations

| Item | Detail |
|------|--------|
| Delete uses `window.confirm` | Browser-native dialog, not Shadcn AlertDialog. Works but doesn't match the premium UI feel. |
| Dataset column expansion | Shows placeholder text "Column details loaded on demand". Actual column fetching from Superset not yet wired. |
| Dataset count on cards | Superset integration path hardcodes `dataset_count: 0`. Mock data shows correct counts. |
| No form-level validation errors | Missing host or name just keeps Save disabled — no red error messages on individual fields. |
| In-memory mock store | Resets on backend restart. Changes made in mock mode are not persisted to disk. |
| Edit form pre-fill | Only display name is pre-filled. Connection fields (host, port, etc.) are not returned by the backend GET endpoint (Superset doesn't expose them), so the form starts blank for connection fields. |

---

## 8. Files Involved

### Frontend
| File | Purpose |
|------|---------|
| `src/components/settings/data-sources-tab.tsx` | Main orchestrator — view mode, search, sheet state |
| `src/components/settings/data-sources-toolbar.tsx` | Search input, grid/list toggle, Add Source button |
| `src/components/settings/data-source-card.tsx` | Grid card + shared constants (colors, labels) |
| `src/components/settings/data-source-row.tsx` | List row variant |
| `src/components/settings/data-source-sheet.tsx` | Detail/Create/Edit sheet (~760 lines) |
| `src/hooks/use-databases.ts` | 8 TanStack Query hooks for all CRUD operations |
| `src/types/database.ts` | TypeScript types for all database-related models |
| `src/lib/api-client.ts` | HTTP client (added `put` method) |
| `src/routes/settings/index.tsx` | Settings page (wires in DataSourcesTab) |

### Backend
| File | Purpose |
|------|---------|
| `app/api/databases.py` | 8 route handlers (list, get, datasets, create, update, delete, test, sync) |
| `app/models/database.py` | 5 Pydantic models (Create, Update, Info, TestReq, TestRes) |
| `app/services/uri_builder.py` | SQLAlchemy URI construction for 4 backends |
| `app/services/superset_client.py` | 5 new methods (get, create, update, delete, test) |
| `app/mock_data.py` | 3 mock databases + dataset lists |
| `app/api/router.py` | Router registration |
