"""Pydantic models for database/data-source CRUD."""

from __future__ import annotations

from typing import Literal

from app.models.base import CamelModel


class DatabaseCreate(CamelModel):
    database_name: str
    backend: Literal["oracle"]
    host: str
    port: int | None = None
    database: str | None = None
    schema_name: str | None = None
    username: str | None = None
    password: str | None = None


class DatabaseUpdate(CamelModel):
    database_name: str | None = None
    backend: Literal["oracle"] | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    schema_name: str | None = None
    username: str | None = None
    password: str | None = None


class DatabaseInfo(CamelModel):
    id: str
    database_name: str
    backend: str
    created_on: str | None = None
    expose_in_sqllab: bool = True
    dataset_count: int = 0
    status: str = "untested"
    last_tested: str | None = None


class TestConnectionRequest(CamelModel):
    backend: str
    host: str | None = None
    port: int | None = None
    database: str | None = None
    username: str | None = None
    password: str | None = None
    database_id: str | None = None  # Connection UUID for status tracking on existing DBs


class TestConnectionResponse(CamelModel):
    success: bool
    message: str
