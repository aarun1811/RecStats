"""Dashboard Filters API endpoints."""

import json
import time
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.db.models import (
    DashboardFilter,
    FilterChartMapping,
    Dashboard,
    Chart,
    DataSource,
)
from app.schemas.filter import (
    FilterCreate,
    FilterUpdate,
    FilterResponse,
    FilterChartMappingCreate,
    FilterChartMappingUpdate,
    FilterChartMappingResponse,
    FilterValuesRequest,
    FilterValuesResponse,
    FilterOption,
    AppliedFilter,
    FilteredChartDataResponse,
    ReorderFiltersRequest,
)
from app.connectors import get_connector as get_db_connector

router = APIRouter()


# ============================================================================
# Helper Functions
# ============================================================================


def get_connector(data_source: DataSource):
    """Get the appropriate connector for a data source."""
    config = json.loads(data_source.connection_config) if data_source.connection_config else {}
    return get_db_connector(data_source.type, config)


def filter_to_response(
    filter_model: DashboardFilter,
    include_mappings: bool = True
) -> FilterResponse:
    """Convert DashboardFilter model to response."""
    chart_mappings = []
    if include_mappings and filter_model.chart_mappings:
        chart_mappings = [
            FilterChartMappingResponse(
                id=m.id,
                filter_id=m.filter_id,
                chart_id=m.chart_id,
                chart_name=m.chart.name if m.chart else None,
                column_name=m.column_name,
                operator=m.operator,
                enabled=m.enabled,
            )
            for m in filter_model.chart_mappings
        ]

    static_options = None
    if filter_model.static_options:
        try:
            static_options = [
                FilterOption(**opt) for opt in json.loads(filter_model.static_options)
            ]
        except (json.JSONDecodeError, TypeError):
            static_options = None

    default_value = None
    if filter_model.default_value:
        try:
            default_value = json.loads(filter_model.default_value)
        except (json.JSONDecodeError, TypeError):
            default_value = filter_model.default_value

    return FilterResponse(
        id=filter_model.id,
        dashboard_id=filter_model.dashboard_id,
        name=filter_model.name,
        filter_type=filter_model.filter_type,
        values_query=filter_model.values_query,
        static_options=static_options,
        data_source_id=filter_model.data_source_id,
        default_value=default_value,
        placeholder=filter_model.placeholder,
        required=filter_model.required,
        display_order=filter_model.display_order,
        min_value=filter_model.min_value,
        max_value=filter_model.max_value,
        chart_mappings=chart_mappings,
        created_at=filter_model.created_at,
        updated_at=filter_model.updated_at,
    )


# ============================================================================
# Dashboard Filters CRUD
# ============================================================================


