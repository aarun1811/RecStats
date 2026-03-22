"""Mock data generator for ResStats demo.

Generates:
- 100,000 transactions
- 15,000 breaks
- 365 daily metrics
- 5 sample dashboards with queries and charts
"""

import json
import random
import logging
from datetime import datetime, timedelta
from typing import List
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Transaction, Break, DailyMetric, Query, Chart, Dashboard, DashboardChart, DataSource, Collection, CollectionItem

logger = logging.getLogger(__name__)

# Configuration
NUM_TRANSACTIONS = 100_000
NUM_BREAKS = 15_000
NUM_DAYS_METRICS = 365

# Reference data
REGIONS = ["APAC", "EMEA", "NAM", "LATAM"]

REGION_COUNTRIES = {
    "APAC": ["Japan", "Singapore", "Hong Kong", "Australia", "China", "India", "South Korea"],
    "EMEA": ["UK", "Germany", "France", "Switzerland", "Netherlands", "Italy", "Spain"],
    "NAM": ["USA", "Canada", "Mexico"],
    "LATAM": ["Brazil", "Argentina", "Chile", "Colombia", "Peru"],
}

CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "SGD", "HKD"]

LOBS = ["Markets", "Banking", "Securities Services", "Treasury"]

SOURCE_SYSTEMS = ["System A", "System B", "System C", "System D"]

STATUSES = ["matched", "unmatched", "break"]
STATUS_WEIGHTS = [0.85, 0.10, 0.05]  # 85% matched, 10% unmatched, 5% break

BREAK_REASONS = [
    "Amount Mismatch",
    "Date Mismatch",
    "Missing Trade",
    "Duplicate Trade",
    "Currency Mismatch",
    "Counterparty Mismatch",
    "Settlement Date Mismatch",
    "Reference Mismatch",
    "Price Difference",
    "Quantity Mismatch",
]

BREAK_CATEGORIES = ["Critical", "High", "Medium", "Low"]
BREAK_CATEGORY_WEIGHTS = [0.05, 0.15, 0.40, 0.40]

ASSIGNEES = [
    "John Smith",
    "Jane Doe",
    "Michael Johnson",
    "Sarah Williams",
    "David Brown",
    "Emily Davis",
    "Robert Wilson",
    "Lisa Anderson",
    "Unassigned",
]


def generate_transactions(num: int, base_date: datetime) -> List[dict]:
    """Generate mock transaction records."""
    transactions = []

    for i in range(num):
        txn_id = f"TXN{i+1:08d}"
        region = random.choice(REGIONS)
        country = random.choice(REGION_COUNTRIES[region])
        days_ago = random.randint(0, 89)  # Last 90 days

        transactions.append({
            "id": txn_id,
            "date": base_date - timedelta(days=days_ago),
            "amount": round(random.uniform(100, 100000), 2),
            "currency": random.choice(CURRENCIES),
            "region": region,
            "country": country,
            "lob": random.choice(LOBS),
            "source_system": random.choice(SOURCE_SYSTEMS),
            "counterparty": f"CPTY{random.randint(1, 500):04d}",
            "status": random.choices(STATUSES, weights=STATUS_WEIGHTS)[0],
        })

        if (i + 1) % 10000 == 0:
            logger.info(f"Generated {i + 1:,} transactions...")

    return transactions


def generate_breaks(num: int, base_date: datetime) -> List[dict]:
    """Generate mock break records."""
    breaks = []

    for i in range(num):
        brk_id = f"BRK{i+1:06d}"
        region = random.choice(REGIONS)
        days_ago = random.randint(0, 29)  # Last 30 days
        age_days = random.randint(0, 30)
        category = random.choices(BREAK_CATEGORIES, weights=BREAK_CATEGORY_WEIGHTS)[0]

        # Priority maps to category
        priority_map = {"Critical": 1, "High": 2, "Medium": 3, "Low": 4}

        breaks.append({
            "id": brk_id,
            "transaction_id": f"TXN{random.randint(1, NUM_TRANSACTIONS):08d}",
            "reason": random.choice(BREAK_REASONS),
            "category": category,
            "amount": round(random.uniform(10, 10000), 2),
            "age_days": age_days,
            "assigned_to": random.choice(ASSIGNEES),
            "region": region,
            "lob": random.choice(LOBS),
            "created_date": base_date - timedelta(days=days_ago),
            "priority": priority_map[category],
        })

        if (i + 1) % 5000 == 0:
            logger.info(f"Generated {i + 1:,} breaks...")

    return breaks


def generate_daily_metrics(num_days: int, base_date: datetime) -> List[dict]:
    """Generate daily metric records."""
    metrics = []

    for i in range(num_days):
        date = base_date - timedelta(days=i)

        # Base volume with some variation
        base_volume = 50000 + random.randint(-20000, 20000)

        # Weekends have lower volume
        if date.weekday() >= 5:
            base_volume = int(base_volume * 0.3)

        # Match rate varies between 90-98%
        match_rate = 90 + random.uniform(0, 8)

        matched = int(base_volume * (match_rate / 100))
        unmatched = base_volume - matched
        breaks = int(unmatched * random.uniform(0.2, 0.4))

        metrics.append({
            "date": date,
            "total_transactions": base_volume,
            "matched": matched,
            "unmatched": unmatched,
            "breaks": breaks,
            "match_rate": round(match_rate, 2),
            "avg_break_age": round(random.uniform(2, 7), 1),
        })

    return metrics


async def check_data_exists(session: AsyncSession) -> bool:
    """Check if mock data already exists."""
    result = await session.execute(select(func.count()).select_from(Transaction))
    count = result.scalar()
    return count is not None and count > 0


async def seed_transactions(session: AsyncSession, transactions: List[dict]) -> None:
    """Insert transactions in batches."""
    batch_size = 5000

    for i in range(0, len(transactions), batch_size):
        batch = transactions[i:i + batch_size]
        session.add_all([Transaction(**t) for t in batch])
        await session.flush()
        logger.info(f"Inserted transactions batch {i // batch_size + 1}")

    await session.commit()


async def seed_breaks(session: AsyncSession, breaks: List[dict]) -> None:
    """Insert breaks in batches."""
    batch_size = 2000

    for i in range(0, len(breaks), batch_size):
        batch = breaks[i:i + batch_size]
        session.add_all([Break(**b) for b in batch])
        await session.flush()
        logger.info(f"Inserted breaks batch {i // batch_size + 1}")

    await session.commit()


async def seed_daily_metrics(session: AsyncSession, metrics: List[dict]) -> None:
    """Insert daily metrics."""
    session.add_all([DailyMetric(**m) for m in metrics])
    await session.commit()
    logger.info(f"Inserted {len(metrics)} daily metrics")


async def seed_mock_data(session: AsyncSession, force: bool = False) -> None:
    """Main seeding function.

    Args:
        session: Database session
        force: If True, skip existence check and seed anyway
    """
    if not force:
        exists = await check_data_exists(session)
        if exists:
            logger.info("Mock data already exists. Skipping seed.")
            return

    logger.info("=" * 60)
    logger.info("Starting mock data generation...")
    logger.info("=" * 60)

    base_date = datetime.now()

    # Generate data
    logger.info(f"Generating {NUM_TRANSACTIONS:,} transactions...")
    transactions = generate_transactions(NUM_TRANSACTIONS, base_date)

    logger.info(f"Generating {NUM_BREAKS:,} breaks...")
    breaks = generate_breaks(NUM_BREAKS, base_date)

    logger.info(f"Generating {NUM_DAYS_METRICS} days of metrics...")
    metrics = generate_daily_metrics(NUM_DAYS_METRICS, base_date)

    # Insert data
    logger.info("Inserting transactions into database...")
    await seed_transactions(session, transactions)

    logger.info("Inserting breaks into database...")
    await seed_breaks(session, breaks)

    logger.info("Inserting daily metrics into database...")
    await seed_daily_metrics(session, metrics)

    logger.info("=" * 60)
    logger.info("Mock data seeding complete!")
    logger.info(f"  - Transactions: {NUM_TRANSACTIONS:,}")
    logger.info(f"  - Breaks: {NUM_BREAKS:,}")
    logger.info(f"  - Daily Metrics: {NUM_DAYS_METRICS}")
    logger.info("=" * 60)

    # Seed dashboards
    await seed_sample_dashboards(session)


