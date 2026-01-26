"""Mock connector for development and demo purposes."""

import random
import time
from datetime import datetime, timedelta
from typing import Any, Optional

from app.connectors.base import BaseConnector, QueryResult
from app.schemas.datasource import SchemaInfo, TableInfo, ColumnInfo


class MockConnector(BaseConnector):
    """Mock connector that generates realistic reconciliation data."""

    # Sample data constants
    REGIONS = ["APAC", "EMEA", "NAM", "LATAM"]
    COUNTRIES = {
        "APAC": ["Japan", "Singapore", "Hong Kong", "Australia", "India", "China"],
        "EMEA": ["UK", "Germany", "France", "Switzerland", "UAE", "South Africa"],
        "NAM": ["USA", "Canada", "Mexico"],
        "LATAM": ["Brazil", "Argentina", "Chile", "Colombia"],
    }
    LOBS = ["Markets", "Banking", "Securities Services", "Treasury"]
    BREAK_REASONS = [
        "Amount Mismatch",
        "Missing Counterparty",
        "Date Mismatch",
        "Currency Mismatch",
        "Duplicate Entry",
        "Late Settlement",
        "Missing Reference",
        "System Error",
    ]
    SOURCE_SYSTEMS = ["System A", "System B", "System C", "System D", "System E"]
    STATUSES = ["Matched", "Unmatched", "Break", "Pending"]
    CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "SGD", "HKD"]

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._generate_sample_data()

    def _generate_sample_data(self):
        """Generate sample reconciliation data."""
        random.seed(42)  # Consistent data across runs

        # Generate transactions
        self.transactions = []
        base_date = datetime.now() - timedelta(days=365)

        for i in range(10000):
            region = random.choice(self.REGIONS)
            country = random.choice(self.COUNTRIES[region])
            status = random.choices(
                self.STATUSES, weights=[70, 10, 15, 5], k=1
            )[0]

            self.transactions.append({
                "id": f"TXN{i+1:06d}",
                "date": (base_date + timedelta(days=random.randint(0, 365))).strftime("%Y-%m-%d"),
                "amount": round(random.uniform(1000, 1000000), 2),
                "currency": random.choice(self.CURRENCIES),
                "source_system": random.choice(self.SOURCE_SYSTEMS),
                "counterparty": f"CP{random.randint(1, 500):04d}",
                "region": region,
                "country": country,
                "lob": random.choice(self.LOBS),
                "status": status,
            })

        # Generate breaks
        self.breaks = []
        break_transactions = [t for t in self.transactions if t["status"] == "Break"]

        for i, txn in enumerate(break_transactions):
            self.breaks.append({
                "id": f"BRK{i+1:05d}",
                "transaction_id": txn["id"],
                "break_reason": random.choice(self.BREAK_REASONS),
                "break_category": random.choice(["Critical", "High", "Medium", "Low"]),
                "age_days": random.randint(1, 90),
                "assigned_to": f"User{random.randint(1, 20):02d}",
                "priority": random.choice(["P1", "P2", "P3", "P4"]),
                "created_date": txn["date"],
                "region": txn["region"],
                "country": txn["country"],
                "lob": txn["lob"],
            })

        # Generate daily metrics
        self.daily_metrics = []
        for i in range(365):
            date = (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
            total = random.randint(800, 1200)
            matched = int(total * random.uniform(0.80, 0.95))
            breaks = int((total - matched) * random.uniform(0.3, 0.7))
            unmatched = total - matched - breaks

            self.daily_metrics.append({
                "date": date,
                "total_transactions": total,
                "matched": matched,
                "unmatched": unmatched,
                "breaks": breaks,
                "match_rate": round(matched / total * 100, 2),
                "avg_break_age": round(random.uniform(5, 25), 1),
            })

        # Generate reconciliations
        self.reconciliations = []
        recon_names = [
            "Trade Settlements", "Cash Positions", "Securities Holdings",
            "Derivatives Valuations", "FX Forwards", "Money Market",
            "Bond Holdings", "Equity Positions", "Fund NAV", "Client Balances"
        ]

        for i, name in enumerate(recon_names):
            self.reconciliations.append({
                "id": f"REC{i+1:03d}",
                "name": name,
                "source_system_a": random.choice(self.SOURCE_SYSTEMS[:3]),
                "source_system_b": random.choice(self.SOURCE_SYSTEMS[2:]),
                "frequency": random.choice(["Daily", "Weekly", "Monthly"]),
                "last_run": (datetime.now() - timedelta(hours=random.randint(1, 48))).strftime("%Y-%m-%d %H:%M"),
                "match_rate": round(random.uniform(85, 99), 2),
                "status": random.choice(["Healthy", "Warning", "Critical"]),
            })

    async def test_connection(self) -> tuple[bool, str]:
        """Test connection - always succeeds for mock."""
        return True, "Mock connection successful"

    async def get_schema(self) -> SchemaInfo:
        """Return mock schema information."""
        tables = [
            TableInfo(
                name="transactions",
                columns=[
                    ColumnInfo(name="id", data_type="VARCHAR", primary_key=True),
                    ColumnInfo(name="date", data_type="DATE"),
                    ColumnInfo(name="amount", data_type="DECIMAL"),
                    ColumnInfo(name="currency", data_type="VARCHAR"),
                    ColumnInfo(name="source_system", data_type="VARCHAR"),
                    ColumnInfo(name="counterparty", data_type="VARCHAR"),
                    ColumnInfo(name="region", data_type="VARCHAR"),
                    ColumnInfo(name="country", data_type="VARCHAR"),
                    ColumnInfo(name="lob", data_type="VARCHAR"),
                    ColumnInfo(name="status", data_type="VARCHAR"),
                ],
                row_count=len(self.transactions),
            ),
            TableInfo(
                name="breaks",
                columns=[
                    ColumnInfo(name="id", data_type="VARCHAR", primary_key=True),
                    ColumnInfo(name="transaction_id", data_type="VARCHAR"),
                    ColumnInfo(name="break_reason", data_type="VARCHAR"),
                    ColumnInfo(name="break_category", data_type="VARCHAR"),
                    ColumnInfo(name="age_days", data_type="INTEGER"),
                    ColumnInfo(name="assigned_to", data_type="VARCHAR"),
                    ColumnInfo(name="priority", data_type="VARCHAR"),
                    ColumnInfo(name="created_date", data_type="DATE"),
                    ColumnInfo(name="region", data_type="VARCHAR"),
                    ColumnInfo(name="country", data_type="VARCHAR"),
                    ColumnInfo(name="lob", data_type="VARCHAR"),
                ],
                row_count=len(self.breaks),
            ),
            TableInfo(
                name="daily_metrics",
                columns=[
                    ColumnInfo(name="date", data_type="DATE", primary_key=True),
                    ColumnInfo(name="total_transactions", data_type="INTEGER"),
                    ColumnInfo(name="matched", data_type="INTEGER"),
                    ColumnInfo(name="unmatched", data_type="INTEGER"),
                    ColumnInfo(name="breaks", data_type="INTEGER"),
                    ColumnInfo(name="match_rate", data_type="DECIMAL"),
                    ColumnInfo(name="avg_break_age", data_type="DECIMAL"),
                ],
                row_count=len(self.daily_metrics),
            ),
            TableInfo(
                name="reconciliations",
                columns=[
                    ColumnInfo(name="id", data_type="VARCHAR", primary_key=True),
                    ColumnInfo(name="name", data_type="VARCHAR"),
                    ColumnInfo(name="source_system_a", data_type="VARCHAR"),
                    ColumnInfo(name="source_system_b", data_type="VARCHAR"),
                    ColumnInfo(name="frequency", data_type="VARCHAR"),
                    ColumnInfo(name="last_run", data_type="TIMESTAMP"),
                    ColumnInfo(name="match_rate", data_type="DECIMAL"),
                    ColumnInfo(name="status", data_type="VARCHAR"),
                ],
                row_count=len(self.reconciliations),
            ),
        ]
        return SchemaInfo(tables=tables)

    async def execute_query(
        self,
        sql: str,
        limit: int = 1000,
        offset: int = 0,
        parameters: Optional[dict[str, Any]] = None,
    ) -> QueryResult:
        """Execute a mock query - parses simple SELECT statements."""
        start_time = time.time()

        # Simple SQL parsing - just check which table
        sql_lower = sql.lower().strip()

        if "transactions" in sql_lower:
            data = self.transactions
            columns = [
                {"name": "id", "data_type": "string"},
                {"name": "date", "data_type": "date"},
                {"name": "amount", "data_type": "number"},
                {"name": "currency", "data_type": "string"},
                {"name": "source_system", "data_type": "string"},
                {"name": "counterparty", "data_type": "string"},
                {"name": "region", "data_type": "string"},
                {"name": "country", "data_type": "string"},
                {"name": "lob", "data_type": "string"},
                {"name": "status", "data_type": "string"},
            ]
        elif "breaks" in sql_lower:
            data = self.breaks
            columns = [
                {"name": "id", "data_type": "string"},
                {"name": "transaction_id", "data_type": "string"},
                {"name": "break_reason", "data_type": "string"},
                {"name": "break_category", "data_type": "string"},
                {"name": "age_days", "data_type": "number"},
                {"name": "assigned_to", "data_type": "string"},
                {"name": "priority", "data_type": "string"},
                {"name": "created_date", "data_type": "date"},
                {"name": "region", "data_type": "string"},
                {"name": "country", "data_type": "string"},
                {"name": "lob", "data_type": "string"},
            ]
        elif "daily_metrics" in sql_lower or "metrics" in sql_lower:
            data = self.daily_metrics
            columns = [
                {"name": "date", "data_type": "date"},
                {"name": "total_transactions", "data_type": "number"},
                {"name": "matched", "data_type": "number"},
                {"name": "unmatched", "data_type": "number"},
                {"name": "breaks", "data_type": "number"},
                {"name": "match_rate", "data_type": "number"},
                {"name": "avg_break_age", "data_type": "number"},
            ]
        elif "reconciliations" in sql_lower or "recon" in sql_lower:
            data = self.reconciliations
            columns = [
                {"name": "id", "data_type": "string"},
                {"name": "name", "data_type": "string"},
                {"name": "source_system_a", "data_type": "string"},
                {"name": "source_system_b", "data_type": "string"},
                {"name": "frequency", "data_type": "string"},
                {"name": "last_run", "data_type": "datetime"},
                {"name": "match_rate", "data_type": "number"},
                {"name": "status", "data_type": "string"},
            ]
        else:
            # Default to transactions
            data = self.transactions
            columns = [
                {"name": "id", "data_type": "string"},
                {"name": "date", "data_type": "date"},
                {"name": "amount", "data_type": "number"},
                {"name": "currency", "data_type": "string"},
                {"name": "source_system", "data_type": "string"},
                {"name": "counterparty", "data_type": "string"},
                {"name": "region", "data_type": "string"},
                {"name": "country", "data_type": "string"},
                {"name": "lob", "data_type": "string"},
                {"name": "status", "data_type": "string"},
            ]

        total_count = len(data)
        data_slice = data[offset : offset + limit]
        truncated = (offset + limit) < total_count

        execution_time = (time.time() - start_time) * 1000

        return QueryResult(
            columns=columns,
            data=data_slice,
            row_count=len(data_slice),
            total_count=total_count,
            execution_time_ms=round(execution_time, 2),
            truncated=truncated,
        )
