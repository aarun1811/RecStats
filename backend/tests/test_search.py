"""Tests for the SHAR-04 search endpoint (Phase 9 Plan 09-03).

These tests exercise the rewritten ``backend/app/api/search.py`` which queries
four managed entity tables (``recviz_dashboards``, ``recviz_charts``,
``recviz_datasets``, ``recviz_kpis``) via SQLAlchemy ``ilike`` queries. The
legacy implementation used Superset — the rewrite drops that dependency
entirely. ``test_search_no_superset_calls`` is the guard that prevents a
regression back to Superset-backed search.

Pattern follows ``backend/tests/test_managed_charts.py``:
    * ``_make_row`` — a lightweight ``MagicMock`` with ``id``/``name``/
      ``description`` attributes so the row-tuple unpacking in ``search.py``
      works (``r[0]``, ``r[1]``, ``r[2]`` ≡ id/name/description).
    * ``_create_test_app`` — a minimal FastAPI app that mounts the search
      router with ``get_db_session`` overridden to yield the caller-supplied
      ``AsyncMock``.

The ``session.execute`` mock is configured via ``side_effect`` so each of the
four sequential queries (dashboard → chart → dataset → kpi) returns its own
result object. Every result supports ``.all()`` returning a list of row tuples
(or attribute-based mocks that index identically — we use row tuples for
simplicity).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient


# ── Test fixtures ────────────────────────────────────────────────


def _make_row(row_id: str, name: str, description: str = "") -> tuple[str, str, str]:
    """Build a row tuple matching the ``select(Model.id, Model.name, Model.description)`` shape.

    The route handler iterates ``for r in result.all(): (r[0], r[1], r[2])`` so
    a plain 3-tuple is the minimum fidelity needed. This avoids the ``MagicMock``
    attribute-vs-index trap when the SUT does indexed access.
    """
    return (row_id, name, description)


def _empty_result() -> MagicMock:
    """A SQLAlchemy ``Result`` mock whose ``.all()`` returns ``[]``."""
    result = MagicMock()
    result.all = MagicMock(return_value=[])
    return result


def _result_with_rows(rows: list[tuple[str, str, str]]) -> MagicMock:
    result = MagicMock()
    result.all = MagicMock(return_value=rows)
    return result


def _create_test_app(session_mock: AsyncMock) -> FastAPI:
    """Mount only the search router and override the DB session dependency."""
    from app.api.search import router
    from app.core.dependencies import get_db_session

    app = FastAPI()
    app.include_router(router)

    async def override_db():
        yield session_mock

    app.dependency_overrides[get_db_session] = override_db
    return app


# ── Basic per-type search tests ──────────────────────────────────


def test_search_dashboards_by_name():
    """Searching by a substring of a dashboard name returns a dashboard result."""
    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[
            _result_with_rows(
                [_make_row("dash-1", "Revenue Dashboard", "Q1 numbers")]
            ),
            _empty_result(),  # charts
            _empty_result(),  # datasets
            _empty_result(),  # kpis
        ]
    )

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post("/api/search", json={"query": "Revenue"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["results"]) == 1
    result = data["results"][0]
    assert result["type"] == "dashboard"
    assert result["id"] == "dash-1"
    assert result["name"] == "Revenue Dashboard"


def test_search_charts_by_name():
    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[
            _empty_result(),  # dashboards
            _result_with_rows([_make_row("chart-1", "Revenue Bar Chart", "")]),
            _empty_result(),  # datasets
            _empty_result(),  # kpis
        ]
    )

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post("/api/search", json={"query": "Revenue"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["type"] == "chart"
    assert data["results"][0]["id"] == "chart-1"


def test_search_datasets_by_name():
    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[
            _empty_result(),  # dashboards
            _empty_result(),  # charts
            _result_with_rows([_make_row("ds-1", "Revenue Dataset", "")]),
            _empty_result(),  # kpis
        ]
    )

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post("/api/search", json={"query": "Revenue"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["type"] == "dataset"
    assert data["results"][0]["id"] == "ds-1"


def test_search_kpis_by_name():
    """KPIs are a NEW source per D-13. This guards the addition."""
    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[
            _empty_result(),  # dashboards
            _empty_result(),  # charts
            _empty_result(),  # datasets
            _result_with_rows([_make_row("kpi-1", "Revenue KPI", "")]),
        ]
    )

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post("/api/search", json={"query": "Revenue"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["type"] == "kpi"
    assert data["results"][0]["id"] == "kpi-1"


# ── No-Superset-calls guard (T-9-2 STRIDE Tampering mitigation witness) ───


def test_search_no_superset_calls(monkeypatch):
    """Assert the rewritten endpoint makes ZERO outbound HTTP calls.

    Drops an ``httpx.AsyncClient`` spy into ``app.api.search`` (if present)
    and asserts ``get``/``post`` were not called after a search request.
    Also patches ``app.api.search``'s module namespace looking for any
    ``superset``/``SupersetClient``/``SupersetDep`` attribute and asserts
    they are either absent or untouched. The goal: catch a regression that
    re-imports Superset into search.py.
    """
    import importlib

    # Force a fresh reload so attribute inspection is current.
    search_module = importlib.import_module("app.api.search")

    # Guard 1: no httpx import remains in the module namespace.
    assert not hasattr(search_module, "httpx"), (
        "search.py must not import httpx after the Phase 9 rewrite"
    )

    # Guard 2: no SupersetDep / SupersetClient / superset_client references.
    forbidden_names = {
        "SupersetDep",
        "SupersetClient",
        "superset_client",
        "superset",
        "ConfigStoreDep",
    }
    present = forbidden_names.intersection(vars(search_module).keys())
    assert not present, (
        f"search.py must not reference Superset or ConfigStore after rewrite; "
        f"found: {sorted(present)}"
    )

    # Guard 3: issuing a search request hits only session.execute, not any
    # httpx client. Mock httpx.AsyncClient at the library level and assert
    # nothing was called on it.
    mock_async_client = MagicMock()
    mock_async_client_instance = MagicMock()
    mock_async_client_instance.get = AsyncMock()
    mock_async_client_instance.post = AsyncMock()
    mock_async_client_instance.__aenter__ = AsyncMock(
        return_value=mock_async_client_instance
    )
    mock_async_client_instance.__aexit__ = AsyncMock(return_value=None)
    mock_async_client.return_value = mock_async_client_instance
    monkeypatch.setattr("httpx.AsyncClient", mock_async_client)

    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[
            _empty_result(),
            _empty_result(),
            _empty_result(),
            _empty_result(),
        ]
    )
    app = _create_test_app(session)
    client = TestClient(app)
    resp = client.post("/api/search", json={"query": "anything"})
    assert resp.status_code == 200

    # httpx.AsyncClient must not have been instantiated at all by search.py.
    mock_async_client.assert_not_called()
    mock_async_client_instance.get.assert_not_called()
    mock_async_client_instance.post.assert_not_called()


# ── Ranking (prefix-match → substring → alphabetical) ───────────


def test_search_ranking():
    """Prefix-match wins over substring; substring matches sort alphabetically."""
    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[
            _result_with_rows(
                [
                    _make_row("d-2", "My Foo", ""),
                    _make_row("d-1", "Foo Bar", ""),
                    _make_row("d-3", "Other Foo", ""),
                ]
            ),
            _empty_result(),
            _empty_result(),
            _empty_result(),
        ]
    )

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post("/api/search", json={"query": "Foo"})
    assert resp.status_code == 200
    data = resp.json()
    results = data["results"]
    assert len(results) == 3
    # "Foo Bar" starts with "Foo" → prefix match, ranked first
    assert results[0]["name"] == "Foo Bar"
    # "My Foo" and "Other Foo" are substring matches, alphabetical
    assert results[1]["name"] == "My Foo"
    assert results[2]["name"] == "Other Foo"


# ── Type filter ──────────────────────────────────────────────────


def test_search_type_filter():
    """``types: ['dashboard']`` must return dashboards only, no charts/datasets/kpis."""
    session = AsyncMock()
    # Only one execute call is expected when types is ['dashboard'] (the
    # charts/datasets/kpis branches short-circuit before executing). We still
    # provide four side_effects defensively to avoid StopIteration if the
    # implementation runs one query per branch and filters in Python.
    session.execute = AsyncMock(
        side_effect=[
            _result_with_rows([_make_row("d-1", "Foo Dashboard", "")]),
            _empty_result(),
            _empty_result(),
            _empty_result(),
        ]
    )

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post(
        "/api/search", json={"query": "Foo", "types": ["dashboard"]}
    )
    assert resp.status_code == 200
    data = resp.json()
    # Only dashboard-typed results should surface
    types_in_results = {r["type"] for r in data["results"]}
    assert types_in_results <= {"dashboard"}
    assert data["total"] == 1
    assert data["results"][0]["type"] == "dashboard"


# ── Empty query short-circuit ────────────────────────────────────


def test_search_empty_query():
    """An empty query returns empty results without hitting the DB."""
    session = AsyncMock()
    session.execute = AsyncMock()

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post("/api/search", json={"query": ""})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["results"] == []
    session.execute.assert_not_called()


# ── Description-field match ──────────────────────────────────────


def test_search_description_field():
    """A search term found only in the description still produces a hit."""
    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[
            _result_with_rows(
                [
                    _make_row(
                        "d-1",
                        "Generic Dashboard",
                        "Monthly reconciliation Foo numbers",
                    )
                ]
            ),
            _empty_result(),
            _empty_result(),
            _empty_result(),
        ]
    )

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post("/api/search", json={"query": "Foo"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["name"] == "Generic Dashboard"
