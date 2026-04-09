"""Add recviz_connections table for direct database connectivity.

Revision ID: 005
Revises: 004
Create Date: 2026-04-09

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recviz_connections",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("display_name", sa.String(256), nullable=False),
        sa.Column("backend", sa.String(32), nullable=False),
        sa.Column("host", sa.String(256), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("database_name", sa.String(256), nullable=False),
        sa.Column("username", sa.String(256), nullable=False),
        sa.Column("encrypted_password", sa.Text(), nullable=False),
        sa.Column("schema_name", sa.String(256), server_default=""),
        sa.Column("extra_params", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), server_default="untested"),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("name"),
    )


def downgrade() -> None:
    op.drop_table("recviz_connections")
