"""Pydantic models for database/data-source CRUD."""

from __future__ import annotations

from app.models.base import CamelModel


class DatabaseCreate(CamelModel):
    database_name: str
    backend: str  # "oracle", "postgresql", "hive", "elasticsearch"
    sqlalchemy_uri: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    schema_name: str | None = None
    username: str | None = None
    password: str | None = None


class DatabaseUpdate(CamelModel):
    database_name: str | None = None
    backend: str | None = None
    sqlalchemy_uri: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    schema_name: str | None = None
    username: str | None = None
    password: str | None = None


class DatabaseInfo(CamelModel):
    id: int
    database_name: str
    backend: str
    created_on: str | None = None
    expose_in_sqllab: bool = True
    dataset_count: int = 0
    status: str = "untested"
    last_tested: str | None = None


class TestConnectionRequest(CamelModel):
    backend: str
    sqlalchemy_uri: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    username: str | None = None
    password: str | None = None
    database_id: int | None = None  # Superset ID for status tracking on existing DBs


class TestConnectionResponse(CamelModel):
    success: bool
    message: str
