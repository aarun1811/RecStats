"""SQLAlchemy database models."""

from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, Text, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DataSource(Base):
    """Data source connection configuration."""

    __tablename__ = "data_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # oracle, hive, csv, excel
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    connection_config: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    queries: Mapped[list["Query"]] = relationship(back_populates="data_source")


class Query(Base):
    """Saved SQL queries."""

    __tablename__ = "queries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sql_text: Mapped[str] = mapped_column(Text, nullable=False)
    data_source_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    data_source: Mapped[Optional["DataSource"]] = relationship(back_populates="queries")
    charts: Mapped[list["Chart"]] = relationship(back_populates="query")


class Chart(Base):
    """Chart configurations."""

    __tablename__ = "charts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    query_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("queries.id", ondelete="SET NULL"), nullable=True
    )
    chart_type: Mapped[str] = mapped_column(String(50), nullable=False)
    config: Mapped[str] = mapped_column(Text, nullable=False)  # JSON configuration
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    query: Mapped[Optional["Query"]] = relationship(back_populates="charts")
    dashboard_charts: Mapped[list["DashboardChart"]] = relationship(
        back_populates="chart", cascade="all, delete-orphan"
    )


class Dashboard(Base):
    """Dashboard configurations."""

    __tablename__ = "dashboards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    layout: Mapped[str] = mapped_column(Text, nullable=False, default="{}")  # JSON
    filters: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    dashboard_charts: Mapped[list["DashboardChart"]] = relationship(
        back_populates="dashboard", cascade="all, delete-orphan"
    )


class DashboardChart(Base):
    """Junction table for dashboard-chart relationship with position."""

    __tablename__ = "dashboard_charts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dashboard_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False
    )
    chart_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("charts.id", ondelete="CASCADE"), nullable=False
    )
    position_x: Mapped[int] = mapped_column(Integer, default=0)
    position_y: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[int] = mapped_column(Integer, default=4)
    height: Mapped[int] = mapped_column(Integer, default=3)
    config: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON overrides

    # Relationships
    dashboard: Mapped["Dashboard"] = relationship(back_populates="dashboard_charts")
    chart: Mapped["Chart"] = relationship(back_populates="dashboard_charts")


class UploadedFile(Base):
    """Uploaded CSV/Excel files metadata."""

    __tablename__ = "uploaded_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)  # Stored filename
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)  # csv, excel
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    row_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    columns: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


# ============================================================================
# COLLECTIONS (for organizing queries, charts, dashboards)
# ============================================================================


class Collection(Base):
    """Collections for organizing queries, charts, and dashboards."""

    __tablename__ = "collections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#3B82F6", nullable=False)  # Hex color
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    items: Mapped[list["CollectionItem"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan"
    )


class CollectionItem(Base):
    """Junction table linking collections to items (queries, charts, dashboards)."""

    __tablename__ = "collection_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    collection_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[str] = mapped_column(String(36), nullable=False)  # ID of query/chart/dashboard
    item_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "query", "chart", "dashboard"
    added_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # Relationships
    collection: Mapped["Collection"] = relationship(back_populates="items")


# ============================================================================
# MOCK DATA TABLES (for demo/prototype)
# ============================================================================

from sqlalchemy import Float, Date


class Transaction(Base):
    """Mock transaction records for reconciliation demo."""

    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # TXN00000001
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    region: Mapped[str] = mapped_column(String(10), nullable=False)
    country: Mapped[str] = mapped_column(String(50), nullable=False)
    lob: Mapped[str] = mapped_column(String(50), nullable=False)  # Line of business
    source_system: Mapped[str] = mapped_column(String(20), nullable=False)
    counterparty: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # matched, unmatched, break


class Break(Base):
    """Mock reconciliation breaks/exceptions."""

    __tablename__ = "breaks"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # BRK000001
    transaction_id: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)  # Critical, High, Medium, Low
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    age_days: Mapped[int] = mapped_column(Integer, nullable=False)
    assigned_to: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    region: Mapped[str] = mapped_column(String(10), nullable=False)
    lob: Mapped[str] = mapped_column(String(50), nullable=False)
    created_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-4


class DailyMetric(Base):
    """Daily aggregated metrics for trends."""

    __tablename__ = "daily_metrics"

    date: Mapped[datetime] = mapped_column(Date, primary_key=True)
    total_transactions: Mapped[int] = mapped_column(Integer, nullable=False)
    matched: Mapped[int] = mapped_column(Integer, nullable=False)
    unmatched: Mapped[int] = mapped_column(Integer, nullable=False)
    breaks: Mapped[int] = mapped_column(Integer, nullable=False)
    match_rate: Mapped[float] = mapped_column(Float, nullable=False)
    avg_break_age: Mapped[float] = mapped_column(Float, nullable=False)
