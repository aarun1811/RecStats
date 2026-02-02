# RecStats Codebase Analytics

*Last updated: 2026-02-02*

## Overview

| Metric | Value |
|--------|-------|
| Total Source Files | 99 |
| Total Lines of Code | 27,878 |
| Project Age | 6 days |
| Total Commits | 78 |

---

## Source Files

| Type | Files | Percentage |
|------|-------|------------|
| TypeScript | 65 | 66% |
| Python | 29 | 29% |
| SCSS | 4 | 4% |
| HTML | 1 | 1% |
| **Total** | **99** | **100%** |

---

## Lines of Code

| Language | Lines | Percentage |
|----------|-------|------------|
| TypeScript | 21,050 | 75% |
| Python | 5,017 | 18% |
| SCSS | 1,787 | 6% |
| HTML | 24 | <1% |
| **Total** | **27,878** | **100%** |

---

## Largest Files

| Lines | File |
|-------|------|
| 2,066 | `features/query-editor/query-editor.component.ts` |
| 2,026 | `features/chart-builder/chart-builder.component.ts` |
| 1,439 | `features/chart-builder/chart-list.component.ts` |
| 1,435 | `features/data-sources/data-source-sidebar.component.ts` |
| 1,227 | `features/dashboard-builder/dashboard-list.component.ts` |
| 1,165 | `backend/app/db/seed_data.py` |
| 1,120 | `features/data-sources/data-source-list.component.ts` |
| 854 | `features/dashboard-builder/chart-picker-panel.component.ts` |
| 838 | `features/dashboard-viewer/home.component.ts` |
| 729 | `features/collections/collections-list.component.ts` |

---

## Architecture

### Frontend (Angular 19)

| Category | Count |
|----------|-------|
| Feature Components | 38 |
| Shared Components | 14 |
| Core Services | 6 |
| Global Stylesheets | 3 |
| **Total** | **61** |

### Backend (FastAPI + SQLAlchemy)

| Category | Count |
|----------|-------|
| API Endpoints | 10 |
| Pydantic Schemas | 6 |
| Data Connectors | 5 |
| Database Models | 3 |
| **Total** | **24** |

---

## Project Velocity

| Metric | Value |
|--------|-------|
| Total Commits | 78 |
| Project Age | 6 days |
| Commits per Day | 13.0 |
| Start Date | 2026-01-26 |
| Latest Commit | 2026-02-02 |

---

## Tech Stack

**Frontend**
- Angular 19 with Signals
- TypeScript
- SCSS with CSS Variables
- ECharts for visualizations
- AG Grid for data tables
- Angular Gridster2 for dashboards
- DuckDB-WASM for in-browser SQL

**Backend**
- Python 3.12
- FastAPI
- SQLAlchemy (async)
- Pydantic
- SQLite (development)
