"""Dashboards API endpoints."""

import json
from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.db.models import Dashboard, DashboardChart, Chart, Query, DataSource
from app.schemas.dashboard import (
    DashboardCreate,
    DashboardUpdate,
    DashboardResponse,
    DashboardChartCreate,
    DashboardChartUpdate,
    DashboardChartResponse,
    DashboardFullResponse,
)
from app.connectors.mock import MockConnector

router = APIRouter()


# KPI Response schemas
class TrendInfo(BaseModel):
    value: float
    direction: str  # "up", "down", "flat"


class KPISummaryResponse(BaseModel):
    total_transactions: int
    match_rate: float
    open_breaks: int
    avg_break_age: float
    trends: dict[str, TrendInfo]


@router.get("/kpis/summary", response_model=KPISummaryResponse)
async def get_kpi_summary(db: AsyncSession = Depends(get_db)):
    """Get KPI summary for the home page.

    Returns aggregated metrics from the mock data tables.
    """
    try:
        # Get total transactions
        result = await db.execute(text("SELECT COUNT(*) FROM transactions"))
        total_transactions = result.scalar() or 0

        # Get match rate (percentage of matched transactions)
        result = await db.execute(text("""
            SELECT
                ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 2)
            FROM transactions
        """))
        match_rate = result.scalar() or 0.0

        # Get open breaks count
        result = await db.execute(text("SELECT COUNT(*) FROM breaks"))
        open_breaks = result.scalar() or 0

        # Get average break age
        result = await db.execute(text("SELECT ROUND(AVG(age_days), 1) FROM breaks"))
        avg_break_age = result.scalar() or 0.0

        # Calculate trends (compare to previous period - using daily_metrics)
        today = datetime.now().date()
        week_ago = today - timedelta(days=7)
        two_weeks_ago = today - timedelta(days=14)

        # Current week metrics
        result = await db.execute(text("""
            SELECT
                SUM(total_transactions) as txns,
                AVG(match_rate) as match_rate,
                SUM(breaks) as breaks,
                AVG(avg_break_age) as break_age
            FROM daily_metrics
            WHERE date >= :start_date
        """), {"start_date": week_ago})
        current = result.fetchone()

        # Previous week metrics
        result = await db.execute(text("""
            SELECT
                SUM(total_transactions) as txns,
                AVG(match_rate) as match_rate,
                SUM(breaks) as breaks,
                AVG(avg_break_age) as break_age
            FROM daily_metrics
            WHERE date >= :start_date AND date < :end_date
        """), {"start_date": two_weeks_ago, "end_date": week_ago})
        previous = result.fetchone()

        def calc_trend(current_val: Optional[float], prev_val: Optional[float]) -> TrendInfo:
            if not current_val or not prev_val or prev_val == 0:
                return TrendInfo(value=0, direction="flat")
            change = ((current_val - prev_val) / prev_val) * 100
            direction = "up" if change > 0 else "down" if change < 0 else "flat"
            return TrendInfo(value=round(abs(change), 1), direction=direction)

        trends = {
            "total_transactions": calc_trend(current[0] if current else 0, previous[0] if previous else 0),
            "match_rate": calc_trend(current[1] if current else 0, previous[1] if previous else 0),
            "open_breaks": calc_trend(current[2] if current else 0, previous[2] if previous else 0),
            "avg_break_age": calc_trend(current[3] if current else 0, previous[3] if previous else 0),
        }

        # For breaks and age, "up" is bad, so invert the direction display logic
        # (but keep the actual calculation the same)

        return KPISummaryResponse(
            total_transactions=total_transactions,
            match_rate=match_rate,
            open_breaks=open_breaks,
            avg_break_age=avg_break_age,
            trends=trends,
        )
    except Exception as e:
        # If tables don't exist yet, return zeros
        return KPISummaryResponse(
            total_transactions=0,
            match_rate=0.0,
            open_breaks=0,
            avg_break_age=0.0,
            trends={
                "total_transactions": TrendInfo(value=0, direction="flat"),
                "match_rate": TrendInfo(value=0, direction="flat"),
                "open_breaks": TrendInfo(value=0, direction="flat"),
                "avg_break_age": TrendInfo(value=0, direction="flat"),
            },
        )


