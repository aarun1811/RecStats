"""Sync SQLAlchemy engine + session factory for the RecViz metadata DB.

Converted from async to sync on 2026-04-10 to align with Oracle's official
FastAPI + oracledb pattern. python-oracledb's asyncio API is permanently
thin-mode only; many production Oracle instances (including ours with NCS
871 / UTF8 national character set) require thick mode. The project now uses
sync SQLAlchemy + sync oracledb everywhere, with FastAPI running DB-touching
handlers as ``def`` (threadpool) rather than ``async def``.

See docs/superpowers/specs/2026-04-09-rhel-oracle-no-sudo-deployment-design.md
and the research findings in the deployment chat log for the rationale.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.recviz_db_url,
    echo=False,
    pool_size=10,
    max_overflow=5,
    pool_pre_ping=True,
)

session_factory = sessionmaker(
    engine,
    class_=Session,
    expire_on_commit=False,
)
