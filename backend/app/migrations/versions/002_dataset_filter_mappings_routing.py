"""add filter_mappings and database_routing to recviz_datasets

Revision ID: 002
Revises: 001
Create Date: 2026-05-28

Oracle note: each DDL statement auto-commits. If a later statement fails,
earlier ones are already committed; recovery is manual ALTER TABLE DROP COLUMN.
The IS JSON constraint uses the bare form (matches OracleJSON._set_table); NULL
passes because `NULL IS JSON` evaluates to UNKNOWN, which CHECK does not reject.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("recviz_datasets", sa.Column("filter_mappings", sa.BLOB(), nullable=True))
    op.add_column("recviz_datasets", sa.Column("database_routing", sa.BLOB(), nullable=True))
    op.create_check_constraint(
        "ck_recviz_datasets_filter_mappings_json", "recviz_datasets", "filter_mappings IS JSON"
    )
    op.create_check_constraint(
        "ck_recviz_datasets_database_routing_json", "recviz_datasets", "database_routing IS JSON"
    )


def downgrade() -> None:
    op.drop_constraint("ck_recviz_datasets_database_routing_json", "recviz_datasets", type_="check")
    op.drop_constraint("ck_recviz_datasets_filter_mappings_json", "recviz_datasets", type_="check")
    op.drop_column("recviz_datasets", "database_routing")
    op.drop_column("recviz_datasets", "filter_mappings")
