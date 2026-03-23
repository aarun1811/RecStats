import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.models.database_config import DatabaseEntry, DatabasesConfig
from app.services.database_registrar import DatabaseRegistrar


def _make_entries() -> list[DatabaseEntry]:
    return [
        DatabaseEntry(
            name="db_one",
            display_name="DB One",
            sqlalchemy_uri="sqlite:///test.db",
            dialect="sqlite",
            schema_name="",
            type="test",
        ),
        DatabaseEntry(
            name="db_two",
            display_name="DB Two",
            sqlalchemy_uri="sqlite:///test.db",
            dialect="oracle",
            schema_name="myschema",
            type="test",
        ),
    ]


def _make_superset_mock(existing_dbs: list[dict] | None = None) -> AsyncMock:
    mock = AsyncMock()
    mock.list_databases = AsyncMock(
        return_value=existing_dbs or []
    )
    mock.create_database = AsyncMock(
        side_effect=lambda payload: {"id": 99, "result": {"id": 99}}
    )
    return mock


@pytest.mark.asyncio
async def test_sync_creates_missing_databases():
    superset = _make_superset_mock(existing_dbs=[])
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()
    assert superset.create_database.call_count == 2


@pytest.mark.asyncio
async def test_sync_skips_existing_databases():
    existing = [{"id": 5, "database_name": "db_one"}]
    superset = _make_superset_mock(existing_dbs=existing)
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()
    assert superset.create_database.call_count == 1


@pytest.mark.asyncio
async def test_resolve_returns_superset_id():
    existing = [
        {"id": 5, "database_name": "db_one"},
        {"id": 10, "database_name": "db_two"},
    ]
    superset = _make_superset_mock(existing_dbs=existing)
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()
    assert await registrar.resolve("db_one") == 5
    assert await registrar.resolve("db_two") == 10


@pytest.mark.asyncio
async def test_resolve_unknown_raises():
    superset = _make_superset_mock(existing_dbs=[])
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = []
    await registrar.sync()
    with pytest.raises(ValueError, match="not registered"):
        await registrar.resolve("nonexistent")


@pytest.mark.asyncio
async def test_resolve_triggers_refresh_on_cache_miss():
    superset = _make_superset_mock(existing_dbs=[])
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()  # creates both, superset_id=99

    # Simulate DB appearing in Superset after sync
    superset.list_databases = AsyncMock(
        return_value=[
            {"id": 5, "database_name": "db_one"},
            {"id": 10, "database_name": "db_two"},
        ]
    )
    # Clear cache and force cooldown to allow refresh
    registrar._cache.clear()
    registrar._last_refresh = 0.0

    result = await registrar.resolve("db_one")
    assert result == 5


@pytest.mark.asyncio
async def test_negative_cache_prevents_repeated_refresh():
    superset = _make_superset_mock(existing_dbs=[])
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = []
    await registrar.sync()

    # First resolve should trigger refresh attempt then cache negative
    with pytest.raises(ValueError, match="not registered"):
        registrar._last_refresh = 0.0  # allow refresh
        await registrar.resolve("bad_name")

    # Second resolve should hit negative cache without calling list_databases again
    call_count_before = superset.list_databases.call_count
    with pytest.raises(ValueError, match="not registered"):
        await registrar.resolve("bad_name")
    assert superset.list_databases.call_count == call_count_before


def test_get_dialect():
    superset = _make_superset_mock()
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    for entry in registrar._entries:
        registrar._cache[entry.name] = entry
    assert registrar.get_dialect("db_one") == "sqlite"
    assert registrar.get_dialect("db_two") == "oracle"


def test_get_schema():
    superset = _make_superset_mock()
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    for entry in registrar._entries:
        registrar._cache[entry.name] = entry
    assert registrar.get_schema("db_one") == ""
    assert registrar.get_schema("db_two") == "myschema"


def test_get_all_schemas():
    superset = _make_superset_mock()
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    for entry in registrar._entries:
        registrar._cache[entry.name] = entry
    schemas = registrar.get_all_schemas()
    assert "myschema" in schemas
