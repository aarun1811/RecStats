"""Pydantic request/response models for RecViz-managed dashboards."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.models.base import CamelModel


class DashboardCreate(CamelModel):
    name: str = Field(min_length=1, max_length=256)
    description: str = Field(default="", max_length=1024)
    config: dict


class DashboardUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=1024)
    config: dict | None = None


class DashboardResponse(CamelModel):
    id: str
    name: str
    description: str
    config: dict
    created_at: datetime
    updated_at: datetime
