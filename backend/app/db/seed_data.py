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
    # Executive Overview queries
    {
        "id": "query-exec-total-txns",
        "name": "Total Transactions",
        "description": "Count of all transactions",
        "sql_text": "SELECT COUNT(*) as value FROM transactions",
    },
    {
        "id": "query-exec-match-rate",
        "name": "Match Rate",
        "description": "Percentage of matched transactions",
        "sql_text": "SELECT ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value FROM transactions",
    },
    {
        "id": "query-exec-open-breaks",
        "name": "Open Breaks",
        "description": "Count of open breaks",
        "sql_text": "SELECT COUNT(*) as value FROM breaks",
    },
    {
        "id": "query-exec-avg-age",
        "name": "Average Break Age",
        "description": "Average age of breaks in days",
        "sql_text": "SELECT ROUND(AVG(age_days), 1) as value FROM breaks",
    },
    {
        "id": "query-exec-daily-trend",
        "name": "Daily Transaction Trend",
        "description": "Daily transaction volumes for the last 30 days",
        "sql_text": "SELECT date as category, total_transactions as value FROM daily_metrics ORDER BY date ASC LIMIT 30",
    },
    {
        "id": "query-exec-region-volume",
        "name": "Volume by Region",
        "description": "Transaction count by region",
        "sql_text": "SELECT region as category, COUNT(*) as value FROM transactions GROUP BY region ORDER BY value DESC",
    },
    {
        "id": "query-exec-status-pie",
        "name": "Status Distribution",
        "description": "Transaction count by status",
        "sql_text": "SELECT status as category, COUNT(*) as value FROM transactions GROUP BY status ORDER BY value DESC",
    },
    # Breaks Analysis queries
    {
        "id": "query-breaks-by-reason",
        "name": "Breaks by Reason",
        "description": "Break count by reason",
        "sql_text": "SELECT reason as category, COUNT(*) as value FROM breaks GROUP BY reason ORDER BY value DESC LIMIT 10",
    },
    {
        "id": "query-breaks-by-category",
        "name": "Breaks by Category",
        "description": "Break count by severity category",
        "sql_text": "SELECT category, COUNT(*) as value FROM breaks GROUP BY category ORDER BY CASE category WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END",
    },
    {
        "id": "query-breaks-by-lob",
        "name": "Breaks by LOB",
        "description": "Break count by line of business",
        "sql_text": "SELECT lob as category, COUNT(*) as value FROM breaks GROUP BY lob ORDER BY value DESC",
    },
    {
        "id": "query-breaks-aging",
        "name": "Breaks by Age Bucket",
        "description": "Breaks grouped by age",
        "sql_text": """SELECT
            CASE
                WHEN age_days <= 1 THEN '0-1 days'
                WHEN age_days <= 5 THEN '2-5 days'
                WHEN age_days <= 10 THEN '6-10 days'
                WHEN age_days <= 20 THEN '11-20 days'
                ELSE '20+ days'
            END as category,
            COUNT(*) as value
        FROM breaks
        GROUP BY 1
        ORDER BY MIN(age_days)""",
    },
    {
        "id": "query-breaks-critical",
        "name": "Critical Breaks Count",
        "description": "Number of critical priority breaks",
        "sql_text": "SELECT COUNT(*) as value FROM breaks WHERE category = 'Critical'",
    },
    # Geographic queries
    {
        "id": "query-geo-region-bar",
        "name": "Transactions by Region",
        "description": "Transaction distribution by region",
        "sql_text": "SELECT region as category, COUNT(*) as value FROM transactions GROUP BY region ORDER BY value DESC",
    },
    {
        "id": "query-geo-country-top",
        "name": "Top Countries",
        "description": "Top 10 countries by transaction volume",
        "sql_text": "SELECT country as category, COUNT(*) as value FROM transactions GROUP BY country ORDER BY value DESC LIMIT 10",
    },
    {
        "id": "query-geo-apac",
        "name": "APAC Transactions",
        "description": "Count of APAC transactions",
        "sql_text": "SELECT COUNT(*) as value FROM transactions WHERE region = 'APAC'",
    },
    {
        "id": "query-geo-emea",
        "name": "EMEA Transactions",
        "description": "Count of EMEA transactions",
        "sql_text": "SELECT COUNT(*) as value FROM transactions WHERE region = 'EMEA'",
    },
    # Recon Status queries
    {
        "id": "query-recon-by-system",
        "name": "Transactions by Source System",
        "description": "Transaction distribution by source system",
        "sql_text": "SELECT source_system as category, COUNT(*) as value FROM transactions GROUP BY source_system ORDER BY value DESC",
    },
    {
        "id": "query-recon-match-by-system",
        "name": "Match Rate by System",
        "description": "Match rate for each source system",
        "sql_text": """SELECT source_system as category,
            ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value
        FROM transactions GROUP BY source_system ORDER BY value DESC""",
    },
    {
        "id": "query-recon-unmatched",
        "name": "Unmatched Transactions",
        "description": "Count of unmatched transactions",
        "sql_text": "SELECT COUNT(*) as value FROM transactions WHERE status = 'unmatched'",
    },
    # Trend Analytics queries
    {
        "id": "query-trend-weekly",
        "name": "Weekly Transaction Trend",
        "description": "Weekly aggregated transaction volumes",
        "sql_text": """SELECT
            strftime('%Y-W%W', date) as category,
            SUM(total_transactions) as value
        FROM daily_metrics
        GROUP BY 1
        ORDER BY 1 ASC
        LIMIT 12""",
    },
    {
        "id": "query-trend-match-rate",
        "name": "Daily Match Rate Trend",
        "description": "Match rate over the last 30 days",
        "sql_text": "SELECT date as category, match_rate as value FROM daily_metrics ORDER BY date ASC LIMIT 30",
    },
    {
        "id": "query-trend-breaks",
        "name": "Daily Breaks Trend",
        "description": "Daily break count over the last 30 days",
        "sql_text": "SELECT date as category, breaks as value FROM daily_metrics ORDER BY date ASC LIMIT 30",
    },
    # Area chart query - Match vs Unmatched over time
    {
        "id": "query-area-matched-unmatched",
        "name": "Matched vs Unmatched Trend",
        "description": "Daily matched and unmatched transactions",
        "sql_text": "SELECT date as category, matched as value FROM daily_metrics ORDER BY date ASC LIMIT 30",
    },
    # Scatter chart query - Amount vs Age correlation
    {
        "id": "query-scatter-amount-age",
        "name": "Break Amount vs Age",
        "description": "Scatter plot of break amounts vs age in days",
        "sql_text": "SELECT age_days as x, amount as y FROM breaks LIMIT 500",
    },
    # Radar chart query - Performance by region
    {
        "id": "query-radar-region-metrics",
        "name": "Regional Performance Metrics",
        "description": "Multi-dimensional metrics by region",
        "sql_text": """SELECT
            region as category,
            COUNT(*) as volume,
            ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as match_rate,
            ROUND(AVG(amount), 0) as avg_amount
        FROM transactions GROUP BY region""",
    },
    # Funnel chart query - Transaction processing stages
    {
        "id": "query-funnel-processing",
        "name": "Transaction Processing Funnel",
        "description": "Transaction flow through processing stages",
        "sql_text": """SELECT 'Total Received' as category, COUNT(*) as value FROM transactions
        UNION ALL
        SELECT 'Validated' as category, CAST(COUNT(*) * 0.95 AS INTEGER) as value FROM transactions
        UNION ALL
        SELECT 'Matched' as category, COUNT(*) as value FROM transactions WHERE status = 'matched'
        UNION ALL
        SELECT 'Settled' as category, CAST(COUNT(*) * 0.80 AS INTEGER) as value FROM transactions WHERE status = 'matched'
        ORDER BY value DESC""",
    },
    # Treemap query - Hierarchy by region and LOB
    {
        "id": "query-treemap-region-lob",
        "name": "Volume by Region and LOB",
        "description": "Hierarchical breakdown by region",
        "sql_text": "SELECT region as category, COUNT(*) as value FROM transactions GROUP BY region ORDER BY value DESC",
    },
    # Radial bar query - LOB match rates
    {
        "id": "query-radialbar-lob-match",
        "name": "LOB Match Rates",
        "description": "Match rate percentage by line of business",
        "sql_text": """SELECT lob as category,
            ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value
        FROM transactions GROUP BY lob ORDER BY value DESC""",
    },
    # Currency distribution
    {
        "id": "query-currency-dist",
        "name": "Volume by Currency",
        "description": "Transaction count by currency",
        "sql_text": "SELECT currency as category, COUNT(*) as value FROM transactions GROUP BY currency ORDER BY value DESC LIMIT 7",
    },
    # Top counterparties
    {
        "id": "query-top-counterparties",
        "name": "Top Counterparties",
        "description": "Top 10 counterparties by volume",
        "sql_text": "SELECT counterparty as category, COUNT(*) as value FROM transactions GROUP BY counterparty ORDER BY value DESC LIMIT 10",
    },
    # Breaks by assignee
    {
        "id": "query-breaks-by-assignee",
        "name": "Breaks by Assignee",
        "description": "Break count by assigned person",
        "sql_text": "SELECT assigned_to as category, COUNT(*) as value FROM breaks GROUP BY assigned_to ORDER BY value DESC",
    },
    # Daily volume and break rate correlation
    {
        "id": "query-volume-breakrate",
        "name": "Volume vs Break Rate",
        "description": "Daily volume and corresponding break count",
        "sql_text": "SELECT total_transactions as x, breaks as y FROM daily_metrics ORDER BY date DESC LIMIT 30",
    },
    # ==================== TABLE QUERIES ====================
    {
        "id": "query-table-recent-txns",
        "name": "Recent Transactions",
        "description": "Latest transactions for table display",
        "sql_text": "SELECT id, date, amount, currency, region, lob, source_system, status FROM transactions ORDER BY date DESC LIMIT 50",
    },
    {
        "id": "query-table-critical-breaks",
        "name": "Critical & High Priority Breaks",
        "description": "High priority breaks requiring attention",
        "sql_text": "SELECT id, reason, category, amount, age_days, assigned_to, region, lob FROM breaks WHERE category IN ('Critical', 'High') ORDER BY CASE category WHEN 'Critical' THEN 1 ELSE 2 END, age_days DESC LIMIT 50",
    },
    {
        "id": "query-table-unmatched-txns",
        "name": "Unmatched Transactions",
        "description": "Transactions with unmatched or break status",
        "sql_text": "SELECT id, date, amount, currency, region, lob, source_system, counterparty, status FROM transactions WHERE status IN ('unmatched', 'break') ORDER BY date DESC LIMIT 50",
    },
    {
        "id": "query-table-daily-metrics",
        "name": "Daily Metrics History",
        "description": "Historical daily metrics",
        "sql_text": "SELECT date, total_transactions, matched, unmatched, breaks, match_rate, avg_break_age FROM daily_metrics ORDER BY date DESC LIMIT 30",
    },
    {
        "id": "query-table-top-countries",
        "name": "Top Countries Summary",
        "description": "Country-level transaction summary",
        "sql_text": "SELECT country, region, COUNT(*) as transactions, ROUND(AVG(amount), 2) as avg_amount, COUNT(DISTINCT counterparty) as counterparties FROM transactions GROUP BY country, region ORDER BY transactions DESC LIMIT 20",
    },
    {
        "id": "query-table-all-breaks",
        "name": "All Breaks",
        "description": "Complete breaks listing",
        "sql_text": "SELECT id, reason, category, amount, age_days, assigned_to, region, lob, created_date FROM breaks ORDER BY created_date DESC LIMIT 100",
    },
]

