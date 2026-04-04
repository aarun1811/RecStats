"""Seed the recon_data PostgreSQL database with realistic reconciliation data.

Generates:
- 1,000,000 transactions
- ~150,000 breaks (linked to transactions)
- 365 daily metrics
- 50 counterparties
"""

import random
from datetime import datetime, timedelta

import psycopg2
from psycopg2.extras import execute_values

DB_URL = "postgresql://recviz:recviz_dev@localhost:5432/recon_data"

# --- Reference data ---

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

DESKS = ["Operations", "Treasury", "Settlements", "FX", "Equity"]

STATUSES = ["matched", "unmatched", "break"]
STATUS_WEIGHTS = [75, 10, 15]  # 75% matched, 10% unmatched, 15% break

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
BREAK_CATEGORY_WEIGHTS = [5, 15, 40, 40]

BREAK_STATUSES = ["Open", "Resolved", "Investigating", "Escalated"]
BREAK_STATUS_WEIGHTS = [25, 55, 12, 8]

ASSIGNEES = [
    "John Smith", "Jane Doe", "Michael Johnson", "Sarah Williams",
    "David Brown", "Emily Davis", "Robert Wilson", "Lisa Anderson",
    "James Taylor", "Maria Garcia", "Unassigned",
]

COUNTERPARTY_NAMES = [
    "Goldman Sachs", "JP Morgan", "Morgan Stanley", "Bank of America", "Citigroup",
    "Deutsche Bank", "Barclays", "HSBC", "UBS", "Credit Suisse",
    "BNP Paribas", "Societe Generale", "Nomura", "Mizuho", "MUFG",
    "Standard Chartered", "RBC", "TD Securities", "Macquarie", "ANZ",
    "ING Group", "Rabobank", "Commerzbank", "UniCredit", "Intesa Sanpaolo",
    "Santander", "BBVA", "Scotiabank", "CIBC", "BMO Capital",
    "Jefferies", "Lazard", "Evercore", "Piper Sandler", "Cowen",
    "State Street", "BNY Mellon", "Northern Trust", "Vanguard", "BlackRock",
    "PIMCO", "Fidelity", "T. Rowe Price", "Franklin Templeton", "Invesco",
    "KKR", "Apollo", "Blackstone", "Carlyle", "TPG Capital",
]

RISK_RATINGS = ["Low", "Medium", "High"]


def aging_bucket(days: int) -> str:
    if days <= 1:
        return "0-1d"
    if days <= 3:
        return "2-3d"
    if days <= 7:
        return "4-7d"
    if days <= 14:
        return "8-14d"
    if days <= 30:
        return "15-30d"
    return "30d+"


def create_tables(cur):
    cur.execute("""
        DROP TABLE IF EXISTS breaks CASCADE;
        DROP TABLE IF EXISTS transactions CASCADE;
        DROP TABLE IF EXISTS daily_metrics CASCADE;
        DROP TABLE IF EXISTS counterparties CASCADE;
    """)

    cur.execute("""
        CREATE TABLE counterparties (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            region VARCHAR(10) NOT NULL,
            risk_rating VARCHAR(10) NOT NULL
        );
    """)

    cur.execute("""
        CREATE TABLE transactions (
            id VARCHAR(20) PRIMARY KEY,
            trade_date DATE NOT NULL,
            settlement_date DATE NOT NULL,
            amount NUMERIC(15,2) NOT NULL,
            currency VARCHAR(3) NOT NULL,
            region VARCHAR(10) NOT NULL,
            country VARCHAR(30) NOT NULL,
            lob VARCHAR(30) NOT NULL,
            desk VARCHAR(20) NOT NULL,
            source_system VARCHAR(20) NOT NULL,
            counterparty VARCHAR(100) NOT NULL,
            status VARCHAR(15) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
    """)

    cur.execute("""
        CREATE TABLE breaks (
            id VARCHAR(20) PRIMARY KEY,
            transaction_id VARCHAR(20) NOT NULL REFERENCES transactions(id),
            reason VARCHAR(50) NOT NULL,
            category VARCHAR(10) NOT NULL,
            break_type VARCHAR(20) NOT NULL,
            amount NUMERIC(15,2) NOT NULL,
            currency VARCHAR(3) NOT NULL,
            region VARCHAR(10) NOT NULL,
            country VARCHAR(30) NOT NULL,
            lob VARCHAR(30) NOT NULL,
            desk VARCHAR(20) NOT NULL,
            status VARCHAR(15) NOT NULL,
            aging_days INTEGER NOT NULL,
            aging_bucket VARCHAR(10) NOT NULL,
            sla_breach BOOLEAN NOT NULL DEFAULT FALSE,
            assigned_to VARCHAR(50) NOT NULL,
            priority INTEGER NOT NULL,
            created_date DATE NOT NULL,
            resolved_date DATE,
            notes TEXT
        );
    """)

    cur.execute("""
        CREATE TABLE daily_metrics (
            id SERIAL PRIMARY KEY,
            date DATE NOT NULL,
            total_transactions INTEGER NOT NULL,
            matched INTEGER NOT NULL,
            unmatched INTEGER NOT NULL,
            breaks INTEGER NOT NULL,
            match_rate NUMERIC(5,2) NOT NULL,
            total_amount NUMERIC(18,2) NOT NULL,
            break_amount NUMERIC(18,2) NOT NULL,
            avg_break_age NUMERIC(5,1) NOT NULL,
            sla_breach_count INTEGER NOT NULL DEFAULT 0,
            UNIQUE(date)
        );
    """)

    # Indexes for common query patterns
    cur.execute("CREATE INDEX idx_txn_trade_date ON transactions(trade_date);")
    cur.execute("CREATE INDEX idx_txn_status ON transactions(status);")
    cur.execute("CREATE INDEX idx_txn_region ON transactions(region);")
    cur.execute("CREATE INDEX idx_txn_lob ON transactions(lob);")
    cur.execute("CREATE INDEX idx_txn_desk ON transactions(desk);")
    cur.execute("CREATE INDEX idx_txn_counterparty ON transactions(counterparty);")
    cur.execute("CREATE INDEX idx_breaks_status ON breaks(status);")
    cur.execute("CREATE INDEX idx_breaks_category ON breaks(category);")
    cur.execute("CREATE INDEX idx_breaks_aging ON breaks(aging_days);")
    cur.execute("CREATE INDEX idx_breaks_assigned ON breaks(assigned_to);")
    cur.execute("CREATE INDEX idx_breaks_created ON breaks(created_date);")
    cur.execute("CREATE INDEX idx_breaks_txn ON breaks(transaction_id);")


