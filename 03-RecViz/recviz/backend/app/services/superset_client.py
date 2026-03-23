"""Async Superset API client with auto-authentication and retry on 401."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TOKEN_REFRESH_BUFFER = 30  # seconds before expiry to refresh


class SupersetClient:
    def __init__(self, http: httpx.AsyncClient) -> None:
        self._http = http
        self._base = settings.superset_url
        self._token: str | None = None
        self._csrf: str | None = None
        self._token_ts: float = 0

    # ── Auth ──────────────────────────────────────────────────────

    async def authenticate(self) -> str:
        resp = await self._http.post(
            f"{self._base}/api/v1/security/login",
            json={
                "username": settings.superset_username,
                "password": settings.superset_password,
                "provider": "db",
            },
        )
        resp.raise_for_status()
        self._token = resp.json()["access_token"]
        self._token_ts = time.time()
        logger.info("Authenticated to Superset")

        # Fetch CSRF token
        csrf_resp = await self._http.get(
            f"{self._base}/api/v1/security/csrf_token/",
            headers=self._auth_headers(),
        )
        if csrf_resp.is_success:
            self._csrf = csrf_resp.json().get("result")

        return self._token

    async def ensure_authenticated(self) -> None:
        # Re-auth if no token or older than 25 minutes (Superset default is 30 min)
        if not self._token or (time.time() - self._token_ts) > (25 * 60):
            await self.authenticate()

    def _auth_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        if self._csrf:
            headers["X-CSRFToken"] = self._csrf
            headers["Referer"] = self._base
        return headers

    # ── Internal request with auto-retry on 401 ─────────────────

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        params: dict[str, Any] | None = None,
    ) -> Any:
        await self.ensure_authenticated()
        url = f"{self._base}{path}"
        headers = self._auth_headers()

        resp = await self._http.request(method, url, json=json, params=params, headers=headers)

        if resp.status_code == 401:
            logger.warning("Got 401, re-authenticating...")
            await self.authenticate()
            headers = self._auth_headers()
            resp = await self._http.request(method, url, json=json, params=params, headers=headers)

        resp.raise_for_status()
        return resp.json()

    async def _get(self, path: str, **kwargs: Any) -> Any:
        return await self._request("GET", path, **kwargs)

    async def _post(self, path: str, **kwargs: Any) -> Any:
        return await self._request("POST", path, **kwargs)

    # ── Chart Data ───────────────────────────────────────────────

    async def get_chart_data(
        self,
        datasource_id: int,
        queries: list[dict[str, Any]],
        datasource_type: str = "table",
    ) -> dict[str, Any]:
        return await self._post(
            "/api/v1/chart/data",
            json={
                "datasource": {"id": datasource_id, "type": datasource_type},
                "queries": queries,
                "result_format": "json",
                "result_type": "results",
            },
        )

    # ── Charts ───────────────────────────────────────────────────

    async def list_charts(self) -> list[dict[str, Any]]:
        data = await self._get("/api/v1/chart/")
        return data.get("result", [])

    async def get_chart(self, chart_id: int) -> dict[str, Any]:
        data = await self._get(f"/api/v1/chart/{chart_id}")
        return data.get("result", {})

    # ── Datasets ─────────────────────────────────────────────────

    async def list_datasets(self) -> list[dict[str, Any]]:
        data = await self._get("/api/v1/dataset/")
        return data.get("result", [])

    async def get_dataset(self, dataset_id: int) -> dict[str, Any]:
        data = await self._get(f"/api/v1/dataset/{dataset_id}")
        return data.get("result", {})

    # ── SQL Lab ──────────────────────────────────────────────────

    async def execute_sql(
        self,
        database_id: int,
        sql: str,
        schema: str = "",
        limit: int = 10000,
    ) -> dict[str, Any]:
        return await self._post(
            "/api/v1/sqllab/execute/",
            json={
                "database_id": database_id,
                "sql": sql,
                "schema": schema,
                "runAsync": False,
                "select_as_cta": False,
                "expand_data": True,
                "row_limit": limit,
            },
        )

    # ── Dashboards ───────────────────────────────────────────────

    async def list_dashboards(self) -> list[dict[str, Any]]:
        data = await self._get("/api/v1/dashboard/")
        return data.get("result", [])

    async def get_dashboard(self, dashboard_id: int) -> dict[str, Any]:
        data = await self._get(f"/api/v1/dashboard/{dashboard_id}")
        return data.get("result", {})

    # ── Databases ────────────────────────────────────────────────

    async def list_databases(self) -> list[dict[str, Any]]:
        data = await self._get("/api/v1/database/")
        return data.get("result", [])

    async def get_database(self, db_id: int) -> dict[str, Any]:
        data = await self._get(f"/api/v1/database/{db_id}")
        return data.get("result", {})

    async def create_database(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._post("/api/v1/database/", json=payload)

    async def update_database(self, db_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request("PUT", f"/api/v1/database/{db_id}", json=payload)

    async def delete_database(self, db_id: int) -> None:
        await self._request("DELETE", f"/api/v1/database/{db_id}")

    async def test_connection(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._post("/api/v1/database/test_connection/", json=payload)
