"""Cross-dialect JSON column types for PostgreSQL + Oracle portability."""

from __future__ import annotations

import json as json_lib

from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator


class PortableJSON(TypeDecorator):
    """JSON type portable across PostgreSQL (JSONB) and Oracle (CLOB).

    - PostgreSQL: delegates to native JSONB (binary JSON, indexable)
    - Oracle: stores as CLOB with Python-side JSON serialization
    """

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is not None and dialect.name != "postgresql":
            return json_lib.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and dialect.name != "postgresql":
            if isinstance(value, str):
                return json_lib.loads(value)
        return value