def seed_counterparties(cur):
    rows = [
        (name, random.choice(REGIONS), random.choice(RISK_RATINGS))
        for name in COUNTERPARTY_NAMES
    ]
    execute_values(
        cur,
        "INSERT INTO counterparties (name, region, risk_rating) VALUES %s",
        rows,
    )
    print(f"  Seeded {len(rows)} counterparties")


def seed_transactions(cur, num_records=1_000_000):
    """Generate and insert transactions in batches of 50k for speed."""
    today = datetime.now()
    batch_size = 50_000
    total = 0
    break_txn_ids = []  # collect transaction IDs that are breaks

    for batch_start in range(0, num_records, batch_size):
        batch_end = min(batch_start + batch_size, num_records)
        rows = []
        for i in range(batch_start, batch_end):
            txn_id = f"TXN{i+1:08d}"
            region = random.choice(REGIONS)
            country = random.choice(REGION_COUNTRIES[region])
            days_ago = random.randint(0, 364)
            trade_date = today - timedelta(days=days_ago)
            settlement_date = trade_date + timedelta(days=random.randint(1, 5))
            status = random.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]
            amount = round(random.uniform(100, 5_000_000), 2)

            rows.append((
                txn_id,
                trade_date.date(),
                settlement_date.date(),
                amount,
                random.choice(CURRENCIES),
                region,
                country,
                random.choice(LOBS),
                random.choice(DESKS),
                random.choice(SOURCE_SYSTEMS),
                random.choice(COUNTERPARTY_NAMES),
                status,
            ))

            if status == "break":
                break_txn_ids.append((txn_id, trade_date, amount, region, country,
                                      rows[-1][7], rows[-1][8], rows[-1][4]))

        execute_values(
            cur,
            """INSERT INTO transactions
               (id, trade_date, settlement_date, amount, currency, region, country,
                lob, desk, source_system, counterparty, status)
               VALUES %s""",
            rows,
        )
        total += len(rows)
        print(f"  Transactions: {total:,} / {num_records:,}")

    print(f"  Seeded {total:,} transactions ({len(break_txn_ids):,} breaks)")
    return break_txn_ids


