from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class DatabaseEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    display_name: str
    sqlalchemy_uri: str
    dialect: str = "oracle"
    schema_name: str = Field(default="", alias="schema")
    type: str = ""
    superset_id: int | None = None


class DatabasesConfig(BaseModel):
    databases: list[DatabaseEntry]