def get_connector(data_source: DataSource):
    """Get the appropriate connector for a data source."""
    config = json.loads(data_source.connection_config) if data_source.connection_config else {}
    if data_source.type == "mock":
        return MockConnector(config)
    return MockConnector(config)


def dashboard_to_response(dashboard: Dashboard) -> DashboardResponse:
    """Convert dashboard model to response."""
    charts = [
        DashboardChartResponse(
            id=dc.id,
            chart_id=dc.chart_id,
            position_x=dc.position_x,
            position_y=dc.position_y,
            width=dc.width,
            height=dc.height,
            config=json.loads(dc.config) if dc.config else None,
        )
        for dc in dashboard.dashboard_charts
    ]

    return DashboardResponse(
        id=dashboard.id,
        name=dashboard.name,
        description=dashboard.description,
        layout=json.loads(dashboard.layout) if dashboard.layout else {},
        filters=json.loads(dashboard.filters) if dashboard.filters else None,
        created_at=dashboard.created_at,
        updated_at=dashboard.updated_at,
        charts=charts,
    )


@router.post("", response_model=DashboardResponse, status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    data: DashboardCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new dashboard."""
    dashboard = Dashboard(
        id=str(uuid4()),
        name=data.name,
        description=data.description,
        layout=json.dumps(data.layout) if data.layout else "{}",
        filters=json.dumps([f.model_dump() for f in data.filters]) if data.filters else None,
    )
    db.add(dashboard)
    await db.commit()
    await db.refresh(dashboard)

    return DashboardResponse(
        id=dashboard.id,
        name=dashboard.name,
        description=dashboard.description,
        layout=json.loads(dashboard.layout),
        filters=json.loads(dashboard.filters) if dashboard.filters else None,
        created_at=dashboard.created_at,
        updated_at=dashboard.updated_at,
        charts=[],
    )


@router.get("", response_model=list[DashboardResponse])
async def list_dashboards(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List all dashboards."""
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.dashboard_charts))
        .offset(skip)
        .limit(limit)
        .order_by(Dashboard.created_at.desc())
    )
    dashboards = result.scalars().all()
    return [dashboard_to_response(d) for d in dashboards]


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a dashboard by ID."""
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.dashboard_charts))
        .where(Dashboard.id == dashboard_id)
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    return dashboard_to_response(dashboard)


@router.get("/{dashboard_id}/full", response_model=DashboardFullResponse)
async def get_dashboard_full(
    dashboard_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a dashboard with all chart data."""
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.dashboard_charts))
        .where(Dashboard.id == dashboard_id)
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    chart_data = {}

    for dc in dashboard.dashboard_charts:
        # Get chart and its query
        result = await db.execute(
            select(Chart).options(selectinload(Chart.query)).where(Chart.id == dc.chart_id)
        )
        chart = result.scalar_one_or_none()
        if not chart or not chart.query or not chart.query.data_source_id:
            continue

        # Get data source
        result = await db.execute(
            select(DataSource).where(DataSource.id == chart.query.data_source_id)
        )
        data_source = result.scalar_one_or_none()
        if not data_source:
            continue

        # Execute query
        connector = get_connector(data_source)
        try:
            query_result = await connector.execute_query(chart.query.sql_text, limit=10000)
            chart_data[dc.chart_id] = {
                "data": query_result.data,
                "columns": query_result.columns,
                "config": json.loads(chart.config) if chart.config else {},
                "chart_type": chart.chart_type,
                "name": chart.name,
            }
        finally:
            await connector.close()

    return DashboardFullResponse(
        dashboard=dashboard_to_response(dashboard),
        chart_data=chart_data,
    )