SAMPLE_CHARTS = [
    # ==================== LINE CHARTS ====================
    {
        "id": "chart-exec-daily-trend",
        "name": "Daily Transaction Trend",
        "description": "30-day transaction volume trend",
        "query_id": "query-exec-daily-trend",
        "chart_type": "line",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": False},
    },
    {
        "id": "chart-trend-weekly",
        "name": "Weekly Transaction Volume",
        "description": "Weekly aggregated volumes",
        "query_id": "query-trend-weekly",
        "chart_type": "line",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "ocean", "showLabels": False},
    },
    {
        "id": "chart-trend-match-rate",
        "name": "Daily Match Rate",
        "description": "Match rate trend over 30 days",
        "query_id": "query-trend-match-rate",
        "chart_type": "line",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "emerald", "showLabels": False},
    },
    {
        "id": "chart-trend-breaks",
        "name": "Daily Breaks Trend",
        "description": "Break count over time",
        "query_id": "query-trend-breaks",
        "chart_type": "line",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "sunset", "showLabels": False},
    },
    # ==================== AREA CHARTS ====================
    {
        "id": "chart-area-matched",
        "name": "Matched Transactions Trend",
        "description": "Daily matched transaction volume as area chart",
        "query_id": "query-area-matched-unmatched",
        "chart_type": "area",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "emerald", "showLabels": False},
    },
    # ==================== BAR CHARTS ====================
    {
        "id": "chart-exec-region-bar",
        "name": "Volume by Region",
        "description": "Transaction distribution across regions",
        "query_id": "query-exec-region-volume",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-breaks-by-reason",
        "name": "Breaks by Reason",
        "description": "Top 10 break reasons",
        "query_id": "query-breaks-by-reason",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "sunset", "showLabels": True},
    },
    {
        "id": "chart-breaks-by-lob",
        "name": "Breaks by LOB",
        "description": "Break distribution by line of business",
        "query_id": "query-breaks-by-lob",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "lavender", "showLabels": True},
    },
    {
        "id": "chart-breaks-aging",
        "name": "Break Aging Analysis",
        "description": "Breaks grouped by age buckets",
        "query_id": "query-breaks-aging",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "sunset", "showLabels": True},
    },
    {
        "id": "chart-geo-region",
        "name": "Transactions by Region",
        "description": "Regional transaction volumes",
        "query_id": "query-geo-region-bar",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "ocean", "showLabels": True},
    },
    {
        "id": "chart-geo-country-top",
        "name": "Top 10 Countries",
        "description": "Countries with highest transaction volumes",
        "query_id": "query-geo-country-top",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-recon-by-system",
        "name": "Volume by Source System",
        "description": "Transaction distribution by source system",
        "query_id": "query-recon-by-system",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "lavender", "showLabels": True},
    },
    {
        "id": "chart-recon-match-rate",
        "name": "Match Rate by System",
        "description": "Match rate comparison across systems",
        "query_id": "query-recon-match-by-system",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "emerald", "showLabels": True},
    },
    {
        "id": "chart-currency-dist",
        "name": "Volume by Currency",
        "description": "Transaction distribution by currency",
        "query_id": "query-currency-dist",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "ocean", "showLabels": True},
    },
    {
        "id": "chart-top-counterparties",
        "name": "Top Counterparties",
        "description": "Most active counterparties",
        "query_id": "query-top-counterparties",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-breaks-by-assignee",
        "name": "Breaks by Assignee",
        "description": "Break workload distribution",
        "query_id": "query-breaks-by-assignee",
        "chart_type": "bar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "lavender", "showLabels": True},
    },
    # ==================== PIE CHARTS ====================
    {
        "id": "chart-status-pie",
        "name": "Status Distribution (Pie)",
        "description": "Transaction status breakdown as pie chart",
        "query_id": "query-exec-status-pie",
        "chart_type": "pie",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-region-pie",
        "name": "Regional Distribution (Pie)",
        "description": "Transaction share by region",
        "query_id": "query-geo-region-bar",
        "chart_type": "pie",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "ocean", "showLabels": True},
    },
    # ==================== DONUT CHARTS ====================
    {
        "id": "chart-exec-status-donut",
        "name": "Status Distribution",
        "description": "Transaction status as donut chart",
        "query_id": "query-exec-status-pie",
        "chart_type": "donut",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-breaks-by-category",
        "name": "Breaks by Category",
        "description": "Severity distribution of breaks",
        "query_id": "query-breaks-by-category",
        "chart_type": "donut",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "sunset", "showLabels": True},
    },
    {
        "id": "chart-lob-donut",
        "name": "LOB Distribution",
        "description": "Transaction share by line of business",
        "query_id": "query-breaks-by-lob",
        "chart_type": "donut",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "lavender", "showLabels": True},
    },
    # ==================== GAUGE CHARTS ====================
    {
        "id": "chart-exec-match-gauge",
        "name": "Match Rate Gauge",
        "description": "Overall match rate as gauge",
        "query_id": "query-exec-match-rate",
        "chart_type": "gauge",
        "config": {"yAxis": "value", "colorScheme": "emerald", "title": "Match Rate"},
    },
    # ==================== SCATTER CHARTS ====================
    {
        "id": "chart-scatter-amount-age",
        "name": "Amount vs Age Scatter",
        "description": "Correlation between break amount and age",
        "query_id": "query-scatter-amount-age",
        "chart_type": "scatter",
        "config": {"xAxis": "x", "yAxis": "y", "colorScheme": "sunset", "showLabels": False},
    },
    {
        "id": "chart-scatter-volume-breaks",
        "name": "Volume vs Breaks",
        "description": "Correlation between daily volume and breaks",
        "query_id": "query-volume-breakrate",
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
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "ocean", "showLabels": True},
    },
    # ==================== TREEMAP CHARTS ====================
    {
        "id": "chart-treemap-region",
        "name": "Regional Treemap",
        "description": "Volume distribution as treemap",
        "query_id": "query-treemap-region-lob",
        "chart_type": "treemap",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "citi", "showLabels": True},
    },
    {
        "id": "chart-treemap-country",
        "name": "Country Treemap",
        "description": "Top countries as treemap",
        "query_id": "query-geo-country-top",
        "chart_type": "treemap",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "ocean", "showLabels": True},
    },
    # ==================== RADIAL BAR CHARTS ====================
    {
        "id": "chart-radialbar-lob",
        "name": "LOB Match Rates",
        "description": "Match rate by LOB as radial bar",
        "query_id": "query-radialbar-lob-match",
        "chart_type": "radialBar",
        "config": {"xAxis": "category", "yAxis": "value", "colorScheme": "emerald", "showLabels": True},
    },
    {
        "id": "chart-radialbar-system",
        "name": "System Match Rates",
        "description": "Match rate by system as radial bar",
        "query_id": "query-recon-match-by-system",
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
        "config": {"xAxis": "category", "yAxis": "volume", "colorScheme": "lavender", "showLabels": True},
    },
    # ==================== KPI CARDS ====================
    {
        "id": "chart-kpi-total-txns",
        "name": "Total Transactions KPI",
        "description": "Total transaction count as KPI card",
        "query_id": "query-exec-total-txns",
        "chart_type": "kpiCard",
        "config": {"yAxis": "value", "colorScheme": "citi", "title": "Total Transactions"},
    },
    {
        "id": "chart-kpi-open-breaks",
        "name": "Open Breaks KPI",
        "description": "Open breaks count as KPI card",
        "query_id": "query-exec-open-breaks",
        "chart_type": "kpiCard",
        "config": {"yAxis": "value", "colorScheme": "sunset", "title": "Open Breaks"},
    },
    {
        "id": "chart-kpi-avg-age",
        "name": "Avg Break Age KPI",
        "description": "Average break age as KPI card",
        "query_id": "query-exec-avg-age",
        "chart_type": "kpiCard",
        "config": {"yAxis": "value", "colorScheme": "ocean", "title": "Avg Break Age", "suffix": " days"},
    },
    {
        "id": "chart-kpi-critical-breaks",
        "name": "Critical Breaks KPI",
        "description": "Critical breaks count",
        "query_id": "query-breaks-critical",
        "chart_type": "kpiCard",
        "config": {"yAxis": "value", "colorScheme": "sunset", "title": "Critical Breaks"},
    },
    {
        "id": "chart-gauge-match-rate",
        "name": "Match Rate Gauge",
        "description": "Overall match rate percentage",
        "query_id": "query-exec-match-rate",
        "chart_type": "gauge",
        "config": {"yAxis": "value", "colorScheme": "emerald", "title": "Match Rate"},
    },
]

