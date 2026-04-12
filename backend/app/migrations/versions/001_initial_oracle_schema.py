"""initial oracle schema

Revision ID: 001
Revises:
Create Date: 2026-04-12
"""

from __future__ import annotations

# ============================================================================
# WARNING: Oracle DDL Auto-Commit
# ============================================================================
# Oracle automatically commits the current transaction before and after every
# DDL statement (CREATE TABLE, ALTER TABLE, DROP TABLE). If this migration
# contains multiple DDL statements and a later one fails, the earlier ones
# are already committed. Recovery requires manual:
#   DROP TABLE recviz_<table> CASCADE CONSTRAINTS;
# for each partially-created table.
#
# NOTE: Oracle identifier length limit depends on the COMPATIBLE parameter.
# On Oracle 12.2+ with COMPATIBLE >= 12.2.0, identifiers can be 128 bytes.
# On older settings, the limit is 30 bytes. The longest constraint name in
# this schema is ~42 bytes (e.g., ck_recviz_connections_extra_params_json).
# COMPATIBLE parameter check is deferred to Phase 8 (FINAL-02).
# ============================================================================

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- recviz_connections --------------------------------------------------
    op.create_table(
        "recviz_connections",
        sa.Column("id", sa.String(128), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("display_name", sa.String(256), nullable=False),
        sa.Column("backend", sa.String(32), nullable=False),
        sa.Column("host", sa.String(256), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("database_name", sa.String(256), nullable=False),
        sa.Column("username", sa.String(256), nullable=False),
        sa.Column("encrypted_password", sa.Text(), nullable=False),
        sa.Column("schema_name", sa.String(256), server_default="", nullable=False),
        sa.Column("extra_params", sa.BLOB(), nullable=True),
        sa.Column("status", sa.String(32), server_default="untested", nullable=False),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_recviz_connections"),
        sa.UniqueConstraint("name", name="uq_recviz_connections_name"),
        sa.CheckConstraint("extra_params IS JSON", name="ck_recviz_connections_extra_params_json"),
    )

    # -- recviz_dashboards ---------------------------------------------------
    op.create_table(
        "recviz_dashboards",
        sa.Column("id", sa.String(128), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.String(1024), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("config", sa.BLOB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_recviz_dashboards"),
        sa.CheckConstraint("config IS JSON", name="ck_recviz_dashboards_config_json"),
    )

    # -- recviz_datasets -----------------------------------------------------
    op.create_table(
        "recviz_datasets",
        sa.Column("id", sa.String(128), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.String(1024), nullable=False),
        sa.Column("database_id", sa.String(128), nullable=False),
        sa.Column("sql", sa.Text(), nullable=False),
        sa.Column("columns", sa.BLOB(), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_recviz_datasets"),
        sa.CheckConstraint("columns IS JSON", name="ck_recviz_datasets_columns_json"),
    )

    # -- recviz_charts -------------------------------------------------------
    op.create_table(
        "recviz_charts",
        sa.Column("id", sa.String(128), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.String(1024), nullable=False),
        sa.Column("dataset_id", sa.String(128), nullable=False),
        sa.Column("chart_type", sa.String(64), nullable=False),
        sa.Column("config", sa.BLOB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_recviz_charts"),
        sa.CheckConstraint("config IS JSON", name="ck_recviz_charts_config_json"),
    )

    # -- recviz_data_sources -------------------------------------------------
    op.create_table(
        "recviz_data_sources",
        sa.Column("id", sa.String(128), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("config", sa.BLOB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_recviz_data_sources"),
        sa.CheckConstraint("config IS JSON", name="ck_recviz_data_sources_config_json"),
    )

    # -- recviz_kpis ---------------------------------------------------------
    op.create_table(
        "recviz_kpis",
        sa.Column("id", sa.String(128), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.String(1024), nullable=False),
        sa.Column("dataset_id", sa.String(128), nullable=False),
        sa.Column("metric_column", sa.String(256), nullable=False),
        sa.Column("aggregation", sa.String(32), server_default="SUM", nullable=False),
        sa.Column("config", sa.BLOB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("SYSTIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_recviz_kpis"),
        sa.CheckConstraint("config IS JSON", name="ck_recviz_kpis_config_json"),
    )


def downgrade() -> None:
    op.execute("DROP TABLE recviz_kpis CASCADE CONSTRAINTS")
    op.execute("DROP TABLE recviz_data_sources CASCADE CONSTRAINTS")
    op.execute("DROP TABLE recviz_charts CASCADE CONSTRAINTS")
    op.execute("DROP TABLE recviz_datasets CASCADE CONSTRAINTS")
    op.execute("DROP TABLE recviz_dashboards CASCADE CONSTRAINTS")
    op.execute("DROP TABLE recviz_connections CASCADE CONSTRAINTS")
