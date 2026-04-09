from datetime import datetime, timezone

from sqlalchemy import DateTime, String, func
from app.db.types import PortableJSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RecvizKpi(Base):
    __tablename__ = "recviz_kpis"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(String(1024), server_default="", default="")
    dataset_id: Mapped[str] = mapped_column(String(128), nullable=False)
    metric_column: Mapped[str] = mapped_column(String(256), nullable=False)
    aggregation: Mapped[str] = mapped_column(String(32), nullable=False, server_default="SUM", default="SUM")
    config: Mapped[dict] = mapped_column(PortableJSON(), nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), default=_utcnow
    )
