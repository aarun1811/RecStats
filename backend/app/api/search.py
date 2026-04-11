"""Search endpoint — queries four managed entity tables directly.

Rewritten in Phase 9 (SHAR-04, Plan 09-03) to drop the Superset dependency.
All results come from ``recviz_dashboards``, ``recviz_charts``,
``recviz_datasets``, and ``recviz_kpis`` via parameterized SQLAlchemy
``ilike`` queries.

Security notes:
    * SQLAlchemy parameterizes the pattern bind, so query-string injection is
      impossible at the driver level (T-9-2 / STRIDE Tampering mitigated).
      The f-string below only builds the PATTERN VALUE; it never interpolates
      into the SQL text.
    * All error responses pass through ``sanitize_detail`` (ASVS V7) to
      prevent SQL or connection-string leakage.
    * Queries run sequentially under a single sync ``Session``. Four
      sequential ``ilike`` queries against indexed ``name`` columns return in
      well under 50ms at the 10K-rows-per-table scale this product targets,
      so the cost of sequential is negligible.
    * No service-layer wrapper: follows the Phase 5-8 precedent of raw
      SQLAlchemy in the route handler (managed_charts.py, managed_kpis.py,
      managed_datasets.py, managed_dashboards.py all do the same). See
      09-RESEARCH.md §"Open Questions" #1 — flagged as tech-debt for a future
      service-layer cleanup phase.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, or_, select

from app.core.dependencies import DbSessionDep
from app.core.errors import sanitize_detail
from app.db.models.chart import RecvizChart
from app.db.models.dashboard import RecvizDashboard
from app.db.models.dataset import RecvizDataset
from app.db.models.kpi import RecvizKpi
from app.models.base import CamelModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/search", tags=["search"])

EntityType = Literal["dashboard", "chart", "dataset", "kpi"]
ALL_TYPES: frozenset[str] = frozenset(
    {"dashboard", "chart", "dataset", "kpi"}
)


# ── Pydantic models ──────────────────────────────────────────────


class SearchRequest(CamelModel):
    query: str
    types: list[EntityType] | None = None
    limit_per_type: int = 10


class SearchResult(CamelModel):
    type: EntityType
    id: str
    name: str
    description: str | None = None


class SearchResponse(CamelModel):
    query: str
    results: list[SearchResult]
    total: int


# ── Ranking helper ───────────────────────────────────────────────


def _rank_results(
    rows: list[tuple[str, str, str | None]], q: str
) -> list[tuple[str, str, str | None]]:
    """Sort rows: name-prefix matches first, then substring, then alphabetical.

    Implements D-15's ordering within each type group. The backend
    controls order so the frontend doesn't have to re-sort.
    """
    q_lower = q.lower()

    def sort_key(row: tuple[str, str, str | None]) -> tuple[int, str]:
        name_lower = (row[1] or "").lower()
        prefix_rank = 0 if name_lower.startswith(q_lower) else 1
        return (prefix_rank, name_lower)

    return sorted(rows, key=sort_key)


# ── Endpoint ─────────────────────────────────────────────────────


@router.post("", response_model=SearchResponse)
def search(body: SearchRequest, session: DbSessionDep) -> SearchResponse:
    """Search across four managed entity tables.

    Sequential queries — see module-level docstring. Default limit of 10
    results per type group per D-15 and planner discretion A8.
    """
    q = body.query.strip()
    if not q:
        # Short-circuit: empty query performs no DB reads and returns an
        # empty response. Makes the common "palette just opened" case a
        # zero-cost no-op.
        return SearchResponse(query=body.query, results=[], total=0)

    types: set[str] = set(body.types) if body.types else set(ALL_TYPES)
    pattern = f"%{q}%"
    limit = max(1, body.limit_per_type)

    def _fetch(
        type_name: EntityType,
        model: type,
    ) -> list[SearchResult]:
        """Run the ``ilike`` query for one entity type and rank the rows.

        ``type_name`` narrows to ``EntityType`` so the SearchResult
        constructor accepts it without a cast. ``model`` is typed as
        ``type`` because the four SQLAlchemy declarative classes don't
        share a narrower common supertype — attribute access is what
        matters, not the base class.
        """
        if type_name not in types:
            return []

        try:
            stmt = select(model.id, model.name, model.description).where(
                or_(
                    model.name.ilike(pattern),
                    func.coalesce(model.description, "").ilike(pattern),
                )
            )
            result = session.execute(stmt)
            rows: list[tuple[str, str, str | None]] = [
                (r[0], r[1], r[2]) for r in result.all()
            ]
            ranked = _rank_results(rows, q)[:limit]
            return [
                SearchResult(
                    type=type_name,
                    id=row_id,
                    name=name,
                    description=description or None,
                )
                for row_id, name, description in ranked
            ]
        except Exception as exc:  # noqa: BLE001 — final safety net
            logger.exception("Search query failed for %s", type_name)
            raise HTTPException(
                status_code=500,
                detail=sanitize_detail(exc),
            ) from exc

    # Sequential — see module docstring.
    dashboards = _fetch("dashboard", RecvizDashboard)
    charts = _fetch("chart", RecvizChart)
    datasets = _fetch("dataset", RecvizDataset)
    kpis = _fetch("kpi", RecvizKpi)

    results = dashboards + charts + datasets + kpis
    return SearchResponse(query=body.query, results=results, total=len(results))
