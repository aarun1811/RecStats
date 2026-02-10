# Agent 06 — Data Explorer Page

## Mission
Build the data explorer page with a Monaco SQL editor, schema browser, query results grid, and query history panel. This is the analyst workbench for ad-hoc SQL queries.

## Read First
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/CLAUDE.md`
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/agents/AGENT_00_RESULT.md`

## Working Directory
`/Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz/frontend/`

## What Already Exists
- Monaco Editor package: `@monaco-editor/react`
- Types: `api.ts` (SqlExecuteRequest, SqlExecuteResponse)
- Shadcn components: scroll-area, collapsible, tabs, skeleton, badge, button, select
- Route placeholder at `src/routes/explorer/index.tsx`

## Files To Create

### 1. `src/components/explorer/sql-editor.tsx`
Monaco Editor configured for SQL:
- Language: SQL
- Theme: match Shadcn light/dark (create custom Monaco theme)
- Features: autocomplete (table/column names from schema), syntax highlighting, minimap off, line numbers on
- Toolbar below editor: Run button (Cmd+Enter shortcut), Save query button, Format SQL button, Database selector dropdown
- Editor height: resizable via drag handle (default 250px, min 150px, max 500px)
- Keyboard shortcut: `Cmd+Enter` / `Ctrl+Enter` to execute
- Props: `onExecute(sql: string)`, `defaultValue`, `databaseId`

### 2. `src/components/explorer/schema-browser.tsx`
Tree view of databases → schemas → tables → columns:
- Uses Shadcn `<Collapsible>` for tree expand/collapse
- Icons: Database icon, Table icon, Column icon (from Lucide)
- Column entries show type badge (VARCHAR, NUMBER, DATE, etc.)
- Click on table name → inserts table name into editor
- Click on column → inserts column name into editor
- Search filter at top to filter tables/columns
- Data fetched from `/api/datasets` endpoint
- Loading state: skeleton tree items
- Width: 240px, resizable

### 3. `src/components/explorer/query-results.tsx`
Results display using AG Grid (import from Agent 05's GridWrapper if available, or create simple version):
- Shows query results in a sortable/filterable grid
- Header shows: execution time, row count, "Chart It" button, "Export CSV" button, "Copy" button
- "Chart It" button: opens a dialog to create a quick chart from the results
- Handle large result sets (AG Grid virtualizes automatically)
- Error state: show SQL error message in a red-bordered container
- Empty state: "Run a query to see results"
- Tabs for multiple query results (like browser tabs)

### 4. `src/components/explorer/query-history.tsx`
List of past queries:
- Shows: timestamp, SQL snippet (truncated), execution time, row count
- Click to reload query into editor
- Delete button to remove from history
- Stored in localStorage (no backend persistence needed for now)
- Uses Shadcn `<ScrollArea>` for scrollable list
- Most recent first
- Search/filter history

### 5. `src/components/explorer/explorer-layout.tsx`
Page layout composing all explorer components:
```
┌─────────────────────────────────────────────┐
│ ┌─ Schema ──┐ ┌─ SQL Editor ─────────────┐ │
│ │            │ │                           │ │
│ │ ▼ Oracle   │ │  SELECT * FROM breaks... │ │
│ │   ▶ breaks │ │                           │ │
│ │   ▶ txns   │ │          [▶ Run] [Format] │ │
│ └────────────┘ └───────────────────────────┘ │
│ ┌─ Results ─────────────────────────────────┐│
│ │ Tab1 | Tab2                                ││
│ │ ┌────┬────┬─────┐  Time: 0.8s  Rows: 42  ││
│ │ │ id │name│ val │                          ││
│ │ ├────┼────┼─────┤  [Chart It] [CSV] [Copy]││
│ │ └────┴────┴─────┘                          ││
│ └────────────────────────────────────────────┘│
│ ┌─ History ─────────────────────────────────┐│
│ │ 14:23 SELECT desk, COUNT(*)... 0.8s 8rows ││
│ └────────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```
- Schema browser on left (collapsible)
- SQL editor on top right
- Results below editor
- History at bottom (collapsible)
- All panels resizable via drag handles
- Use CSS Grid or flexbox with resize handles

### 6. Update route `src/routes/explorer/index.tsx`
Replace placeholder with `<ExplorerLayout />`.

## Design Requirements
- Monaco editor must feel native — no jarring iframe look
- Custom Monaco theme that uses Shadcn's background/foreground colors
- Schema browser: subtle tree lines, clean icons
- Results grid: same AG Grid styling as dashboard grid
- History: compact list, hover highlight, muted text for metadata
- Resizable panels: thin drag handles, cursor changes on hover

## Acceptance Criteria
- [ ] Monaco editor renders with SQL syntax highlighting
- [ ] Cmd+Enter executes query (calls onExecute callback)
- [ ] Schema browser shows tree of databases/tables/columns
- [ ] Clicking table/column name inserts into editor
- [ ] Query results render in AG Grid
- [ ] Query history stores and recalls past queries
- [ ] Multiple result tabs work
- [ ] All panels are resizable
- [ ] Dark mode works for Monaco + all components
- [ ] No TypeScript errors