@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: str,
    data: DashboardUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a dashboard."""
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.dashboard_charts))
        .where(Dashboard.id == dashboard_id)
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if data.name is not None:
        dashboard.name = data.name
    if data.description is not None:
        dashboard.description = data.description
    if data.layout is not None:
        dashboard.layout = json.dumps(data.layout)
    if data.filters is not None:
        dashboard.filters = json.dumps([f.model_dump() for f in data.filters])

    await db.commit()
    await db.refresh(dashboard)

    return dashboard_to_response(dashboard)


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    dashboard_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a dashboard."""
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    await db.delete(dashboard)
    await db.commit()


# Dashboard Charts endpoints
@router.post("/{dashboard_id}/charts", response_model=DashboardChartResponse, status_code=status.HTTP_201_CREATED)
async def add_chart_to_dashboard(
    dashboard_id: str,
    data: DashboardChartCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a chart to a dashboard."""
    # Verify dashboard exists
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Verify chart exists
    result = await db.execute(select(Chart).where(Chart.id == data.chart_id))
    chart = result.scalar_one_or_none()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    dashboard_chart = DashboardChart(
        id=str(uuid4()),
        dashboard_id=dashboard_id,
        chart_id=data.chart_id,
        position_x=data.position_x,
        position_y=data.position_y,
        width=data.width,
        height=data.height,
        config=json.dumps(data.config) if data.config else None,
    )
    db.add(dashboard_chart)
    await db.commit()
    await db.refresh(dashboard_chart)

    return DashboardChartResponse(
        id=dashboard_chart.id,
        chart_id=dashboard_chart.chart_id,
        position_x=dashboard_chart.position_x,
        position_y=dashboard_chart.position_y,
        width=dashboard_chart.width,
        height=dashboard_chart.height,
        config=json.loads(dashboard_chart.config) if dashboard_chart.config else None,
    )


@router.put("/{dashboard_id}/charts/{dashboard_chart_id}", response_model=DashboardChartResponse)
async def update_dashboard_chart(
    dashboard_id: str,
    dashboard_chart_id: str,
    data: DashboardChartUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a chart's position/size on a dashboard."""
    result = await db.execute(
        select(DashboardChart).where(
            DashboardChart.id == dashboard_chart_id,
            DashboardChart.dashboard_id == dashboard_id,
        )
    )
    dashboard_chart = result.scalar_one_or_none()
    if not dashboard_chart:
        raise HTTPException(status_code=404, detail="Dashboard chart not found")

    if data.position_x is not None:
        dashboard_chart.position_x = data.position_x
    if data.position_y is not None:
        dashboard_chart.position_y = data.position_y
    if data.width is not None:
        dashboard_chart.width = data.width
    if data.height is not None:
        dashboard_chart.height = data.height
    if data.config is not None:
        dashboard_chart.config = json.dumps(data.config)

    await db.commit()
    await db.refresh(dashboard_chart)

    return DashboardChartResponse(
        id=dashboard_chart.id,
        chart_id=dashboard_chart.chart_id,
        position_x=dashboard_chart.position_x,
        position_y=dashboard_chart.position_y,
        width=dashboard_chart.width,
        height=dashboard_chart.height,
        config=json.loads(dashboard_chart.config) if dashboard_chart.config else None,
    )


@router.delete("/{dashboard_id}/charts/{dashboard_chart_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_chart_from_dashboard(
    dashboard_id: str,
    dashboard_chart_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Remove a chart from a dashboard."""
    result = await db.execute(
        select(DashboardChart).where(
            DashboardChart.id == dashboard_chart_id,
            DashboardChart.dashboard_id == dashboard_id,
        )
    )
    dashboard_chart = result.scalar_one_or_none()
    if not dashboard_chart:
        raise HTTPException(status_code=404, detail="Dashboard chart not found")

    await db.delete(dashboard_chart)
    await db.commit()
