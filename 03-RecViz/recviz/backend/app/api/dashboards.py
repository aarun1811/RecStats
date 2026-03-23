from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.dependencies import ConfigStoreDep, QueryEngineDep

router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])


class KpiRequest(BaseModel):
    filters: dict[str, str | int | list[str]] = {}


class KpiResult(BaseModel):
    id: str
    value: float
    percentage: float | None = None


class KpiResponse(BaseModel):
    kpis: list[KpiResult]


@router.get("")
async def list_dashboards(config_store: ConfigStoreDep):
    dashboards = config_store.list_dashboards()
    return [
        {"id": d.id, "name": d.name, "description": d.description, "status": "active"}
        for d in dashboards
    ]


@router.get("/{dashboard_id}")
async def get_dashboard(dashboard_id: str, config_store: ConfigStoreDep):
    config = config_store.get_dashboard(dashboard_id)
    if not config:
        raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")
    return config.model_dump()


@router.post("/{dashboard_id}/kpis")
async def get_dashboard_kpis(
    dashboard_id: str,
    body: KpiRequest,
    config_store: ConfigStoreDep,
    query_engine: QueryEngineDep,
):
    config = config_store.get_dashboard(dashboard_id)
    if not config:
        raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

    kpi_values: dict[str, float] = {}

    for kpi in config.kpis:
        total = 0.0
        for source in kpi.sources:
            try:
                result = await query_engine.execute(source.data_source_id, body.filters)
                for row in result.get("rows", []):
                    val = row.get(source.metric)
                    if val is not None:
                        total += float(val)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
        kpi_values[kpi.id] = total

    # Compute trends (percentage_of)
    kpi_results = []
    for kpi in config.kpis:
        result = KpiResult(id=kpi.id, value=kpi_values[kpi.id])
        if kpi.trend and kpi.trend.type == "percentage_of":
            ref_value = kpi_values.get(kpi.trend.reference_kpi, 0)
            if ref_value > 0:
                result.percentage = round(kpi_values[kpi.id] / ref_value * 100, 2)
            else:
                result.percentage = 0.0
        kpi_results.append(result)

    return KpiResponse(kpis=kpi_results)
