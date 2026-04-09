from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from app.db.types import PortableJSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RecvizDashboard(Base):
    __tablename__ = "recviz_dashboards"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(String(1024), default="")
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    config: Mapped[dict] = mapped_column(PortableJSON(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
