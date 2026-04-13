"""Oracle JSON column type -- BLOB IS JSON with check constraint."""

from __future__ import annotations

import json as json_lib

from sqlalchemy import BLOB, CheckConstraint
from sqlalchemy.types import SchemaType, TypeDecorator


class OracleJSON(TypeDecorator, SchemaType):
    """JSON stored as BLOB with IS JSON check constraint on Oracle 19c.

    Oracle 19c does not have a native JSON column type (that is 21c+).
    This uses BLOB storage with an IS JSON check constraint so Oracle
    validates JSON on insert/update.
    """

    impl = BLOB
    cache_ok = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def _set_table(self, column, table):
        """SchemaType hook: add IS JSON check constraint when column is bound to table."""
        constraint_name = f"ck_{table.name}_{column.name}_json"
        table.append_constraint(
            CheckConstraint(
                f"{column.name} IS JSON",
                name=constraint_name,
            )
        )

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json_lib.dumps(value).encode("utf-8")
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            if isinstance(value, bytes):
                return json_lib.loads(value.decode("utf-8"))
            if isinstance(value, str):
                return json_lib.loads(value)
        return value
