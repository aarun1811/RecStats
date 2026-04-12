"""Sync SQLAlchemy engine + session factory for the RecViz metadata DB.

Oracle-only. Thick mode is enforced unconditionally via ORACLE_CLIENT_LIB_DIR.
python-oracledb async is permanently thin-mode only; this project uses sync
SQLAlchemy + sync oracledb everywhere, with FastAPI running DB-touching
handlers as ``def`` (threadpool) rather than ``async def``.
"""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.recviz_db_url,
    echo=False,
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True,
    pool_recycle=1800,
)

session_factory = sessionmaker(
    engine,
    class_=Session,
    expire_on_commit=False,
)
