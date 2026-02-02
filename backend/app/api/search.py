"""Search and Recent Activity API endpoints."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query as QueryParam
from pydantic import BaseModel
from sqlalchemy import select, or_, union_all, literal_column
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.db.models import Query, Chart, Dashboard

router = APIRouter()


class SearchResultItem(BaseModel):
    """Schema for a search result item."""

    id: str
    name: str
    description: Optional[str] = None
    type: str  # "query", "chart", "dashboard"
    updated_at: datetime
    route: str  # Frontend route to navigate to


class RecentActivityItem(BaseModel):
    """Schema for a recent activity item."""

    id: str
    name: str
    description: Optional[str] = None
    type: str  # "query", "chart", "dashboard"
    updated_at: datetime
    route: str


@router.get("/search", response_model=list[SearchResultItem])
async def unified_search(
    q: str = QueryParam(..., min_length=1, description="Search query"),
    limit: int = QueryParam(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Search across queries, charts, and dashboards by name or description."""
    search_term = f"%{q}%"
    results: list[SearchResultItem] = []

    # Search queries
    query_result = await db.execute(
        select(Query)
        .where(
            or_(
                Query.name.ilike(search_term),
                Query.description.ilike(search_term),
            )
        )
        .order_by(Query.updated_at.desc())
        .limit(limit)
    )
    for query in query_result.scalars():
        results.append(
            SearchResultItem(
                id=query.id,
                name=query.name,
                description=query.description,
                type="query",
                updated_at=query.updated_at,
                route="/queries",
            )
        )

    # Search charts
    chart_result = await db.execute(
        select(Chart)
        .where(
            or_(
                Chart.name.ilike(search_term),
                Chart.description.ilike(search_term),
            )
        )
        .order_by(Chart.updated_at.desc())
        .limit(limit)
    )
    for chart in chart_result.scalars():
        results.append(
            SearchResultItem(
                id=chart.id,
                name=chart.name,
                description=chart.description,
                type="chart",
                updated_at=chart.updated_at,
                route=f"/charts/{chart.id}/edit",
            )
        )

    # Search dashboards
    dashboard_result = await db.execute(
        select(Dashboard)
        .where(
            or_(
                Dashboard.name.ilike(search_term),
                Dashboard.description.ilike(search_term),
            )
        )
        .order_by(Dashboard.updated_at.desc())
        .limit(limit)
    )
    for dashboard in dashboard_result.scalars():
        results.append(
            SearchResultItem(
                id=dashboard.id,
                name=dashboard.name,
                description=dashboard.description,
                type="dashboard",
                updated_at=dashboard.updated_at,
                route=f"/dashboards/{dashboard.id}",
            )
        )

    # Sort all results by updated_at and limit
    results.sort(key=lambda x: x.updated_at, reverse=True)
    return results[:limit]


@router.get("/recent", response_model=list[RecentActivityItem])
async def get_recent_activity(
    limit: int = QueryParam(default=5, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get recently updated items across all types (queries, charts, dashboards)."""
    results: list[RecentActivityItem] = []

    # Get recent queries
    query_result = await db.execute(
        select(Query).order_by(Query.updated_at.desc()).limit(limit)
    )
    for query in query_result.scalars():
        results.append(
            RecentActivityItem(
                id=query.id,
                name=query.name,
                description=query.description,
                type="query",
                updated_at=query.updated_at,
                route="/queries",
            )
        )

    # Get recent charts
    chart_result = await db.execute(
        select(Chart).order_by(Chart.updated_at.desc()).limit(limit)
    )
    for chart in chart_result.scalars():
        results.append(
            RecentActivityItem(
                id=chart.id,
                name=chart.name,
                description=chart.description,
                type="chart",
                updated_at=chart.updated_at,
                route=f"/charts/{chart.id}/edit",
            )
        )

    # Get recent dashboards
    dashboard_result = await db.execute(
        select(Dashboard).order_by(Dashboard.updated_at.desc()).limit(limit)
    )
    for dashboard in dashboard_result.scalars():
        results.append(
            RecentActivityItem(
                id=dashboard.id,
                name=dashboard.name,
                description=dashboard.description,
                type="dashboard",
                updated_at=dashboard.updated_at,
                route=f"/dashboards/{dashboard.id}",
            )
        )

    # Sort all results by updated_at and limit
    results.sort(key=lambda x: x.updated_at, reverse=True)
    return results[:limit]


@router.get("/favorites", response_model=list[RecentActivityItem])
async def get_favorites(
    limit: int = QueryParam(default=5, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get random dashboards as favorites (temporary until user favorites are implemented)."""
    results: list[RecentActivityItem] = []

    # Get dashboards (using ORDER BY RANDOM() equivalent for SQLite)
    from sqlalchemy import func

    dashboard_result = await db.execute(
        select(Dashboard).order_by(func.random()).limit(limit)
    )
    for dashboard in dashboard_result.scalars():
        results.append(
            RecentActivityItem(
                id=dashboard.id,
                name=dashboard.name,
                description=dashboard.description,
                type="dashboard",
                updated_at=dashboard.updated_at,
                route=f"/dashboards/{dashboard.id}",
            )
        )

    return results
