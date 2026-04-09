"""Unit tests for RecvizConnection ORM model — DDL compilation and column validation."""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.schema import CreateTable

from app.db.models.connection import RecvizConnection


EXPECTED_COLUMNS = {
    "id",
    "name",
    "display_name",
    "backend",
    "host",
    "port",
    "database_name",
    "username",
    "encrypted_password",
    "schema_name",
    "extra_params",
    "status",
    "last_tested_at",
    "created_at",
    "updated_at",
}


class TestRecvizConnectionModel:
    """Validate RecvizConnection model structure and DDL compilation."""

    def test_tablename(self):
        """Model uses 'recviz_connections' table name."""
        assert RecvizConnection.__tablename__ == "recviz_connections"

    def test_has_all_columns(self):
        """Model has all 15 expected columns."""
        actual = set(RecvizConnection.__table__.columns.keys())
        assert actual == EXPECTED_COLUMNS

    def test_name_column_unique(self):
        """The 'name' column has a unique constraint."""
        name_col = RecvizConnection.__table__.c.name
        assert name_col.unique is True

    def test_encrypted_password_is_text(self):
        """encrypted_password uses Text type (large ciphertext)."""
        col = RecvizConnection.__table__.c.encrypted_password
        type_name = type(col.type).__name__
        assert type_name == "Text"

    def test_extra_params_is_portable_json(self):
        """extra_params uses PortableJSON type."""
        col = RecvizConnection.__table__.c.extra_params
        type_name = type(col.type).__name__
        assert type_name == "PortableJSON"


class TestRecvizConnectionDDL:
    """Verify DDL compiles on both PostgreSQL and Oracle dialects."""

    def test_ddl_compiles_postgresql(self):
        """DDL compiles for PostgreSQL with correct types."""
        from sqlalchemy.dialects import postgresql as pg_dialect

        ddl = CreateTable(RecvizConnection.__table__).compile(
            dialect=pg_dialect.dialect()
        )
        ddl_str = str(ddl)
        assert "recviz_connections" in ddl_str
        assert "VARCHAR" in ddl_str or "varchar" in ddl_str.lower()
        assert "INTEGER" in ddl_str or "integer" in ddl_str.lower()
        assert "TEXT" in ddl_str or "JSONB" in ddl_str  # Text or JSONB for PortableJSON on PG

    def test_ddl_compiles_oracle(self):
        """DDL compiles for Oracle with correct types."""
        from sqlalchemy.dialects import oracle as ora_dialect

        ddl = CreateTable(RecvizConnection.__table__).compile(
            dialect=ora_dialect.dialect()
        )
        ddl_str = str(ddl)
        assert "recviz_connections" in ddl_str
        assert "VARCHAR2" in ddl_str or "VARCHAR" in ddl_str
        assert "NUMBER" in ddl_str or "INTEGER" in ddl_str
        # PortableJSON compiles to CLOB on Oracle
        assert "CLOB" in ddl_str

    def test_postgresql_extra_params_is_jsonb(self):
        """On PostgreSQL, extra_params renders as JSONB."""
        from sqlalchemy.dialects import postgresql as pg_dialect

        ddl_str = str(
            CreateTable(RecvizConnection.__table__).compile(
                dialect=pg_dialect.dialect()
            )
        )
        assert "JSONB" in ddl_str

    def test_oracle_extra_params_is_clob(self):
        """On Oracle, extra_params renders as CLOB (PortableJSON fallback)."""
        from sqlalchemy.dialects import oracle as ora_dialect

        ddl_str = str(
            CreateTable(RecvizConnection.__table__).compile(
                dialect=ora_dialect.dialect()
            )
        )
        assert "CLOB" in ddl_str


class TestRecvizConnectionImport:
    """Verify model is importable from the models package."""

    def test_import_from_models_package(self):
        """RecvizConnection is exported from app.db.models."""
        from app.db.models import RecvizConnection as RC
        assert RC.__tablename__ == "recviz_connections"
