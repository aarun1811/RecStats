"""Add recviz_charts table

Revision ID: 003
Revises: 002
Create Date: 2026-04-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.db.types import PortableJSON

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recviz_charts",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.String(1024), server_default=""),
        sa.Column("dataset_id", sa.String(128), nullable=False),
        sa.Column("chart_type", sa.String(64), nullable=False),
        sa.Column("config", PortableJSON(), nullable=False, server_default="{}"),
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
    # Index for listing charts by dataset (used by dataset delete reference check)
    op.create_index("ix_recviz_charts_dataset_id", "recviz_charts", ["dataset_id"])


def downgrade() -> None:
    op.drop_index("ix_recviz_charts_dataset_id")
    op.drop_table("recviz_charts")
