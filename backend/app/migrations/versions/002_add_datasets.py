"""Add recviz_datasets table

Revision ID: 002
Revises: 001
Create Date: 2026-04-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.db.types import PortableJSON

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recviz_datasets",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.String(1024), server_default=""),
        sa.Column("database_id", sa.Integer(), nullable=False),
        sa.Column("superset_id", sa.Integer(), nullable=True),
        sa.Column("sql", sa.Text(), nullable=False),
        sa.Column("columns", PortableJSON(), nullable=False, server_default="[]"),
        sa.Column(
            "sync_status",
            sa.String(32),
            nullable=False,
            server_default="unsynced",
        ),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("recviz_datasets")