@router.get("/dashboards/{dashboard_id}/filters", response_model=list[FilterResponse])
async def get_dashboard_filters(
    dashboard_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all filters for a dashboard."""
    # Verify dashboard exists
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Get filters with mappings
    result = await db.execute(
        select(DashboardFilter)
        .options(
            selectinload(DashboardFilter.chart_mappings).selectinload(FilterChartMapping.chart)
        )
        .where(DashboardFilter.dashboard_id == dashboard_id)
        .order_by(DashboardFilter.display_order)
    )
    filters = result.scalars().all()

    return [filter_to_response(f) for f in filters]


@router.post("/filters", response_model=FilterResponse, status_code=status.HTTP_201_CREATED)
async def create_filter(
    data: FilterCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new dashboard filter."""
    # Verify dashboard exists
    result = await db.execute(select(Dashboard).where(Dashboard.id == data.dashboard_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Verify data source if provided
    if data.data_source_id:
        result = await db.execute(
            select(DataSource).where(DataSource.id == data.data_source_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Data source not found")

    # Create filter
    filter_model = DashboardFilter(
        id=str(uuid4()),
        dashboard_id=data.dashboard_id,
        name=data.name,
        filter_type=data.filter_type.value,
        values_query=data.values_query,
        static_options=json.dumps([opt.model_dump() for opt in data.static_options]) if data.static_options else None,
        data_source_id=data.data_source_id,
        default_value=json.dumps(data.default_value) if data.default_value is not None else None,
        placeholder=data.placeholder,
        required=data.required,
        display_order=data.display_order,
        min_value=data.min_value,
        max_value=data.max_value,
    )
    db.add(filter_model)

    # Create chart mappings if provided
    if data.chart_mappings:
        for mapping_data in data.chart_mappings:
            # Verify chart exists
            result = await db.execute(
                select(Chart).where(Chart.id == mapping_data.chart_id)
            )
            if not result.scalar_one_or_none():
                raise HTTPException(
                    status_code=404,
                    detail=f"Chart {mapping_data.chart_id} not found"
                )

            mapping = FilterChartMapping(
                id=str(uuid4()),
                filter_id=filter_model.id,
                chart_id=mapping_data.chart_id,
                column_name=mapping_data.column_name,
                operator=mapping_data.operator.value,
                enabled=mapping_data.enabled,
            )
            db.add(mapping)

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(DashboardFilter)
        .options(
            selectinload(DashboardFilter.chart_mappings).selectinload(FilterChartMapping.chart)
        )
        .where(DashboardFilter.id == filter_model.id)
    )
    filter_model = result.scalar_one()

    return filter_to_response(filter_model)


@router.get("/filters/{filter_id}", response_model=FilterResponse)
async def get_filter(
    filter_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific filter."""
    result = await db.execute(
        select(DashboardFilter)
        .options(
            selectinload(DashboardFilter.chart_mappings).selectinload(FilterChartMapping.chart)
        )
        .where(DashboardFilter.id == filter_id)
    )
    filter_model = result.scalar_one_or_none()

    if not filter_model:
        raise HTTPException(status_code=404, detail="Filter not found")

    return filter_to_response(filter_model)


@router.put("/filters/{filter_id}", response_model=FilterResponse)
async def update_filter(
    filter_id: str,
    data: FilterUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a filter."""
    result = await db.execute(
        select(DashboardFilter).where(DashboardFilter.id == filter_id)
    )
    filter_model = result.scalar_one_or_none()

    if not filter_model:
        raise HTTPException(status_code=404, detail="Filter not found")

    # Update fields
    if data.name is not None:
        filter_model.name = data.name
    if data.filter_type is not None:
        filter_model.filter_type = data.filter_type.value
    if data.values_query is not None:
        filter_model.values_query = data.values_query
    if data.static_options is not None:
        filter_model.static_options = json.dumps([opt.model_dump() for opt in data.static_options])
    if data.data_source_id is not None:
        filter_model.data_source_id = data.data_source_id
    if data.default_value is not None:
        filter_model.default_value = json.dumps(data.default_value)
    if data.placeholder is not None:
        filter_model.placeholder = data.placeholder
    if data.required is not None:
        filter_model.required = data.required
    if data.display_order is not None:
        filter_model.display_order = data.display_order
    if data.min_value is not None:
        filter_model.min_value = data.min_value
    if data.max_value is not None:
        filter_model.max_value = data.max_value

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(DashboardFilter)
        .options(
            selectinload(DashboardFilter.chart_mappings).selectinload(FilterChartMapping.chart)
        )
        .where(DashboardFilter.id == filter_id)
    )
    filter_model = result.scalar_one()

    return filter_to_response(filter_model)


@router.delete("/filters/{filter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_filter(
    filter_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a filter."""
    result = await db.execute(
        select(DashboardFilter).where(DashboardFilter.id == filter_id)
    )
    filter_model = result.scalar_one_or_none()

    if not filter_model:
        raise HTTPException(status_code=404, detail="Filter not found")

    await db.delete(filter_model)
    await db.commit()


@router.put("/dashboards/{dashboard_id}/filters/reorder", status_code=status.HTTP_200_OK)
async def reorder_filters(
    dashboard_id: str,
    data: ReorderFiltersRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reorder filters for a dashboard."""
    # Update display_order for each filter
    for order, filter_id in enumerate(data.filter_ids):
        result = await db.execute(
            select(DashboardFilter).where(
                DashboardFilter.id == filter_id,
                DashboardFilter.dashboard_id == dashboard_id
            )
        )
        filter_model = result.scalar_one_or_none()
        if filter_model:
            filter_model.display_order = order

    await db.commit()
    return {"status": "ok"}


# ============================================================================
# Filter Values
# ============================================================================


@router.get("/filters/{filter_id}/values", response_model=FilterValuesResponse)
async def get_filter_values(
    filter_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Execute the filter's values query and return options."""
    result = await db.execute(
        select(DashboardFilter)
        .options(selectinload(DashboardFilter.data_source))
        .where(DashboardFilter.id == filter_id)
    )
    filter_model = result.scalar_one_or_none()

    if not filter_model:
        raise HTTPException(status_code=404, detail="Filter not found")

    # If static options, return those
    if filter_model.static_options:
        try:
            options = [FilterOption(**opt) for opt in json.loads(filter_model.static_options)]
            return FilterValuesResponse(
                filter_id=filter_id,
                options=options,
                execution_time_ms=0,
            )
        except (json.JSONDecodeError, TypeError):
            pass

    # Execute values query
    if not filter_model.values_query:
        return FilterValuesResponse(
            filter_id=filter_id,
            options=[],
            execution_time_ms=0,
        )

    start_time = time.time()

    try:
        # Execute directly against SQLite for now
        result = await db.execute(text(filter_model.values_query))
        rows = result.fetchall()
        columns = list(result.keys()) if result.keys() else []

        # Build options from first column
        options = []
        for row in rows:
            value = row[0] if len(row) > 0 else None
            if value is not None:
                label = str(row[1]) if len(row) > 1 else str(value)
                count = row[2] if len(row) > 2 else None
                options.append(FilterOption(value=value, label=label, count=count))

        execution_time_ms = (time.time() - start_time) * 1000

        return FilterValuesResponse(
            filter_id=filter_id,
            options=options,
            execution_time_ms=round(execution_time_ms, 2),
        )

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to execute values query: {str(e)}"
        )


@router.post("/filters/values/preview", response_model=FilterValuesResponse)
async def preview_filter_values(
    data: FilterValuesRequest,
    db: AsyncSession = Depends(get_db),
):
    """Execute an ad-hoc values query for preview."""
    start_time = time.time()

    try:
        # Execute directly against SQLite
        result = await db.execute(text(data.values_query))
        rows = result.fetchall()

        # Build options from first column
        options = []
        for row in rows[:data.limit]:
            value = row[0] if len(row) > 0 else None
            if value is not None:
                label = str(row[1]) if len(row) > 1 else str(value)
                count = row[2] if len(row) > 2 else None
                options.append(FilterOption(value=value, label=label, count=count))

        execution_time_ms = (time.time() - start_time) * 1000

        return FilterValuesResponse(
            filter_id=None,
            options=options,
            execution_time_ms=round(execution_time_ms, 2),
        )

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to execute values query: {str(e)}"
        )


# ============================================================================
# Filter Chart Mappings
# ============================================================================


@router.get("/filters/{filter_id}/mappings", response_model=list[FilterChartMappingResponse])
async def get_filter_mappings(
    filter_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all chart mappings for a filter."""
    result = await db.execute(
        select(FilterChartMapping)
        .options(selectinload(FilterChartMapping.chart))
        .where(FilterChartMapping.filter_id == filter_id)
    )
    mappings = result.scalars().all()

    return [
        FilterChartMappingResponse(
            id=m.id,
            filter_id=m.filter_id,
            chart_id=m.chart_id,
            chart_name=m.chart.name if m.chart else None,
            column_name=m.column_name,
            operator=m.operator,
            enabled=m.enabled,
        )
        for m in mappings
    ]


@router.post("/filters/{filter_id}/mappings", response_model=FilterChartMappingResponse, status_code=status.HTTP_201_CREATED)
async def add_filter_mapping(
    filter_id: str,
    data: FilterChartMappingCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a chart mapping to a filter."""
    # Verify filter exists
    result = await db.execute(
        select(DashboardFilter).where(DashboardFilter.id == filter_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Filter not found")

    # Verify chart exists
    result = await db.execute(select(Chart).where(Chart.id == data.chart_id))
    chart = result.scalar_one_or_none()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    # Check if mapping already exists
    result = await db.execute(
        select(FilterChartMapping).where(
            FilterChartMapping.filter_id == filter_id,
            FilterChartMapping.chart_id == data.chart_id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Mapping already exists for this chart"
        )

    # Create mapping
    mapping = FilterChartMapping(
        id=str(uuid4()),
        filter_id=filter_id,
        chart_id=data.chart_id,
        column_name=data.column_name,
        operator=data.operator.value,
        enabled=data.enabled,
    )
    db.add(mapping)
    await db.commit()

    return FilterChartMappingResponse(
        id=mapping.id,
        filter_id=mapping.filter_id,
        chart_id=mapping.chart_id,
        chart_name=chart.name,
        column_name=mapping.column_name,
        operator=mapping.operator,
        enabled=mapping.enabled,
    )


@router.put("/filters/{filter_id}/mappings/{mapping_id}", response_model=FilterChartMappingResponse)
async def update_filter_mapping(
    filter_id: str,
    mapping_id: str,
    data: FilterChartMappingUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a chart mapping."""
    result = await db.execute(
        select(FilterChartMapping)
        .options(selectinload(FilterChartMapping.chart))
        .where(
            FilterChartMapping.id == mapping_id,
            FilterChartMapping.filter_id == filter_id
        )
    )
    mapping = result.scalar_one_or_none()

    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    if data.column_name is not None:
        mapping.column_name = data.column_name
    if data.operator is not None:
        mapping.operator = data.operator.value
    if data.enabled is not None:
        mapping.enabled = data.enabled

    await db.commit()

    return FilterChartMappingResponse(
        id=mapping.id,
        filter_id=mapping.filter_id,
        chart_id=mapping.chart_id,
        chart_name=mapping.chart.name if mapping.chart else None,
        column_name=mapping.column_name,
        operator=mapping.operator,
        enabled=mapping.enabled,
    )


@router.delete("/filters/{filter_id}/mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_filter_mapping(
    filter_id: str,
    mapping_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a chart mapping."""
    result = await db.execute(
        select(FilterChartMapping).where(
            FilterChartMapping.id == mapping_id,
            FilterChartMapping.filter_id == filter_id
        )
    )
    mapping = result.scalar_one_or_none()

    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    await db.delete(mapping)
    await db.commit()


# ============================================================================
# Chart Columns (for mapping configuration)
# ============================================================================


@router.get("/charts/{chart_id}/columns", response_model=list[dict[str, str]])
async def get_chart_columns(
    chart_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get available columns from a chart's query for mapping."""
    result = await db.execute(
        select(Chart).options(selectinload(Chart.query)).where(Chart.id == chart_id)
    )
    chart = result.scalar_one_or_none()

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    if not chart.query:
        raise HTTPException(status_code=400, detail="Chart has no query")

    try:
        # Execute query with LIMIT 0 to get column metadata
        limited_query = f"SELECT * FROM ({chart.query.sql_text}) AS subq LIMIT 0"
        result = await db.execute(text(limited_query))

        columns = []
        if result.keys():
            for key in result.keys():
                columns.append({"name": key, "type": "unknown"})

        return columns

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to get columns: {str(e)}"
        )


# ============================================================================
# Filtered Chart Data
# ============================================================================


@router.post("/charts/{chart_id}/data/filtered", response_model=FilteredChartDataResponse)
async def get_filtered_chart_data(
    chart_id: str,
    filters: list[AppliedFilter] = Body(default=[]),
    db: AsyncSession = Depends(get_db),
):
    """Get chart data with filters applied."""
    result = await db.execute(
        select(Chart).options(selectinload(Chart.query)).where(Chart.id == chart_id)
    )
    chart = result.scalar_one_or_none()

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    if not chart.query:
        raise HTTPException(status_code=400, detail="Chart has no query")

    start_time = time.time()

    # Build filtered SQL
    base_sql = chart.query.sql_text

    if filters:
        where_clauses = []
        for f in filters:
            clause = build_filter_clause(f.column, f.operator.value, f.value)
            if clause:
                where_clauses.append(clause)

        if where_clauses:
            filtered_sql = f"WITH base AS ({base_sql}) SELECT * FROM base WHERE {' AND '.join(where_clauses)}"
        else:
            filtered_sql = base_sql
    else:
        filtered_sql = base_sql

    try:
        result = await db.execute(text(filtered_sql))
        rows = result.fetchall()

        # Build column metadata
        columns = []
        if result.keys():
            columns = [{"name": key, "type": "unknown"} for key in result.keys()]

        # Convert rows to list of dicts
        data = []
        for row in rows:
            row_dict = {}
            for i, key in enumerate(result.keys()):
                value = row[i]
                if hasattr(value, "isoformat"):
                    value = value.isoformat()
                row_dict[key] = value
            data.append(row_dict)

        execution_time_ms = (time.time() - start_time) * 1000

        return FilteredChartDataResponse(
            chart_id=chart_id,
            data=data,
            columns=columns,
            applied_filters=filters,
            execution_time_ms=round(execution_time_ms, 2),
        )

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to execute filtered query: {str(e)}"
        )


def build_filter_clause(column: str, operator: str, value: Any) -> str | None:
    """Build a SQL WHERE clause from filter parameters."""
    if value is None:
        return None

    # Escape column name
    col = f'"{column}"'

    if operator in ("=", "!=", ">", "<", ">=", "<="):
        if isinstance(value, str):
            return f"{col} {operator} '{value}'"
        return f"{col} {operator} {value}"

    elif operator == "IN":
        values = value if isinstance(value, list) else [value]
        formatted = ", ".join(
            f"'{v}'" if isinstance(v, str) else str(v) for v in values
        )
        return f"{col} IN ({formatted})"

    elif operator == "NOT IN":
        values = value if isinstance(value, list) else [value]
        formatted = ", ".join(
            f"'{v}'" if isinstance(v, str) else str(v) for v in values
        )
        return f"{col} NOT IN ({formatted})"

    elif operator == "BETWEEN":
        if isinstance(value, list) and len(value) == 2:
            min_val = f"'{value[0]}'" if isinstance(value[0], str) else value[0]
            max_val = f"'{value[1]}'" if isinstance(value[1], str) else value[1]
            return f"{col} BETWEEN {min_val} AND {max_val}"
        return None

    elif operator in ("LIKE", "CONTAINS"):
        return f"{col} LIKE '%{value}%'"

    return None