# ============================================================================
# DEFAULT DATA SOURCE
# ============================================================================

DEFAULT_DATA_SOURCE = {
    "id": "ds-sqlite-local",
    "name": "SQLite Database",
    "type": "sqlite",
    "description": "Local SQLite database with demo transaction data",
    "connection_config": json.dumps({"database": "resstats.db"}),
}


async def seed_default_data_source(session: AsyncSession) -> str:
    """Seed the default SQLite data source. Returns the data source ID."""
    # Check if it already exists
    result = await session.execute(
        select(DataSource).where(DataSource.id == DEFAULT_DATA_SOURCE["id"])
    )
    existing = result.scalar_one_or_none()
    if existing:
        logger.info("Default data source already exists.")
        return existing.id

    logger.info("Creating default SQLite data source...")
    data_source = DataSource(
        id=DEFAULT_DATA_SOURCE["id"],
        name=DEFAULT_DATA_SOURCE["name"],
        type=DEFAULT_DATA_SOURCE["type"],
        description=DEFAULT_DATA_SOURCE["description"],
        connection_config=DEFAULT_DATA_SOURCE["connection_config"],
    )
    session.add(data_source)
    await session.flush()
    logger.info(f"Created data source: {data_source.name} ({data_source.id})")
    return data_source.id


# ============================================================================
# SAMPLE DASHBOARDS, CHARTS, AND QUERIES
# ============================================================================

