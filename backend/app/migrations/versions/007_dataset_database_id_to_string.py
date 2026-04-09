"""Change recviz_datasets.database_id from Integer to String(128).

Connection IDs are now UUIDs (String), so the foreign-key-style
database_id column must match.

Revision ID: 007
Revises: 006
Create Date: 2026-04-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "recviz_datasets",
        "database_id",
        existing_type=sa.Integer(),
        type_=sa.String(128),
        existing_nullable=False,
        postgresql_using="database_id::text",
    )


def downgrade() -> None:
    op.alter_column(
        "recviz_datasets",
        "database_id",
        existing_type=sa.String(128),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="database_id::integer",
    )
