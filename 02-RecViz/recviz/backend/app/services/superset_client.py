"""Async client wrapping Apache Superset REST API."""

from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.core.exceptions import SupersetError

logger = logging.getLogger(__name__)

# Timeout profiles
_DEFAULT_TIMEOUT = 30.0
_SQL_TIMEOUT = 120.0


class SupersetClient:
    """Async client wrapping Superset REST API."""

    def __init__(self, http_client: httpx.AsyncClient):
        self._client = http_client
        self._access_token: str | None = None

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    async def ensure_authenticated(self) -> None:
        """POST /api/v1/security/login — obtain JWT access token."""
        if self._access_token:
            return
        await self._authenticate()

    async def _authenticate(self) -> None:
        """Perform login and store access token."""
        try:
            response = await self._client.post(
                "/api/v1/security/login",
                json={
                    "username": settings.superset_username,
                    "password": settings.superset_password,
                    "provider": "db",
                },
                timeout=_DEFAULT_TIMEOUT,
            )
            response.raise_for_status()
            self._access_token = response.json()["access_token"]
        except httpx.HTTPStatusError as exc:
            raise SupersetError(
                status_code=exc.response.status_code,
                detail=f"Superset login failed: {exc.response.text}",
            ) from exc
        except httpx.HTTPError as exc:
            raise SupersetError(
                status_code=502,
                detail=f"Superset connection error during login: {exc}",
            ) from exc

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._access_token}"}

    # ------------------------------------------------------------------
    # Internal HTTP helpers with automatic 401 retry
    # ------------------------------------------------------------------

    async def _request(
        self,
        method: str,
        url: str,
        *,
        json: dict | None = None,
        params: dict | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> httpx.Response:
        """Make an authenticated request, retrying once on 401."""
        await self.ensure_authenticated()
        try:
            response = await self._client.request(
                method,
                url,
                headers=self._headers,
                json=json,
                params=params,
                timeout=timeout,
            )
        except httpx.HTTPError as exc:
            raise SupersetError(
                status_code=502,
                detail=f"Superset connection error: {exc}",
            ) from exc

        # If 401, re-authenticate and retry once
        if response.status_code == 401:
            logger.info("Superset token expired, re-authenticating")
            self._access_token = None
            await self._authenticate()
            try:
                response = await self._client.request(
                    method,
                    url,
                    headers=self._headers,
                    json=json,
                    params=params,
                    timeout=timeout,
                )
            except httpx.HTTPError as exc:
                raise SupersetError(
                    status_code=502,
                    detail=f"Superset connection error on retry: {exc}",
                ) from exc

        if response.status_code >= 400:
            raise SupersetError(
                status_code=response.status_code,
                detail=f"Superset API error: {response.text}",
            )
        return response

    async def _get(
        self, url: str, *, params: dict | None = None, timeout: float = _DEFAULT_TIMEOUT
    ) -> dict:
        resp = await self._request("GET", url, params=params, timeout=timeout)
        return resp.json()

    async def _post(
        self, url: str, *, json: dict | None = None, timeout: float = _DEFAULT_TIMEOUT
    ) -> dict:
        resp = await self._request("POST", url, json=json, timeout=timeout)
        return resp.json()

    # ------------------------------------------------------------------
    # Chart endpoints
    # ------------------------------------------------------------------

    async def list_charts(self) -> list[dict]:
        """GET /api/v1/chart/ — list available charts."""
        data = await self._get(
            "/api/v1/chart/",
            params={"q": "(page:0,page_size:100)"},
        )
        return data.get("result", [])

    async def get_chart(self, chart_id: int) -> dict:
        """GET /api/v1/chart/{id} — get chart details."""
        data = await self._get(f"/api/v1/chart/{chart_id}")
        return data.get("result", {})

    async def get_chart_data(self, chart_id: int, filters: list[dict]) -> dict:
        """POST /api/v1/chart/data — fetch chart data with extra filters.

        Builds a query_context payload referencing the chart, injects extra
        filters from our global filter bar.
        """
        # First get the chart definition to extract datasource info
        chart = await self.get_chart(chart_id)
        datasource_id = chart.get("datasource_id")
        datasource_type = chart.get("datasource_type", "table")

        query_context = {
            "datasource": {
                "id": datasource_id,
                "type": datasource_type,
            },
            "force": False,
            "queries": [
                {
                    "filters": filters,
                    "extras": {"where": ""},
                    "columns": chart.get("query_context", {})
                    .get("queries", [{}])[0:1][0]
                    .get("columns", [])
                    if chart.get("query_context")
                    else [],
                }
            ],
            "result_format": "json",
            "result_type": "full",
        }
        return await self._post("/api/v1/chart/data", json=query_context)

    # ------------------------------------------------------------------
    # Dataset endpoints
    # ------------------------------------------------------------------

    async def list_datasets(self) -> list[dict]:
        """GET /api/v1/dataset/ — list available datasets."""
        data = await self._get(
            "/api/v1/dataset/",
            params={"q": "(page:0,page_size:100)"},
        )
        return data.get("result", [])

    async def get_dataset(self, dataset_id: int) -> dict:
        """GET /api/v1/dataset/{id} — get dataset details including columns."""
        data = await self._get(f"/api/v1/dataset/{dataset_id}")
        return data.get("result", {})

    async def get_dataset_data(
        self,
        dataset_id: int,
        filters: list[dict] | None = None,
        order_by: list[dict] | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> dict:
        """POST /api/v1/chart/data — query dataset with filters and pagination.

        Uses the chart/data endpoint with a query_context targeting the dataset
        as datasource.
        """
        query: dict = {
            "filters": filters or [],
            "orderby": [[col["column"], col.get("order", "asc")] for col in (order_by or [])],
            "row_offset": offset,
            "row_limit": limit,
        }
        query_context = {
            "datasource": {
                "id": dataset_id,
                "type": "table",
            },
            "force": False,
            "queries": [query],
            "result_format": "json",
            "result_type": "full",
        }
        return await self._post("/api/v1/chart/data", json=query_context)

    # ------------------------------------------------------------------
    # SQL Lab
    # ------------------------------------------------------------------

    async def execute_sql(self, database_id: int, sql: str, limit: int = 1000) -> dict:
        """POST /api/v1/sqllab/execute/ — execute ad-hoc SQL.

        Uses extended timeout since Hive queries can be slow.
        """
        return await self._post(
            "/api/v1/sqllab/execute/",
            json={
                "database_id": database_id,
                "sql": sql,
                "queryLimit": limit,
                "runAsync": False,
            },
            timeout=_SQL_TIMEOUT,
        )

    # ------------------------------------------------------------------
    # Dashboard endpoints
    # ------------------------------------------------------------------

    async def list_dashboards(self) -> list[dict]:
        """GET /api/v1/dashboard/ — list dashboards."""
        data = await self._get(
            "/api/v1/dashboard/",
            params={"q": "(page:0,page_size:100)"},
        )
        return data.get("result", [])

    async def get_dashboard(self, dashboard_id: int) -> dict:
        """GET /api/v1/dashboard/{id} — get dashboard details."""
        data = await self._get(f"/api/v1/dashboard/{dashboard_id}")
        return data.get("result", {})

    # ------------------------------------------------------------------
    # Database endpoints
    # ------------------------------------------------------------------

    async def list_databases(self) -> list[dict]:
        """GET /api/v1/database/ — list available databases."""
        data = await self._get("/api/v1/database/")
        return data.get("result", [])