SAMPLE_QUERIES = [
    # ==================== KPI QUERIES ====================
    {
        "id": "query-kpi-total-txns",
        "name": "Total Transactions",
        "description": "Total count of all transactions",
        "sql_text": "SELECT COUNT(*) as value FROM transactions",
    },
    {
        "id": "query-kpi-total-volume",
        "name": "Total Transaction Volume",
        "description": "Sum of all transaction amounts",
        "sql_text": "SELECT SUM(amount) as value FROM transactions",
    },
    {
        "id": "query-kpi-match-rate",
        "name": "Match Rate",
        "description": "Percentage of matched transactions",
        "sql_text": "SELECT ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value FROM transactions",
    },
    {
        "id": "query-kpi-open-breaks",
        "name": "Open Breaks",
        "description": "Total count of open breaks",
        "sql_text": "SELECT COUNT(*) as value FROM breaks",
    },
    {
        "id": "query-kpi-break-amount",
        "name": "Total Break Amount",
        "description": "Sum of all break amounts",
        "sql_text": "SELECT SUM(amount) as value FROM breaks",
    },
    {
        "id": "query-kpi-avg-break-age",
        "name": "Average Break Age",
        "description": "Average age of breaks in days",
        "sql_text": "SELECT ROUND(AVG(age_days), 1) as value FROM breaks",
    },
    {
        "id": "query-kpi-max-break-age",
        "name": "Max Break Age",
        "description": "Oldest break in days",
        "sql_text": "SELECT MAX(age_days) as value FROM breaks",
    },
    {
        "id": "query-kpi-critical-breaks",
        "name": "Critical Breaks",
        "description": "Count of critical priority breaks",
        "sql_text": "SELECT COUNT(*) as value FROM breaks WHERE category = 'Critical'",
    },
    {
        "id": "query-kpi-avg-txn-amount",
        "name": "Average Transaction Amount",
        "description": "Average transaction amount",
        "sql_text": "SELECT ROUND(AVG(amount), 2) as value FROM transactions",
    },
    # KPI with trend data (daily values for trend calculation)
    {
        "id": "query-kpi-daily-volume-trend",
        "name": "Daily Transaction Volume with Trend",
        "description": "Daily volumes for KPI trend indicator",
        "sql_text": "SELECT date, total_transactions as value FROM daily_metrics ORDER BY date ASC",
    },
    {
        "id": "query-kpi-daily-breaks-trend",
        "name": "Daily Breaks with Trend",
        "description": "Daily break counts for KPI trend indicator",
        "sql_text": "SELECT date, breaks as value FROM daily_metrics ORDER BY date ASC",
    },
    {
        "id": "query-kpi-daily-match-rate-trend",
        "name": "Daily Match Rate with Trend",
        "description": "Daily match rates for KPI trend indicator",
        "sql_text": "SELECT date, match_rate as value FROM daily_metrics ORDER BY date ASC",
    },
    # ==================== LINE CHART QUERIES ====================
    {
        "id": "query-line-daily-trend",
        "name": "Daily Transaction Trend",
        "description": "Daily transaction volumes for 30 days",
        "sql_text": "SELECT date as category, total_transactions as value FROM daily_metrics ORDER BY date ASC LIMIT 30",
    },
    {
        "id": "query-line-weekly-trend",
        "name": "Weekly Transaction Trend",
        "description": "Weekly aggregated transaction volumes",
        "sql_text": "SELECT strftime('%Y-W%W', date) as category, SUM(total_transactions) as value FROM daily_metrics GROUP BY 1 ORDER BY 1 ASC LIMIT 12",
    },
    {
        "id": "query-line-match-rate-trend",
        "name": "Daily Match Rate Trend",
        "description": "Match rate over 30 days",
        "sql_text": "SELECT date as category, match_rate as value FROM daily_metrics ORDER BY date ASC LIMIT 30",
    },
    {
        "id": "query-line-breaks-trend",
        "name": "Daily Breaks Trend",
        "description": "Break count over 30 days",
        "sql_text": "SELECT date as category, breaks as value FROM daily_metrics ORDER BY date ASC LIMIT 30",
    },
    # ==================== AREA CHART QUERIES ====================
    {
        "id": "query-area-matched-trend",
        "name": "Matched Transactions Trend",
        "description": "Daily matched transaction volume",
        "sql_text": "SELECT date as category, matched as value FROM daily_metrics ORDER BY date ASC LIMIT 30",
    },
    # ==================== BAR CHART QUERIES ====================
    {
        "id": "query-bar-region-volume",
        "name": "Volume by Region",
        "description": "Transaction count by region",
        "sql_text": "SELECT region as category, COUNT(*) as value FROM transactions GROUP BY region ORDER BY value DESC",
    },
    {
        "id": "query-bar-breaks-by-reason",
        "name": "Breaks by Reason",
        "description": "Top 10 break reasons",
        "sql_text": "SELECT reason as category, COUNT(*) as value FROM breaks GROUP BY reason ORDER BY value DESC LIMIT 10",
    },
    {
        "id": "query-bar-breaks-by-lob",
        "name": "Breaks by LOB",
        "description": "Break count by line of business",
        "sql_text": "SELECT lob as category, COUNT(*) as value FROM breaks GROUP BY lob ORDER BY value DESC",
    },
    {
        "id": "query-bar-breaks-aging",
        "name": "Breaks by Age Bucket",
        "description": "Breaks grouped by age",
        "sql_text": """SELECT CASE WHEN age_days <= 1 THEN '0-1 days' WHEN age_days <= 5 THEN '2-5 days' WHEN age_days <= 10 THEN '6-10 days' WHEN age_days <= 20 THEN '11-20 days' ELSE '20+ days' END as category, COUNT(*) as value FROM breaks GROUP BY 1 ORDER BY MIN(age_days)""",
    },
    {
        "id": "query-bar-country-top",
        "name": "Top 10 Countries",
        "description": "Top 10 countries by volume",
        "sql_text": "SELECT country as category, COUNT(*) as value FROM transactions GROUP BY country ORDER BY value DESC LIMIT 10",
    },
    {
        "id": "query-bar-system-volume",
        "name": "Volume by Source System",
        "description": "Transaction distribution by system",
        "sql_text": "SELECT source_system as category, COUNT(*) as value FROM transactions GROUP BY source_system ORDER BY value DESC",
    },
    {
        "id": "query-bar-currency-dist",
        "name": "Volume by Currency",
        "description": "Transaction count by currency",
        "sql_text": "SELECT currency as category, COUNT(*) as value FROM transactions GROUP BY currency ORDER BY value DESC LIMIT 7",
    },
    {
        "id": "query-bar-counterparties",
        "name": "Top Counterparties",
        "description": "Top 10 counterparties by volume",
        "sql_text": "SELECT counterparty as category, COUNT(*) as value FROM transactions GROUP BY counterparty ORDER BY value DESC LIMIT 10",
    },
    {
        "id": "query-bar-breaks-assignee",
        "name": "Breaks by Assignee",
        "description": "Break count by assigned person",
        "sql_text": "SELECT assigned_to as category, COUNT(*) as value FROM breaks GROUP BY assigned_to ORDER BY value DESC",
    },
    # ==================== COLUMN CHART QUERIES ====================
    {
        "id": "query-column-lob-volume",
        "name": "Volume by LOB",
        "description": "Transaction count by line of business",
        "sql_text": "SELECT lob as category, COUNT(*) as value FROM transactions GROUP BY lob ORDER BY value DESC",
    },
    {
        "id": "query-column-status-dist",
        "name": "Status Distribution",
        "description": "Transaction count by status",
        "sql_text": "SELECT status as category, COUNT(*) as value FROM transactions GROUP BY status ORDER BY CASE status WHEN 'matched' THEN 1 WHEN 'unmatched' THEN 2 ELSE 3 END",
    },
    # ==================== PIE/DONUT CHART QUERIES ====================
    {
        "id": "query-pie-status",
        "name": "Status Distribution",
        "description": "Transaction status breakdown",
        "sql_text": "SELECT status as category, COUNT(*) as value FROM transactions GROUP BY status ORDER BY value DESC",
    },
    {
        "id": "query-donut-breaks-category",
        "name": "Breaks by Category",
        "description": "Break severity distribution",
        "sql_text": "SELECT category, COUNT(*) as value FROM breaks GROUP BY category ORDER BY CASE category WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END",
    },
    {
        "id": "query-donut-region",
        "name": "Regional Distribution",
        "description": "Transaction share by region",
        "sql_text": "SELECT region as category, COUNT(*) as value FROM transactions GROUP BY region ORDER BY value DESC",
    },
    # ==================== GAUGE CHART QUERIES ====================
    {
        "id": "query-gauge-match-rate",
        "name": "Match Rate Gauge",
        "description": "Overall match rate percentage",
        "sql_text": "SELECT ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value FROM transactions",
    },
    # ==================== SCATTER CHART QUERIES ====================
    {
        "id": "query-scatter-amount-age",
        "name": "Break Amount vs Age",
        "description": "Correlation between break amount and age",
        "sql_text": "SELECT age_days as x, amount as y FROM breaks LIMIT 500",
    },
    {
        "id": "query-scatter-volume-breaks",
        "name": "Volume vs Breaks",
        "description": "Daily volume vs break correlation",
        "sql_text": "SELECT total_transactions as x, breaks as y FROM daily_metrics ORDER BY date DESC LIMIT 30",
    },
    # ==================== FUNNEL CHART QUERIES ====================
    {
        "id": "query-funnel-processing",
        "name": "Transaction Processing Funnel",
        "description": "Transaction flow through stages",
        "sql_text": """SELECT 'Total Received' as category, COUNT(*) as value FROM transactions UNION ALL SELECT 'Validated' as category, CAST(COUNT(*) * 0.95 AS INTEGER) as value FROM transactions UNION ALL SELECT 'Matched' as category, COUNT(*) as value FROM transactions WHERE status = 'matched' UNION ALL SELECT 'Settled' as category, CAST(COUNT(*) * 0.80 AS INTEGER) as value FROM transactions WHERE status = 'matched' ORDER BY value DESC""",
    },
    # ==================== TREEMAP CHART QUERIES ====================
    {
        "id": "query-treemap-region",
        "name": "Regional Treemap",
        "description": "Volume distribution by region",
        "sql_text": "SELECT region as category, COUNT(*) as value FROM transactions GROUP BY region ORDER BY value DESC",
    },
    {
        "id": "query-treemap-country",
        "name": "Country Treemap",
        "description": "Top countries as treemap",
        "sql_text": "SELECT country as category, COUNT(*) as value FROM transactions GROUP BY country ORDER BY value DESC LIMIT 10",
    },
    # ==================== RADIAL BAR CHART QUERIES ====================
    {
        "id": "query-radial-lob-match",
        "name": "LOB Match Rates",
        "description": "Match rate % by LOB",
        "sql_text": "SELECT lob as category, ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value FROM transactions GROUP BY lob ORDER BY value DESC",
    },
    {
        "id": "query-radial-system-match",
        "name": "System Match Rates",
        "description": "Match rate % by system",
        "sql_text": "SELECT source_system as category, ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value FROM transactions GROUP BY source_system ORDER BY value DESC",
    },
    # ==================== RADAR CHART QUERIES ====================
    {
        "id": "query-radar-region-metrics",
        "name": "Regional Performance",
        "description": "Multi-dimensional regional comparison",
        "sql_text": "SELECT region as category, COUNT(*) as volume, ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as match_rate, ROUND(AVG(amount), 0) as avg_amount FROM transactions GROUP BY region",
    },
    # ==================== HEATMAP CHART QUERIES ====================
    {
        "id": "query-heatmap-region-lob",
        "name": "Region vs LOB Heatmap",
        "description": "Volume heatmap by region and LOB",
        "sql_text": "SELECT region as x, lob as y, COUNT(*) as value FROM transactions GROUP BY region, lob ORDER BY region, lob",
    },
    {
        "id": "query-heatmap-system-status",
        "name": "System vs Status Heatmap",
        "description": "Status distribution by system",
        "sql_text": "SELECT source_system as x, status as y, COUNT(*) as value FROM transactions GROUP BY source_system, status ORDER BY source_system, status",
    },
    # ==================== TABLE QUERIES ====================
    {
        "id": "query-table-recent-txns",
        "name": "Recent Transactions",
        "description": "Latest 50 transactions",
        "sql_text": "SELECT id, date, amount, currency, region, lob, source_system, status FROM transactions ORDER BY date DESC LIMIT 50",
    },
    {
        "id": "query-table-critical-breaks",
        "name": "Critical & High Breaks",
        "description": "High priority breaks",
        "sql_text": "SELECT id, reason, category, amount, age_days, assigned_to, region, lob FROM breaks WHERE category IN ('Critical', 'High') ORDER BY CASE category WHEN 'Critical' THEN 1 ELSE 2 END, age_days DESC LIMIT 50",
    },
    {
        "id": "query-table-unmatched",
        "name": "Unmatched Transactions",
        "description": "Transactions needing attention",
        "sql_text": "SELECT id, date, amount, currency, region, lob, source_system, counterparty, status FROM transactions WHERE status IN ('unmatched', 'break') ORDER BY date DESC LIMIT 50",
    },
    {
        "id": "query-table-daily-metrics",
        "name": "Daily Metrics History",
        "description": "Historical daily metrics",
        "sql_text": "SELECT date, total_transactions, matched, unmatched, breaks, match_rate, avg_break_age FROM daily_metrics ORDER BY date DESC LIMIT 30",
    },
    {
        "id": "query-table-all-breaks",
        "name": "All Breaks",
        "description": "Complete breaks listing",
        "sql_text": "SELECT id, reason, category, amount, age_days, assigned_to, region, lob, created_date FROM breaks ORDER BY created_date DESC LIMIT 100",
    },
]

