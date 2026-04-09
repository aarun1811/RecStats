from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text, func
from app.db.types import PortableJSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RecvizDataset(Base):
    __tablename__ = "recviz_datasets"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(String(1024), server_default="", default="")
    database_id: Mapped[int] = mapped_column(Integer, nullable=False)
    superset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sql: Mapped[str] = mapped_column(Text, nullable=False)
    columns: Mapped[list] = mapped_column(PortableJSON(), nullable=False, default=list)
    sync_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="unsynced", server_default="unsynced"
    )
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), default=_utcnow
    )