SAMPLE_DASHBOARDS = [
    {
        "id": "dashboard-executive",
        "name": "Executive Overview",
        "description": "High-level KPIs and trends for executive stakeholders",
        "layout": {
            "columns": 12,
            "widgets": [
                {"id": "w1", "type": "chart", "x": 0, "y": 0, "cols": 3, "rows": 3, "title": "Total Transactions", "chartId": "chart-kpi-total-txns", "chartType": "kpiCard"},
                {"id": "w2", "type": "chart", "x": 3, "y": 0, "cols": 3, "rows": 3, "title": "Match Rate", "chartId": "chart-gauge-match-rate", "chartType": "gauge"},
                {"id": "w3", "type": "chart", "x": 6, "y": 0, "cols": 3, "rows": 3, "title": "Open Breaks", "chartId": "chart-kpi-open-breaks", "chartType": "kpiCard"},
                {"id": "w4", "type": "chart", "x": 9, "y": 0, "cols": 3, "rows": 3, "title": "Avg Break Age", "chartId": "chart-kpi-avg-age", "chartType": "kpiCard"},
                {"id": "w5", "type": "chart", "x": 0, "y": 3, "cols": 8, "rows": 4, "title": "Daily Transaction Trend", "chartId": "chart-exec-daily-trend", "chartType": "line"},
                {"id": "w6", "type": "chart", "x": 8, "y": 3, "cols": 4, "rows": 4, "title": "Status Distribution", "chartId": "chart-exec-status-donut", "chartType": "donut"},
                {"id": "w7", "type": "chart", "x": 0, "y": 7, "cols": 4, "rows": 4, "title": "Volume by Region", "chartId": "chart-exec-region-bar", "chartType": "bar"},
                {"id": "w8", "type": "chart", "x": 4, "y": 7, "cols": 4, "rows": 4, "title": "LOB Match Rates", "chartId": "chart-radialbar-lob", "chartType": "radialBar"},
                {"id": "w9", "type": "chart", "x": 8, "y": 7, "cols": 4, "rows": 4, "title": "Volume by Currency", "chartId": "chart-currency-dist", "chartType": "bar"},
                {"id": "w10", "type": "table", "x": 0, "y": 11, "cols": 12, "rows": 5, "title": "Recent Transactions", "queryId": "query-table-recent-txns"},
            ]
        },
        "filters": None,
    },
    {
        "id": "dashboard-breaks",
        "name": "Break Analysis",
        "description": "Detailed analysis of reconciliation breaks and exceptions",
        "layout": {
            "columns": 12,
            "widgets": [
                {"id": "w1", "type": "chart", "x": 0, "y": 0, "cols": 3, "rows": 3, "title": "Open Breaks", "chartId": "chart-kpi-open-breaks", "chartType": "kpiCard"},
                {"id": "w2", "type": "chart", "x": 3, "y": 0, "cols": 3, "rows": 3, "title": "Critical Breaks", "chartId": "chart-kpi-critical-breaks", "chartType": "kpiCard"},
                {"id": "w3", "type": "chart", "x": 6, "y": 0, "cols": 3, "rows": 3, "title": "Avg Break Age", "chartId": "chart-kpi-avg-age", "chartType": "kpiCard"},
                {"id": "w4", "type": "chart", "x": 9, "y": 0, "cols": 3, "rows": 3, "title": "Break Categories", "chartId": "chart-breaks-by-category", "chartType": "donut"},
                {"id": "w5", "type": "chart", "x": 0, "y": 3, "cols": 6, "rows": 4, "title": "Breaks by Reason", "chartId": "chart-breaks-by-reason", "chartType": "bar"},
                {"id": "w6", "type": "chart", "x": 6, "y": 3, "cols": 6, "rows": 4, "title": "Break Aging Analysis", "chartId": "chart-breaks-aging", "chartType": "bar"},
                {"id": "w7", "type": "chart", "x": 0, "y": 7, "cols": 6, "rows": 4, "title": "Amount vs Age", "chartId": "chart-scatter-amount-age", "chartType": "scatter"},
                {"id": "w8", "type": "chart", "x": 6, "y": 7, "cols": 6, "rows": 4, "title": "Breaks by Assignee", "chartId": "chart-breaks-by-assignee", "chartType": "bar"},
                {"id": "w9", "type": "table", "x": 0, "y": 11, "cols": 12, "rows": 5, "title": "Critical & High Priority Breaks", "queryId": "query-table-critical-breaks"},
            ]
        },
        "filters": None,
    },
    {
        "id": "dashboard-geo",
        "name": "Geographic Analysis",
        "description": "Regional distribution of transactions and performance",
        "layout": {
            "columns": 12,
            "widgets": [
                {"id": "w1", "type": "chart", "x": 0, "y": 0, "cols": 6, "rows": 5, "title": "Regional Volume Treemap", "chartId": "chart-treemap-region", "chartType": "treemap"},
                {"id": "w2", "type": "chart", "x": 6, "y": 0, "cols": 6, "rows": 5, "title": "Regional Performance Radar", "chartId": "chart-radar-region", "chartType": "radar"},
                {"id": "w3", "type": "chart", "x": 0, "y": 5, "cols": 6, "rows": 4, "title": "Volume by Region", "chartId": "chart-geo-region", "chartType": "bar"},
                {"id": "w4", "type": "chart", "x": 6, "y": 5, "cols": 6, "rows": 4, "title": "Top 10 Countries", "chartId": "chart-geo-country-top", "chartType": "bar"},
                {"id": "w5", "type": "chart", "x": 0, "y": 9, "cols": 6, "rows": 4, "title": "Country Treemap", "chartId": "chart-treemap-country", "chartType": "treemap"},
                {"id": "w6", "type": "chart", "x": 6, "y": 9, "cols": 6, "rows": 4, "title": "Regional Distribution", "chartId": "chart-region-pie", "chartType": "pie"},
                {"id": "w7", "type": "table", "x": 0, "y": 13, "cols": 12, "rows": 5, "title": "Top Countries Summary", "queryId": "query-table-top-countries"},
            ]
        },
        "filters": None,
    },
    {
        "id": "dashboard-recon",
        "name": "Reconciliation Status",
        "description": "Source system reconciliation and matching overview",
        "layout": {
            "columns": 12,
            "widgets": [
                {"id": "w1", "type": "chart", "x": 0, "y": 0, "cols": 4, "rows": 3, "title": "Match Rate", "chartId": "chart-gauge-match-rate", "chartType": "gauge"},
                {"id": "w2", "type": "chart", "x": 4, "y": 0, "cols": 4, "rows": 3, "title": "Status Breakdown", "chartId": "chart-exec-status-donut", "chartType": "donut"},
                {"id": "w3", "type": "chart", "x": 8, "y": 0, "cols": 4, "rows": 3, "title": "Total Transactions", "chartId": "chart-kpi-total-txns", "chartType": "kpiCard"},
                {"id": "w4", "type": "chart", "x": 0, "y": 3, "cols": 6, "rows": 5, "title": "Processing Funnel", "chartId": "chart-funnel-processing", "chartType": "funnel"},
                {"id": "w5", "type": "chart", "x": 6, "y": 3, "cols": 6, "rows": 5, "title": "System Match Rates", "chartId": "chart-radialbar-system", "chartType": "radialBar"},
                {"id": "w6", "type": "chart", "x": 0, "y": 8, "cols": 6, "rows": 4, "title": "Volume by Source System", "chartId": "chart-recon-by-system", "chartType": "bar"},
                {"id": "w7", "type": "chart", "x": 6, "y": 8, "cols": 6, "rows": 4, "title": "Match Rate by System", "chartId": "chart-recon-match-rate", "chartType": "bar"},
                {"id": "w8", "type": "table", "x": 0, "y": 12, "cols": 12, "rows": 5, "title": "Unmatched Transactions", "queryId": "query-table-unmatched-txns"},
            ]
        },
        "filters": None,
    },
    {
        "id": "dashboard-trends",
        "name": "Trend Analytics",
        "description": "Historical trends and time-series analysis",
        "layout": {
            "columns": 12,
            "widgets": [
                {"id": "w1", "type": "chart", "x": 0, "y": 0, "cols": 4, "rows": 3, "title": "Total Transactions", "chartId": "chart-kpi-total-txns", "chartType": "kpiCard"},
                {"id": "w2", "type": "chart", "x": 4, "y": 0, "cols": 4, "rows": 3, "title": "Match Rate", "chartId": "chart-gauge-match-rate", "chartType": "gauge"},
                {"id": "w3", "type": "chart", "x": 8, "y": 0, "cols": 4, "rows": 3, "title": "Open Breaks", "chartId": "chart-kpi-open-breaks", "chartType": "kpiCard"},
                {"id": "w4", "type": "chart", "x": 0, "y": 3, "cols": 8, "rows": 4, "title": "Weekly Transaction Volume", "chartId": "chart-trend-weekly", "chartType": "line"},
                {"id": "w5", "type": "chart", "x": 8, "y": 3, "cols": 4, "rows": 4, "title": "Volume vs Breaks", "chartId": "chart-scatter-volume-breaks", "chartType": "scatter"},
                {"id": "w6", "type": "chart", "x": 0, "y": 7, "cols": 6, "rows": 4, "title": "Matched Transactions Trend", "chartId": "chart-area-matched", "chartType": "area"},
                {"id": "w7", "type": "chart", "x": 6, "y": 7, "cols": 6, "rows": 4, "title": "Daily Breaks Trend", "chartId": "chart-trend-breaks", "chartType": "line"},
                {"id": "w8", "type": "chart", "x": 0, "y": 11, "cols": 6, "rows": 4, "title": "Daily Match Rate Trend", "chartId": "chart-trend-match-rate", "chartType": "line"},
                {"id": "w9", "type": "chart", "x": 6, "y": 11, "cols": 6, "rows": 4, "title": "Top Counterparties", "chartId": "chart-top-counterparties", "chartType": "bar"},
                {"id": "w10", "type": "table", "x": 0, "y": 15, "cols": 12, "rows": 5, "title": "Daily Metrics History", "queryId": "query-table-daily-metrics"},
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
        "id": "coll-archived",
        "name": "Archived",
        "description": "Archived items for reference",
        "color": "#6B7280",
    },
]

# Map collections to items
COLLECTION_ITEMS_MAP = {
    "coll-executive-reports": [
        {"item_id": "dashboard-executive", "item_type": "dashboard"},
        {"item_id": "dashboard-trends", "item_type": "dashboard"},
        {"item_id": "chart-kpi-total-txns", "item_type": "chart"},
        {"item_id": "chart-gauge-match-rate", "item_type": "chart"},
        {"item_id": "chart-exec-daily-trend", "item_type": "chart"},
    ],
    "coll-operational": [
        {"item_id": "dashboard-breaks", "item_type": "dashboard"},
        {"item_id": "dashboard-recon", "item_type": "dashboard"},
        {"item_id": "chart-breaks-by-reason", "item_type": "chart"},
        {"item_id": "chart-recon-by-system", "item_type": "chart"},
        {"item_id": "query-table-critical-breaks", "item_type": "query"},
    ],
    "coll-analysis": [
        {"item_id": "dashboard-geo", "item_type": "dashboard"},
        {"item_id": "chart-scatter-amount-age", "item_type": "chart"},
        {"item_id": "chart-radar-region", "item_type": "chart"},
        {"item_id": "chart-funnel-processing", "item_type": "chart"},
        {"item_id": "query-breaks-by-reason", "item_type": "query"},
        {"item_id": "query-geo-country-top", "item_type": "query"},
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
