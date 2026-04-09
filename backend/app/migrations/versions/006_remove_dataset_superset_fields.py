"""Remove superset_id and sync_status from recviz_datasets.

These columns supported Superset virtual dataset synchronization which is
no longer needed -- datasets are managed entirely in RecViz.

Revision ID: 006
Revises: 005
Create Date: 2026-04-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("recviz_datasets", "superset_id")
    op.drop_column("recviz_datasets", "sync_status")


def downgrade() -> None:
    op.add_column(
        "recviz_datasets",
        sa.Column("sync_status", sa.String(32), nullable=False, server_default="unsynced"),
    )
    op.add_column(
        "recviz_datasets",
        sa.Column("superset_id", sa.Integer, nullable=True),
    )
