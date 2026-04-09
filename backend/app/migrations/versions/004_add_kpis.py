"""Add recviz_kpis table

Revision ID: 004
Revises: 003
Create Date: 2026-04-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recviz_kpis",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.String(1024), server_default=""),
        sa.Column("dataset_id", sa.String(128), nullable=False),
        sa.Column("metric_column", sa.String(256), nullable=False),
        sa.Column("aggregation", sa.String(32), nullable=False, server_default="SUM"),
        sa.Column("config", sa.JSON(), nullable=False, server_default="{}"),
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
    # Index for listing KPIs by dataset (used by dataset delete reference check)
    op.create_index("ix_recviz_kpis_dataset_id", "recviz_kpis", ["dataset_id"])


def downgrade() -> None:
    op.drop_index("ix_recviz_kpis_dataset_id")
    op.drop_table("recviz_kpis")
