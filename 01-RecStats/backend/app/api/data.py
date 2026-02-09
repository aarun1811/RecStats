"""Bulk data export endpoints for DuckDB-WASM sync."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/bulk")
async def get_bulk_data(db: AsyncSession = Depends(get_db)):
    """
    Export all data for DuckDB-WASM initialization.
    Returns transactions, breaks, and daily_metrics tables.
    """
    # Fetch transactions (limit to 50K for browser performance)
    txn_result = await db.execute(
        text("SELECT * FROM transactions ORDER BY date DESC LIMIT 50000")
    )
    transactions = [dict(row._mapping) for row in txn_result.fetchall()]

    # Fetch all breaks
    breaks_result = await db.execute(
        text("SELECT * FROM breaks ORDER BY created_date DESC")
    )
    breaks = [dict(row._mapping) for row in breaks_result.fetchall()]

    # Fetch all daily metrics
    metrics_result = await db.execute(
        text("SELECT * FROM daily_metrics ORDER BY date DESC")
    )
    daily_metrics = [dict(row._mapping) for row in metrics_result.fetchall()]

    # Convert date objects to strings for JSON serialization
    for txn in transactions:
        if txn.get('date'):
            txn['date'] = str(txn['date'])

    for brk in breaks:
        if brk.get('created_date'):
            brk['created_date'] = str(brk['created_date'])

    for metric in daily_metrics:
        if metric.get('date'):
            metric['date'] = str(metric['date'])

    return {
        "transactions": transactions,
        "breaks": breaks,
        "daily_metrics": daily_metrics
    }


@router.get("/transactions")
async def get_transactions(
    limit: int = 10000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Get paginated transactions."""
    result = await db.execute(
        text(f"SELECT * FROM transactions ORDER BY date DESC LIMIT {limit} OFFSET {offset}")
    )
    rows = [dict(row._mapping) for row in result.fetchall()]

    for row in rows:
        if row.get('date'):
            row['date'] = str(row['date'])

    return {"data": rows, "limit": limit, "offset": offset}


@router.get("/breaks")
async def get_breaks(
    limit: int = 10000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Get paginated breaks."""
    result = await db.execute(
        text(f"SELECT * FROM breaks ORDER BY created_date DESC LIMIT {limit} OFFSET {offset}")
    )
    rows = [dict(row._mapping) for row in result.fetchall()]

    for row in rows:
        if row.get('created_date'):
            row['created_date'] = str(row['created_date'])

    return {"data": rows, "limit": limit, "offset": offset}


@router.get("/daily_metrics")
async def get_daily_metrics(db: AsyncSession = Depends(get_db)):
    """Get all daily metrics."""
    result = await db.execute(
        text("SELECT * FROM daily_metrics ORDER BY date DESC")
    )
    rows = [dict(row._mapping) for row in result.fetchall()]

    for row in rows:
        if row.get('date'):
            row['date'] = str(row['date'])

    return {"data": rows}