SAMPLE_CHARTS = [
    # ==================== KPI CARDS (showcasing all KPI options) ====================
    # KPI 1: Simple count with SUM aggregation
    {
        "id": "chart-kpi-total-txns",
        "name": "Total Transactions",
        "description": "Total transaction count",
        "query_id": "query-kpi-total-txns",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "citi",
            "title": "Total Transactions",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "sum",
                    "format": "number",
                    "decimals": 0
                }
            }
        },
    },
    # KPI 2: Currency format with SUM
    {
        "id": "chart-kpi-total-volume",
        "name": "Total Volume",
        "description": "Total transaction volume in USD",
        "query_id": "query-kpi-total-volume",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "success",
            "title": "Total Volume",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "sum",
                    "format": "currency",
                    "currencyCode": "USD",
                    "decimals": 0
                }
            }
        },
    },
    # KPI 3: Percent format
    {
        "id": "chart-kpi-match-rate",
        "name": "Match Rate",
        "description": "Overall match rate percentage",
        "query_id": "query-kpi-match-rate",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "success",
            "title": "Match Rate",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "last",
                    "format": "percent",
                    "decimals": 1
                }
            }
        },
    },
    # KPI 4: COUNT aggregation
    {
        "id": "chart-kpi-open-breaks",
        "name": "Open Breaks",
        "description": "Total open break count",
        "query_id": "query-kpi-open-breaks",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "warm",
            "title": "Open Breaks",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "sum",
                    "format": "number",
                    "decimals": 0
                }
            }
        },
    },
    # KPI 5: Currency with break amount
    {
        "id": "chart-kpi-break-amount",
        "name": "Break Amount",
        "description": "Total break exposure",
        "query_id": "query-kpi-break-amount",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "warm",
            "title": "Break Exposure",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "sum",
                    "format": "currency",
                    "currencyCode": "USD",
                    "decimals": 0
                }
            }
        },
    },
    # KPI 6: AVERAGE aggregation with suffix
    {
        "id": "chart-kpi-avg-break-age",
        "name": "Avg Break Age",
        "description": "Average age of breaks in days",
        "query_id": "query-kpi-avg-break-age",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "cool",
            "title": "Avg Break Age",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "average",
                    "format": "number",
                    "decimals": 1,
                    "suffix": " days"
                }
            }
        },
    },
    # KPI 7: MAX aggregation
    {
        "id": "chart-kpi-max-break-age",
        "name": "Oldest Break",
        "description": "Oldest break in days",
        "query_id": "query-kpi-max-break-age",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "warm",
            "title": "Oldest Break",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "max",
                    "format": "number",
                    "decimals": 0,
                    "suffix": " days"
                }
            }
        },
    },
    # KPI 8: Critical breaks count
    {
        "id": "chart-kpi-critical-breaks",
        "name": "Critical Breaks",
        "description": "Critical priority breaks",
        "query_id": "query-kpi-critical-breaks",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "warm",
            "title": "Critical Breaks",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "sum",
                    "format": "number",
                    "decimals": 0
                }
            }
        },
    },
    # KPI 9: Average with currency
    {
        "id": "chart-kpi-avg-txn-amount",
        "name": "Avg Transaction",
        "description": "Average transaction amount",
        "query_id": "query-kpi-avg-txn-amount",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "citi",
            "title": "Avg Transaction",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "average",
                    "format": "currency",
                    "currencyCode": "USD",
                    "decimals": 0
                }
            }
        },
    },
    # KPI 10: With trend indicator (volume)
    {
        "id": "chart-kpi-daily-volume-trend",
        "name": "Daily Volume",
        "description": "Today's volume with trend",
        "query_id": "query-kpi-daily-volume-trend",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "citi",
            "title": "Daily Volume",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "last",
                    "format": "number",
                    "decimals": 0,
                    "showTrend": True,
                    "trendCompareField": "date",
                    "trendMode": "previous",
                    "trendUpIsGood": True
                }
            }
        },
    },
    # KPI 11: With trend indicator (breaks - down is good)
    {
        "id": "chart-kpi-daily-breaks-trend",
        "name": "Daily Breaks",
        "description": "Today's breaks with trend",
        "query_id": "query-kpi-daily-breaks-trend",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "warm",
            "title": "Daily Breaks",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "last",
                    "format": "number",
                    "decimals": 0,
                    "showTrend": True,
                    "trendCompareField": "date",
                    "trendMode": "previous",
                    "trendUpIsGood": False
                }
            }
        },
    },
    # KPI 12: Match rate with trend (percent)
    {
        "id": "chart-kpi-match-rate-trend",
        "name": "Match Rate Trend",
        "description": "Match rate with trend indicator",
        "query_id": "query-kpi-daily-match-rate-trend",
        "chart_type": "kpiCard",
        "config": {
            "yAxis": "value",
            "colorScheme": "success",
            "title": "Match Rate",
            "custom_options": {
                "kpi_options": {
                    "aggregation": "last",
                    "format": "percent",
                    "decimals": 1,
                    "showTrend": True,
                    "trendCompareField": "date",
                    "trendMode": "previous",
                    "trendUpIsGood": True
                }
            }
        },
    },
    # ==================== LINE CHARTS ====================
    {
        "id": "chart-line-daily-trend",
        "name": "Daily Transaction Trend",
        "description": "30-day transaction volume trend",
        "query_id": "query-line-daily-trend",
        "chart_type": "line",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": False},
    },
    {
        "id": "chart-line-weekly-trend",
        "name": "Weekly Transaction Volume",
        "description": "Weekly aggregated volumes",
        "query_id": "query-line-weekly-trend",
        "chart_type": "line",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "cool", "showLabels": False},
    },
    {
        "id": "chart-line-match-rate",
        "name": "Daily Match Rate",
        "description": "Match rate trend over 30 days",
        "query_id": "query-line-match-rate-trend",
        "chart_type": "line",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "success", "showLabels": False},
    },
    {
        "id": "chart-line-breaks-trend",
        "name": "Daily Breaks Trend",
        "description": "Break count over time",
        "query_id": "query-line-breaks-trend",
        "chart_type": "line",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "warm", "showLabels": False},
    },
    # ==================== AREA CHARTS ====================
    {
        "id": "chart-area-matched",
        "name": "Matched Transactions Trend",
        "description": "Daily matched transaction volume",
        "query_id": "query-area-matched-trend",
        "chart_type": "area",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "success", "showLabels": False},
    },
    # ==================== BAR CHARTS ====================
    {
        "id": "chart-bar-region-volume",
        "name": "Volume by Region",
        "description": "Transaction distribution across regions",
        "query_id": "query-bar-region-volume",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-bar-breaks-reason",
        "name": "Breaks by Reason",
        "description": "Top 10 break reasons",
        "query_id": "query-bar-breaks-by-reason",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "warm", "showLabels": True},
    },
    {
        "id": "chart-bar-breaks-lob",
        "name": "Breaks by LOB",
        "description": "Break distribution by line of business",
        "query_id": "query-bar-breaks-by-lob",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "cool", "showLabels": True},
    },
    {
        "id": "chart-bar-breaks-aging",
        "name": "Break Aging Analysis",
        "description": "Breaks grouped by age buckets",
        "query_id": "query-bar-breaks-aging",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "warm", "showLabels": True},
    },
    {
        "id": "chart-bar-country-top",
        "name": "Top 10 Countries",
        "description": "Countries with highest transaction volumes",
        "query_id": "query-bar-country-top",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "rainbow", "showLabels": True},
    },
    {
        "id": "chart-bar-system-volume",
        "name": "Volume by Source System",
        "description": "Transaction distribution by source system",
        "query_id": "query-bar-system-volume",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "cool", "showLabels": True},
    },
    {
        "id": "chart-bar-currency-dist",
        "name": "Volume by Currency",
        "description": "Transaction distribution by currency",
        "query_id": "query-bar-currency-dist",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "monochrome", "showLabels": True},
    },
    {
        "id": "chart-bar-counterparties",
        "name": "Top Counterparties",
        "description": "Most active counterparties",
        "query_id": "query-bar-counterparties",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-bar-breaks-assignee",
        "name": "Breaks by Assignee",
        "description": "Break workload distribution",
        "query_id": "query-bar-breaks-assignee",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "rainbow", "showLabels": True},
    },
    # ==================== COLUMN CHARTS ====================
    {
        "id": "chart-column-lob-volume",
        "name": "Volume by LOB",
        "description": "Transaction count by line of business",
        "query_id": "query-column-lob-volume",
        "chart_type": "column",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-column-status-dist",
        "name": "Status Distribution",
        "description": "Transaction status breakdown",
        "query_id": "query-column-status-dist",
        "chart_type": "column",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "success", "showLabels": True},
    },
    # ==================== PIE CHARTS ====================
    {
        "id": "chart-pie-status",
        "name": "Status Distribution (Pie)",
        "description": "Transaction status breakdown as pie chart",
        "query_id": "query-pie-status",
        "chart_type": "pie",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-pie-region",
        "name": "Regional Distribution (Pie)",
        "description": "Transaction share by region",
        "query_id": "query-donut-region",
        "chart_type": "pie",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "rainbow", "showLabels": True},
    },
    # ==================== DONUT CHARTS ====================
    {
        "id": "chart-donut-status",
        "name": "Status Distribution",
        "description": "Transaction status as donut chart",
        "query_id": "query-pie-status",
        "chart_type": "donut",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-donut-breaks-category",
        "name": "Breaks by Category",
        "description": "Severity distribution of breaks",
        "query_id": "query-donut-breaks-category",
        "chart_type": "donut",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "warm", "showLabels": True},
    },
    {
        "id": "chart-donut-region",
        "name": "Regional Distribution",
        "description": "Transaction share by region",
        "query_id": "query-donut-region",
        "chart_type": "donut",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "cool", "showLabels": True},
    },
    # ==================== GAUGE CHARTS ====================
    {
        "id": "chart-gauge-match-rate",
        "name": "Match Rate Gauge",
        "description": "Overall match rate as gauge",
        "query_id": "query-gauge-match-rate",
        "chart_type": "gauge",
        "config": {"yAxis": "value", "colorScheme": "success", "title": "Match Rate"},
    },
    # ==================== SCATTER CHARTS ====================
    {
        "id": "chart-scatter-amount-age",
        "name": "Amount vs Age Scatter",
        "description": "Correlation between break amount and age",
        "query_id": "query-scatter-amount-age",
        "chart_type": "scatter",
        "config": {"xAxis": "x", "yAxis": "y", "colorScheme": "warm", "showLabels": False},
    },
    {
        "id": "chart-scatter-volume-breaks",
        "name": "Volume vs Breaks",
        "description": "Correlation between daily volume and breaks",
        "query_id": "query-scatter-volume-breaks",
        "chart_type": "scatter",
        "config": {"xAxis": "x", "yAxis": "y", "colorScheme": "citi", "showLabels": False},
    },
    # ==================== FUNNEL CHARTS ====================
    {
        "id": "chart-funnel-processing",
        "name": "Processing Funnel",
        "description": "Transaction processing stages",
        "query_id": "query-funnel-processing",
        "chart_type": "funnel",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    # ==================== TREEMAP CHARTS ====================
    {
        "id": "chart-treemap-region",
        "name": "Regional Treemap",
        "description": "Volume distribution as treemap",
        "query_id": "query-treemap-region",
        "chart_type": "treemap",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-treemap-country",
        "name": "Country Treemap",
        "description": "Top countries as treemap",
        "query_id": "query-treemap-country",
        "chart_type": "treemap",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "rainbow", "showLabels": True},
    },
    # ==================== RADIAL BAR CHARTS ====================
    {
        "id": "chart-radial-lob-match",
        "name": "LOB Match Rates",
        "description": "Match rate by LOB as radial bar",
        "query_id": "query-radial-lob-match",
        "chart_type": "radialBar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "success", "showLabels": True},
    },
    {
        "id": "chart-radial-system-match",
        "name": "System Match Rates",
        "description": "Match rate by system as radial bar",
        "query_id": "query-radial-system-match",
        "chart_type": "radialBar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    # ==================== RADAR CHARTS ====================
    {
        "id": "chart-radar-region",
        "name": "Regional Performance Radar",
        "description": "Multi-dimensional regional comparison",
        "query_id": "query-radar-region-metrics",
        "chart_type": "radar",
        "config": {"xAxis": "category", "yAxis": "volume", "colorScheme": "cool", "showLabels": True},
    },
    # ==================== HEATMAP CHARTS ====================
    {
        "id": "chart-heatmap-region-lob",
        "name": "Region vs LOB Heatmap",
        "description": "Volume heatmap by region and LOB",
        "query_id": "query-heatmap-region-lob",
        "chart_type": "heatmap",
        "config": {"xAxis": "x", "yAxis": "y", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-heatmap-system-status",
        "name": "System vs Status Heatmap",
        "description": "Status distribution by system",
        "query_id": "query-heatmap-system-status",
        "chart_type": "heatmap",
        "config": {"xAxis": "x", "yAxis": "y", "colorScheme": "warm", "showLabels": True},
    },
]

SAMPLE_DASHBOARDS = [
    # ==================== DASHBOARD 1: Executive Overview ====================
    # Showcases: KPI cards with various formats, gauges, line charts, donut, filters
    {
        "id": "dashboard-executive",
        "name": "Executive Overview",
        "description": "High-level KPIs and trends for executive stakeholders. Features rich KPI cards with trend indicators.",
        "layout": {
            "columns": 12,
            "widgets": [
                # Row 1: KPI Cards showcasing different formats
                {"id": "w1", "type": "chart", "x": 0, "y": 0, "cols": 3, "rows": 3, "title": "Total Transactions", "chartId": "chart-kpi-total-txns", "chartType": "kpiCard"},
                {"id": "w2", "type": "chart", "x": 3, "y": 0, "cols": 3, "rows": 3, "title": "Total Volume", "chartId": "chart-kpi-total-volume", "chartType": "kpiCard"},
                {"id": "w3", "type": "chart", "x": 6, "y": 0, "cols": 3, "rows": 3, "title": "Match Rate", "chartId": "chart-kpi-match-rate", "chartType": "kpiCard"},
                {"id": "w4", "type": "chart", "x": 9, "y": 0, "cols": 3, "rows": 3, "title": "Match Rate Gauge", "chartId": "chart-gauge-match-rate", "chartType": "gauge"},
                # Row 2: KPI Cards with trends
                {"id": "w5", "type": "chart", "x": 0, "y": 3, "cols": 3, "rows": 3, "title": "Daily Volume", "chartId": "chart-kpi-daily-volume-trend", "chartType": "kpiCard"},
                {"id": "w6", "type": "chart", "x": 3, "y": 3, "cols": 3, "rows": 3, "title": "Open Breaks", "chartId": "chart-kpi-open-breaks", "chartType": "kpiCard"},
                {"id": "w7", "type": "chart", "x": 6, "y": 3, "cols": 3, "rows": 3, "title": "Break Amount", "chartId": "chart-kpi-break-amount", "chartType": "kpiCard"},
                {"id": "w8", "type": "chart", "x": 9, "y": 3, "cols": 3, "rows": 3, "title": "Avg Transaction", "chartId": "chart-kpi-avg-txn-amount", "chartType": "kpiCard"},
                # Row 3: Daily Trend + Status Distribution
                {"id": "w9", "type": "chart", "x": 0, "y": 6, "cols": 8, "rows": 5, "title": "Daily Transaction Trend", "chartId": "chart-line-daily-trend", "chartType": "line"},
                {"id": "w10", "type": "chart", "x": 8, "y": 6, "cols": 4, "rows": 5, "title": "Status Distribution", "chartId": "chart-donut-status", "chartType": "donut"},
                # Row 4: Regional Analysis
                {"id": "w11", "type": "chart", "x": 0, "y": 11, "cols": 4, "rows": 5, "title": "Volume by Region", "chartId": "chart-bar-region-volume", "chartType": "bar"},
                {"id": "w12", "type": "chart", "x": 4, "y": 11, "cols": 4, "rows": 5, "title": "Volume by LOB", "chartId": "chart-column-lob-volume", "chartType": "column"},
                {"id": "w13", "type": "chart", "x": 8, "y": 11, "cols": 4, "rows": 5, "title": "Regional Distribution", "chartId": "chart-donut-region", "chartType": "donut"},
            ]
        },
        "filters": [
            {
                "id": "filter-region",
                "type": "multi-select",
                "label": "Region",
                "column": "region",
                "table": "transactions",
                "options": ["APAC", "EMEA", "NAM", "LATAM"]
            },
            {
                "id": "filter-status",
                "type": "select",
                "label": "Status",
                "column": "status",
                "table": "transactions",
                "options": ["matched", "unmatched", "break"]
            },
            {
                "id": "filter-lob",
                "type": "multi-select",
                "label": "LOB",
                "column": "lob",
                "table": "transactions",
                "options": ["Markets", "Banking", "Securities Services", "Treasury"]
            }
        ],
    },
    # ==================== DASHBOARD 2: Break Analysis ====================
    # Showcases: KPI cards (count, avg, max), bar charts, scatter plot, donut, cross-filtering
    {
        "id": "dashboard-breaks",
        "name": "Break Analysis",
        "description": "Detailed analysis of reconciliation breaks and exceptions. Click on charts to cross-filter.",
        "layout": {
            "columns": 12,
            "widgets": [
                # Row 1: KPI Cards for break metrics
                {"id": "w1", "type": "chart", "x": 0, "y": 0, "cols": 3, "rows": 3, "title": "Open Breaks", "chartId": "chart-kpi-open-breaks", "chartType": "kpiCard"},
                {"id": "w2", "type": "chart", "x": 3, "y": 0, "cols": 3, "rows": 3, "title": "Critical Breaks", "chartId": "chart-kpi-critical-breaks", "chartType": "kpiCard"},
                {"id": "w3", "type": "chart", "x": 6, "y": 0, "cols": 3, "rows": 3, "title": "Avg Break Age", "chartId": "chart-kpi-avg-break-age", "chartType": "kpiCard"},
                {"id": "w4", "type": "chart", "x": 9, "y": 0, "cols": 3, "rows": 3, "title": "Oldest Break", "chartId": "chart-kpi-max-break-age", "chartType": "kpiCard"},
                # Row 2: Break exposure + categories
                {"id": "w5", "type": "chart", "x": 0, "y": 3, "cols": 3, "rows": 3, "title": "Break Exposure", "chartId": "chart-kpi-break-amount", "chartType": "kpiCard"},
                {"id": "w6", "type": "chart", "x": 3, "y": 3, "cols": 3, "rows": 3, "title": "Daily Breaks", "chartId": "chart-kpi-daily-breaks-trend", "chartType": "kpiCard"},
                {"id": "w7", "type": "chart", "x": 6, "y": 3, "cols": 6, "rows": 5, "title": "Break Categories", "chartId": "chart-donut-breaks-category", "chartType": "donut"},
                # Row 3: Analysis charts
                {"id": "w8", "type": "chart", "x": 0, "y": 6, "cols": 6, "rows": 5, "title": "Breaks by Reason", "chartId": "chart-bar-breaks-reason", "chartType": "bar"},
                {"id": "w9", "type": "chart", "x": 6, "y": 8, "cols": 6, "rows": 5, "title": "Break Aging Analysis", "chartId": "chart-bar-breaks-aging", "chartType": "bar"},
                # Row 4: Scatter + Assignee workload
                {"id": "w10", "type": "chart", "x": 0, "y": 11, "cols": 6, "rows": 5, "title": "Amount vs Age", "chartId": "chart-scatter-amount-age", "chartType": "scatter"},
                {"id": "w11", "type": "chart", "x": 6, "y": 13, "cols": 6, "rows": 5, "title": "Breaks by Assignee", "chartId": "chart-bar-breaks-assignee", "chartType": "bar"},
                # Row 5: Table
                {"id": "w12", "type": "table", "x": 0, "y": 18, "cols": 12, "rows": 5, "title": "Critical & High Priority Breaks", "queryId": "query-table-critical-breaks"},
            ]
        },
        "filters": [
            {
                "id": "filter-category",
                "type": "multi-select",
                "label": "Category",
                "column": "category",
                "table": "breaks",
                "options": ["Critical", "High", "Medium", "Low"]
            },
            {
                "id": "filter-break-region",
                "type": "multi-select",
                "label": "Region",
                "column": "region",
                "table": "breaks",
                "options": ["APAC", "EMEA", "NAM", "LATAM"]
            },
            {
                "id": "filter-age-range",
                "type": "range",
                "label": "Age (days)",
                "column": "age_days",
                "table": "breaks",
                "min": 0,
                "max": 30
            }
        ],
    },
    # ==================== DASHBOARD 3: Geographic Analysis ====================
    # Showcases: Treemap, radar, pie, bar charts, regional focus
    {
        "id": "dashboard-geographic",
        "name": "Geographic Analysis",
        "description": "Regional distribution of transactions and performance metrics.",
        "layout": {
            "columns": 12,
            "widgets": [
                # Row 1: Treemap + Radar
                {"id": "w1", "type": "chart", "x": 0, "y": 0, "cols": 6, "rows": 6, "title": "Regional Volume Treemap", "chartId": "chart-treemap-region", "chartType": "treemap"},
                {"id": "w2", "type": "chart", "x": 6, "y": 0, "cols": 6, "rows": 6, "title": "Regional Performance Radar", "chartId": "chart-radar-region", "chartType": "radar"},
                # Row 2: Bar charts
                {"id": "w3", "type": "chart", "x": 0, "y": 6, "cols": 6, "rows": 5, "title": "Volume by Region", "chartId": "chart-bar-region-volume", "chartType": "bar"},
                {"id": "w4", "type": "chart", "x": 6, "y": 6, "cols": 6, "rows": 5, "title": "Top 10 Countries", "chartId": "chart-bar-country-top", "chartType": "bar"},
                # Row 3: More visualizations
                {"id": "w5", "type": "chart", "x": 0, "y": 11, "cols": 6, "rows": 5, "title": "Country Treemap", "chartId": "chart-treemap-country", "chartType": "treemap"},
                {"id": "w6", "type": "chart", "x": 6, "y": 11, "cols": 6, "rows": 5, "title": "Regional Distribution", "chartId": "chart-pie-region", "chartType": "pie"},
            ]
        },
        "filters": [
            {
                "id": "filter-geo-region",
                "type": "multi-select",
                "label": "Region",
                "column": "region",
                "table": "transactions",
                "options": ["APAC", "EMEA", "NAM", "LATAM"]
            }
        ],
    },
    # ==================== DASHBOARD 4: Reconciliation Status ====================
    # Showcases: Funnel, radial bar, gauge, heatmap, processing flow
    {
        "id": "dashboard-recon",
        "name": "Reconciliation Status",
        "description": "Source system reconciliation and matching overview with processing funnel.",
        "layout": {
            "columns": 12,
            "widgets": [
                # Row 1: KPIs and gauge
                {"id": "w1", "type": "chart", "x": 0, "y": 0, "cols": 4, "rows": 4, "title": "Match Rate Gauge", "chartId": "chart-gauge-match-rate", "chartType": "gauge"},
                {"id": "w2", "type": "chart", "x": 4, "y": 0, "cols": 4, "rows": 4, "title": "Status Breakdown", "chartId": "chart-donut-status", "chartType": "donut"},
                {"id": "w3", "type": "chart", "x": 8, "y": 0, "cols": 2, "rows": 4, "title": "Total Transactions", "chartId": "chart-kpi-total-txns", "chartType": "kpiCard"},
                {"id": "w4", "type": "chart", "x": 10, "y": 0, "cols": 2, "rows": 4, "title": "Match Rate", "chartId": "chart-kpi-match-rate-trend", "chartType": "kpiCard"},
                # Row 2: Funnel + Radial bar
                {"id": "w5", "type": "chart", "x": 0, "y": 4, "cols": 6, "rows": 6, "title": "Processing Funnel", "chartId": "chart-funnel-processing", "chartType": "funnel"},
                {"id": "w6", "type": "chart", "x": 6, "y": 4, "cols": 6, "rows": 6, "title": "System Match Rates", "chartId": "chart-radial-system-match", "chartType": "radialBar"},
                # Row 3: Source system analysis + heatmap
                {"id": "w7", "type": "chart", "x": 0, "y": 10, "cols": 6, "rows": 5, "title": "Volume by Source System", "chartId": "chart-bar-system-volume", "chartType": "bar"},
                {"id": "w8", "type": "chart", "x": 6, "y": 10, "cols": 6, "rows": 5, "title": "System vs Status Heatmap", "chartId": "chart-heatmap-system-status", "chartType": "heatmap"},
                # Row 4: LOB analysis
                {"id": "w9", "type": "chart", "x": 0, "y": 15, "cols": 6, "rows": 5, "title": "LOB Match Rates", "chartId": "chart-radial-lob-match", "chartType": "radialBar"},
                {"id": "w10", "type": "chart", "x": 6, "y": 15, "cols": 6, "rows": 5, "title": "Region vs LOB Heatmap", "chartId": "chart-heatmap-region-lob", "chartType": "heatmap"},
                # Row 5: Table
                {"id": "w11", "type": "table", "x": 0, "y": 20, "cols": 12, "rows": 5, "title": "Unmatched Transactions", "queryId": "query-table-unmatched"},
            ]
        },
        "filters": [
            {
                "id": "filter-system",
                "type": "multi-select",
                "label": "Source System",
                "column": "source_system",
                "table": "transactions",
                "options": ["System A", "System B", "System C", "System D"]
            },
            {
                "id": "filter-recon-status",
                "type": "select",
                "label": "Status",
                "column": "status",
                "table": "transactions",
                "options": ["matched", "unmatched", "break"]
            }
        ],
    },
    # ==================== DASHBOARD 5: Trend Analytics ====================
    # Showcases: Line, area, scatter charts, trend analysis, KPIs with trends
    {
        "id": "dashboard-trends",
        "name": "Trend Analytics",
        "description": "Historical trends and time-series analysis with trend indicators.",
        "layout": {
            "columns": 12,
            "widgets": [
                # Row 1: KPIs with trend indicators
                {"id": "w1", "type": "chart", "x": 0, "y": 0, "cols": 3, "rows": 4, "title": "Daily Volume", "chartId": "chart-kpi-daily-volume-trend", "chartType": "kpiCard"},
                {"id": "w2", "type": "chart", "x": 3, "y": 0, "cols": 3, "rows": 4, "title": "Match Rate", "chartId": "chart-kpi-match-rate-trend", "chartType": "kpiCard"},
                {"id": "w3", "type": "chart", "x": 6, "y": 0, "cols": 3, "rows": 4, "title": "Daily Breaks", "chartId": "chart-kpi-daily-breaks-trend", "chartType": "kpiCard"},
                {"id": "w4", "type": "chart", "x": 9, "y": 0, "cols": 3, "rows": 4, "title": "Avg Break Age", "chartId": "chart-kpi-avg-break-age", "chartType": "kpiCard"},
                # Row 2: Main trend charts
                {"id": "w5", "type": "chart", "x": 0, "y": 4, "cols": 8, "rows": 5, "title": "Daily Transaction Trend", "chartId": "chart-line-daily-trend", "chartType": "line"},
                {"id": "w6", "type": "chart", "x": 8, "y": 4, "cols": 4, "rows": 5, "title": "Volume vs Breaks", "chartId": "chart-scatter-volume-breaks", "chartType": "scatter"},
                # Row 3: More trends
                {"id": "w7", "type": "chart", "x": 0, "y": 9, "cols": 6, "rows": 5, "title": "Matched Transactions Trend", "chartId": "chart-area-matched", "chartType": "area"},
                {"id": "w8", "type": "chart", "x": 6, "y": 9, "cols": 6, "rows": 5, "title": "Daily Breaks Trend", "chartId": "chart-line-breaks-trend", "chartType": "line"},
                # Row 4: Weekly + Match rate
                {"id": "w9", "type": "chart", "x": 0, "y": 14, "cols": 6, "rows": 5, "title": "Weekly Transaction Volume", "chartId": "chart-line-weekly-trend", "chartType": "line"},
                {"id": "w10", "type": "chart", "x": 6, "y": 14, "cols": 6, "rows": 5, "title": "Daily Match Rate Trend", "chartId": "chart-line-match-rate", "chartType": "line"},
                # Row 5: Table
                {"id": "w11", "type": "table", "x": 0, "y": 19, "cols": 12, "rows": 5, "title": "Daily Metrics History", "queryId": "query-table-daily-metrics"},
            ]
        },
        "filters": [
            {
                "id": "filter-date-range",
                "type": "date-range",
                "label": "Date Range",
                "column": "date",
                "table": "daily_metrics"
            }
        ],
    },
    # ==================== DASHBOARD 6: Chart Gallery ====================
    # Showcases: ALL chart types in one place for demo purposes
    {
        "id": "dashboard-chart-gallery",
        "name": "Chart Gallery",
        "description": "Showcase of all available chart types. Perfect for exploring visualization options.",
        "layout": {
            "columns": 12,
            "widgets": [
                # Row 1: KPI cards
                {"id": "w1", "type": "chart", "x": 0, "y": 0, "cols": 2, "rows": 3, "title": "KPI (Count)", "chartId": "chart-kpi-total-txns", "chartType": "kpiCard"},
                {"id": "w2", "type": "chart", "x": 2, "y": 0, "cols": 2, "rows": 3, "title": "KPI (Currency)", "chartId": "chart-kpi-total-volume", "chartType": "kpiCard"},
                {"id": "w3", "type": "chart", "x": 4, "y": 0, "cols": 2, "rows": 3, "title": "KPI (Percent)", "chartId": "chart-kpi-match-rate", "chartType": "kpiCard"},
                {"id": "w4", "type": "chart", "x": 6, "y": 0, "cols": 2, "rows": 3, "title": "KPI (Trend)", "chartId": "chart-kpi-daily-volume-trend", "chartType": "kpiCard"},
                {"id": "w5", "type": "chart", "x": 8, "y": 0, "cols": 4, "rows": 3, "title": "Gauge", "chartId": "chart-gauge-match-rate", "chartType": "gauge"},
                # Row 2: Bar, Column, Line, Area
                {"id": "w6", "type": "chart", "x": 0, "y": 3, "cols": 3, "rows": 4, "title": "Bar Chart", "chartId": "chart-bar-region-volume", "chartType": "bar"},
                {"id": "w7", "type": "chart", "x": 3, "y": 3, "cols": 3, "rows": 4, "title": "Column Chart", "chartId": "chart-column-lob-volume", "chartType": "column"},
                {"id": "w8", "type": "chart", "x": 6, "y": 3, "cols": 3, "rows": 4, "title": "Line Chart", "chartId": "chart-line-daily-trend", "chartType": "line"},
                {"id": "w9", "type": "chart", "x": 9, "y": 3, "cols": 3, "rows": 4, "title": "Area Chart", "chartId": "chart-area-matched", "chartType": "area"},
                # Row 3: Pie, Donut, Scatter, Funnel
                {"id": "w10", "type": "chart", "x": 0, "y": 7, "cols": 3, "rows": 4, "title": "Pie Chart", "chartId": "chart-pie-status", "chartType": "pie"},
                {"id": "w11", "type": "chart", "x": 3, "y": 7, "cols": 3, "rows": 4, "title": "Donut Chart", "chartId": "chart-donut-breaks-category", "chartType": "donut"},
                {"id": "w12", "type": "chart", "x": 6, "y": 7, "cols": 3, "rows": 4, "title": "Scatter Chart", "chartId": "chart-scatter-amount-age", "chartType": "scatter"},
                {"id": "w13", "type": "chart", "x": 9, "y": 7, "cols": 3, "rows": 4, "title": "Funnel Chart", "chartId": "chart-funnel-processing", "chartType": "funnel"},
                # Row 4: Treemap, Radar, Radial Bar, Heatmap
                {"id": "w14", "type": "chart", "x": 0, "y": 11, "cols": 3, "rows": 4, "title": "Treemap", "chartId": "chart-treemap-region", "chartType": "treemap"},
                {"id": "w15", "type": "chart", "x": 3, "y": 11, "cols": 3, "rows": 4, "title": "Radar Chart", "chartId": "chart-radar-region", "chartType": "radar"},
                {"id": "w16", "type": "chart", "x": 6, "y": 11, "cols": 3, "rows": 4, "title": "Radial Bar", "chartId": "chart-radial-lob-match", "chartType": "radialBar"},
                {"id": "w17", "type": "chart", "x": 9, "y": 11, "cols": 3, "rows": 4, "title": "Heatmap", "chartId": "chart-heatmap-region-lob", "chartType": "heatmap"},
            ]
        },
        "filters": None,
    },
]


# ============================================================================
# DEFAULT COLLECTIONS
# ============================================================================

DEFAULT_COLLECTIONS = [
    {
        "id": "coll-executive-reports",
        "name": "Executive Reports",
        "description": "High-level dashboards and KPIs for executive stakeholders",
        "color": "#3B82F6",
    },
    {
        "id": "coll-operational",
        "name": "Operational",
        "description": "Day-to-day operational dashboards and monitoring",
        "color": "#10B981",
    },
    {
        "id": "coll-analysis",
        "name": "Analysis",
        "description": "Deep-dive analytical charts and queries",
        "color": "#F59E0B",
    },
    {
        "id": "coll-kpi-showcase",
        "name": "KPI Showcase",
        "description": "KPI Cards demonstrating all aggregation and formatting options",
        "color": "#8B5CF6",
    },
]

# Map collections to items
COLLECTION_ITEMS_MAP = {
    "coll-executive-reports": [
        {"item_id": "dashboard-executive", "item_type": "dashboard"},
        {"item_id": "dashboard-trends", "item_type": "dashboard"},
        {"item_id": "chart-kpi-total-txns", "item_type": "chart"},
        {"item_id": "chart-kpi-total-volume", "item_type": "chart"},
        {"item_id": "chart-gauge-match-rate", "item_type": "chart"},
        {"item_id": "chart-line-daily-trend", "item_type": "chart"},
    ],
    "coll-operational": [
        {"item_id": "dashboard-breaks", "item_type": "dashboard"},
        {"item_id": "dashboard-recon", "item_type": "dashboard"},
        {"item_id": "chart-bar-breaks-reason", "item_type": "chart"},
        {"item_id": "chart-bar-system-volume", "item_type": "chart"},
        {"item_id": "chart-funnel-processing", "item_type": "chart"},
        {"item_id": "query-table-critical-breaks", "item_type": "query"},
    ],
    "coll-analysis": [
        {"item_id": "dashboard-geographic", "item_type": "dashboard"},
        {"item_id": "dashboard-chart-gallery", "item_type": "dashboard"},
        {"item_id": "chart-scatter-amount-age", "item_type": "chart"},
        {"item_id": "chart-radar-region", "item_type": "chart"},
        {"item_id": "chart-heatmap-region-lob", "item_type": "chart"},
        {"item_id": "chart-treemap-region", "item_type": "chart"},
        {"item_id": "query-bar-country-top", "item_type": "query"},
    ],
    "coll-kpi-showcase": [
        {"item_id": "chart-kpi-total-txns", "item_type": "chart"},
        {"item_id": "chart-kpi-total-volume", "item_type": "chart"},
        {"item_id": "chart-kpi-match-rate", "item_type": "chart"},
        {"item_id": "chart-kpi-open-breaks", "item_type": "chart"},
        {"item_id": "chart-kpi-break-amount", "item_type": "chart"},
        {"item_id": "chart-kpi-avg-break-age", "item_type": "chart"},
        {"item_id": "chart-kpi-max-break-age", "item_type": "chart"},
        {"item_id": "chart-kpi-critical-breaks", "item_type": "chart"},
        {"item_id": "chart-kpi-avg-txn-amount", "item_type": "chart"},
        {"item_id": "chart-kpi-daily-volume-trend", "item_type": "chart"},
        {"item_id": "chart-kpi-daily-breaks-trend", "item_type": "chart"},
        {"item_id": "chart-kpi-match-rate-trend", "item_type": "chart"},
    ],
}


async def check_collections_exist(session: AsyncSession) -> bool:
    """Check if collections already exist."""
    result = await session.execute(select(func.count()).select_from(Collection))
    count = result.scalar()
    return count is not None and count > 0


async def seed_default_collections(session: AsyncSession) -> None:
    """Seed default collections and link items to them."""
    exists = await check_collections_exist(session)
    if exists:
        logger.info("Collections already exist. Skipping collection seed.")
        return

    logger.info("=" * 60)
    logger.info("Seeding default collections...")
    logger.info("=" * 60)

    # Create collections
    for coll_data in DEFAULT_COLLECTIONS:
        collection = Collection(
            id=coll_data["id"],
            name=coll_data["name"],
            description=coll_data["description"],
            color=coll_data["color"],
        )
        session.add(collection)
    await session.flush()

    # Add items to collections
    item_count = 0
    for collection_id, items in COLLECTION_ITEMS_MAP.items():
        for item_data in items:
            collection_item = CollectionItem(
                id=str(uuid4()),
                collection_id=collection_id,
                item_id=item_data["item_id"],
                item_type=item_data["item_type"],
            )
            session.add(collection_item)
            item_count += 1
    await session.flush()

    await session.commit()

    logger.info("=" * 60)
    logger.info("Collections seeding complete!")
    logger.info(f"  - Collections: {len(DEFAULT_COLLECTIONS)}")
    logger.info(f"  - Collection Items: {item_count}")
    logger.info("=" * 60)


async def check_dashboards_exist(session: AsyncSession) -> bool:
    """Check if sample dashboards already exist."""
    result = await session.execute(select(func.count()).select_from(Dashboard))
    count = result.scalar()
    return count is not None and count > 0


async def seed_sample_dashboards(session: AsyncSession) -> None:
    """Seed sample queries, charts, and dashboards."""
    # First, seed the default data source
    data_source_id = await seed_default_data_source(session)

    exists = await check_dashboards_exist(session)
    if exists:
        logger.info("Sample dashboards already exist. Skipping dashboard seed.")
        return

    logger.info("=" * 60)
    logger.info("Seeding sample dashboards...")
    logger.info("=" * 60)

    # Seed queries (linked to the default data source)
    logger.info(f"Creating {len(SAMPLE_QUERIES)} sample queries...")
    for q in SAMPLE_QUERIES:
        query = Query(
            id=q["id"],
            name=q["name"],
            description=q.get("description"),
            sql_text=q["sql_text"],
            data_source_id=data_source_id,  # Link to default SQLite data source
        )
        session.add(query)
    await session.flush()

    # Seed charts
    logger.info(f"Creating {len(SAMPLE_CHARTS)} sample charts...")
    for c in SAMPLE_CHARTS:
        chart = Chart(
            id=c["id"],
            name=c["name"],
            description=c.get("description"),
            query_id=c["query_id"],
            chart_type=c["chart_type"],
            config=json.dumps(c["config"]),
        )
        session.add(chart)
    await session.flush()

    # Seed dashboards
    logger.info(f"Creating {len(SAMPLE_DASHBOARDS)} sample dashboards...")
    for d in SAMPLE_DASHBOARDS:
        dashboard = Dashboard(
            id=d["id"],
            name=d["name"],
            description=d.get("description"),
            layout=json.dumps(d["layout"]),
            filters=json.dumps(d["filters"]) if d.get("filters") else None,
        )
        session.add(dashboard)
    await session.flush()

    await session.commit()

    logger.info("=" * 60)
    logger.info("Sample dashboards seeding complete!")
    logger.info(f"  - Queries: {len(SAMPLE_QUERIES)}")
    logger.info(f"  - Charts: {len(SAMPLE_CHARTS)}")
    logger.info(f"  - Dashboards: {len(SAMPLE_DASHBOARDS)}")
    logger.info("=" * 60)

    # Seed default collections
    await seed_default_collections(session)