def seed_breaks(cur, break_txn_ids):
    """Create break records for every transaction with status='break'."""
    today = datetime.now()
    batch_size = 50_000
    total = 0

    notes_templates = [
        "Pending counterparty confirmation",
        "Amount discrepancy under investigation",
        "Settlement date mismatch — awaiting resolution",
        "Missing trade reference from source system",
        "Duplicate entry detected in reconciliation",
        "Currency conversion difference exceeds threshold",
        "Late reporting from counterparty",
        "Nostro balance adjustment required",
        "Fee calculation differs between systems",
        "Collateral margin call dispute",
        None, None, None,
    ]

    priority_map = {"Critical": 1, "High": 2, "Medium": 3, "Low": 4}
    break_types = ["Cash", "Position", "Settlement", "Nostro", "Fee", "Margin", "Collateral"]

    for batch_start in range(0, len(break_txn_ids), batch_size):
        batch = break_txn_ids[batch_start:batch_start + batch_size]
        rows = []
        for idx, (txn_id, trade_date, amount, region, country, lob, desk, currency) in enumerate(batch):
            brk_id = f"BRK{batch_start + idx + 1:08d}"
            category = random.choices(BREAK_CATEGORIES, weights=BREAK_CATEGORY_WEIGHTS, k=1)[0]
            status = random.choices(BREAK_STATUSES, weights=BREAK_STATUS_WEIGHTS, k=1)[0]
            aging = random.randint(0, 90) if status != "Resolved" else random.randint(0, 14)
            created_date = trade_date.date() if isinstance(trade_date, datetime) else trade_date
            resolved_date = (
                (trade_date + timedelta(days=random.randint(1, max(aging, 1)))).date()
                if status == "Resolved" else None
            )
            sla_breach = aging > 7 if status != "Resolved" else False
            brk_amount = round(amount * random.uniform(0.001, 0.1), 2)  # break amount is fraction of trade

            rows.append((
                brk_id,
                txn_id,
                random.choice(BREAK_REASONS),
                category,
                random.choice(break_types),
                brk_amount,
                currency,
                region,
                country,
                lob,
                desk,
                status,
                aging,
                aging_bucket(aging),
                sla_breach,
                random.choice(ASSIGNEES),
                priority_map[category],
                created_date,
                resolved_date,
                random.choice(notes_templates),
            ))

        execute_values(
            cur,
            """INSERT INTO breaks
               (id, transaction_id, reason, category, break_type, amount, currency,
                region, country, lob, desk, status, aging_days, aging_bucket,
                sla_breach, assigned_to, priority, created_date, resolved_date, notes)
               VALUES %s""",
            rows,
        )
        total += len(rows)
        print(f"  Breaks: {total:,} / {len(break_txn_ids):,}")

    print(f"  Seeded {total:,} break records")


def seed_daily_metrics(cur):
    """Generate 365 days of daily metrics with realistic patterns."""
    today = datetime.now()
    rows = []

    for i in range(365):
        date = (today - timedelta(days=364 - i)).date()

        # Base volume with variation — weekends are quieter
        base_volume = 50_000 + random.randint(-15_000, 15_000)
        if date.weekday() >= 5:
            base_volume = int(base_volume * 0.3)

        # Match rate varies 88-97%
        match_rate = round(88 + random.uniform(0, 9), 2)
        matched = int(base_volume * (match_rate / 100))
        unmatched = base_volume - matched
        breaks = int(unmatched * random.uniform(0.3, 0.6))

        total_amount = round(base_volume * random.uniform(20_000, 80_000), 2)
        break_amount = round(breaks * random.uniform(5_000, 50_000), 2)
        avg_break_age = round(random.uniform(1.5, 12.0), 1)
        sla_breach_count = random.randint(0, max(1, breaks // 10))

        rows.append((
            date, base_volume, matched, unmatched, breaks,
            match_rate, total_amount, break_amount, avg_break_age, sla_breach_count,
        ))

    execute_values(
        cur,
        """INSERT INTO daily_metrics
           (date, total_transactions, matched, unmatched, breaks,
            match_rate, total_amount, break_amount, avg_break_age, sla_breach_count)
           VALUES %s""",
        rows,
    )
    print(f"  Seeded {len(rows)} daily metric rows")


def main():
    print("Connecting to recon_data database...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        print("Creating tables...")
        create_tables(cur)

        print("\nSeeding counterparties...")
        seed_counterparties(cur)

        print("\nSeeding transactions (1M rows — this takes ~30s)...")
        break_txn_ids = seed_transactions(cur, num_records=1_000_000)

        print(f"\nSeeding breaks ({len(break_txn_ids):,} rows)...")
        seed_breaks(cur, break_txn_ids)

        print("\nSeeding daily metrics...")
        seed_daily_metrics(cur)

        print("\nCommitting...")
        conn.commit()

        print("\nDone! Verifying row counts:")
        for table in ["counterparties", "transactions", "breaks", "daily_metrics"]:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            print(f"  {table}: {cur.fetchone()[0]:,} rows")

        # Quick stats
        cur.execute("SELECT status, COUNT(*) FROM transactions GROUP BY status ORDER BY COUNT(*) DESC")
        print("\nTransaction status distribution:")
        for status, count in cur.fetchall():
            print(f"  {status}: {count:,}")

        cur.execute("SELECT category, COUNT(*) FROM breaks GROUP BY category ORDER BY COUNT(*) DESC")
        print("\nBreak category distribution:")
        for cat, count in cur.fetchall():
            print(f"  {cat}: {count:,}")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
