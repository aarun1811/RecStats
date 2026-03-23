#!/usr/bin/env python3
"""Generate a SQLite seed database with 1M+ rows for RecViz local development.

Usage: python scripts/generate-seed-db.py
Output: backend/app/config/seed/seed.db
"""

import random
import sqlite3
import time
from datetime import date, timedelta
from pathlib import Path

random.seed(42)

SCRIPT_DIR = Path(__file__).parent
SEED_DB_PATH = SCRIPT_DIR.parent / "backend" / "app" / "config" / "seed" / "seed.db"

# Data dimensions
AGENTS = [f"AGENT_{i:02d}" for i in range(1, 21)]
SET_IDS = [f"SET_{i:03d}" for i in range(1, 51)]
BRANCHES = [f"BR{i:03d}" for i in range(1, 21)]
TLM_INSTANCES = ["TLMP_CONSUMER", "TLMP_FINANCE", "TLMP_WEALTH"]
CORR_ACCOUNTS = [f"CA{i:04d}" for i in range(1, 51)]
LAST_ACTION_OWNERS = ["SYSTEM", "system", "AUTONET", "MANUAL_USER_01", "MANUAL_USER_02"]
FLAG_2_VALUES = [0, 1, 11]
FLAG_2_WEIGHTS = [0.10, 0.80, 0.10]

TODAY = date.today()
DATES = [(TODAY - timedelta(days=d)).isoformat() for d in range(90)]

BATCH_SIZE = 10_000


def create_tables(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS bank (
            agent_code TEXT NOT NULL,
            corr_acc_no TEXT NOT NULL,
            local_acc_no TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS message_feed (
            corr_acc_no TEXT NOT NULL,
            bran_code TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS item (
            corr_acc_no TEXT NOT NULL,
            stmt_date TEXT NOT NULL,
            flag_2 INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tlm_bdr_relationship_header (
            corr_acc_no TEXT NOT NULL,
            last_action_owner TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS recon_bank (
            recon_engine TEXT NOT NULL,
            recon_engine_env TEXT NOT NULL,
            agent_code TEXT NOT NULL,
            local_acc_no TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS mr_csum_man_match_stats_hist (
            agent_code TEXT NOT NULL,
            setid TEXT NOT NULL,
            stmt_date TEXT NOT NULL,
            bran_code TEXT NOT NULL,
            corr_acc_no TEXT NOT NULL,
            total_items INTEGER NOT NULL,
            automatch_items INTEGER NOT NULL,
            total_manual_match_count INTEGER NOT NULL,
            tlm_instance TEXT NOT NULL
        );
    """)


def create_indexes(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE INDEX IF NOT EXISTS idx_bank_corr ON bank(corr_acc_no);
        CREATE INDEX IF NOT EXISTS idx_bank_agent ON bank(agent_code);
        CREATE INDEX IF NOT EXISTS idx_bank_local ON bank(local_acc_no);
        CREATE INDEX IF NOT EXISTS idx_mf_corr ON message_feed(corr_acc_no);
        CREATE INDEX IF NOT EXISTS idx_item_corr ON item(corr_acc_no);
        CREATE INDEX IF NOT EXISTS idx_item_stmt_date ON item(stmt_date);
        CREATE INDEX IF NOT EXISTS idx_item_flag2 ON item(flag_2);
        CREATE INDEX IF NOT EXISTS idx_th_corr ON tlm_bdr_relationship_header(corr_acc_no);
        CREATE INDEX IF NOT EXISTS idx_rb_engine ON recon_bank(recon_engine, recon_engine_env);
        CREATE INDEX IF NOT EXISTS idx_mrh_agent ON mr_csum_man_match_stats_hist(agent_code);
        CREATE INDEX IF NOT EXISTS idx_mrh_tlm ON mr_csum_man_match_stats_hist(tlm_instance);
        CREATE INDEX IF NOT EXISTS idx_mrh_stmt ON mr_csum_man_match_stats_hist(stmt_date);
    """)


def generate_bank(conn: sqlite3.Connection, target: int = 1_000) -> list[tuple[str, str, str]]:
    """Generate ~5K bank rows."""
    rows = []
    for agent in AGENTS:
        for local_acc in SET_IDS:
            n_corr = random.randint(3, 8)
            for _ in range(n_corr):
                corr = random.choice(CORR_ACCOUNTS)
                rows.append((agent, corr, local_acc))
            if len(rows) >= target:
                break
        if len(rows) >= target:
            break
    conn.executemany("INSERT INTO bank VALUES (?, ?, ?)", rows)
    conn.commit()
    print(f"  bank: {len(rows)} rows")
    return rows


def generate_message_feed(conn: sqlite3.Connection, bank_rows: list, target: int = 2_000) -> list[tuple[str, str]]:
    """Generate ~10K message_feed rows."""
    rows = []
    corr_accounts = list({corr for _, corr, _ in bank_rows})
    for corr in corr_accounts:
        for bran in BRANCHES:
            rows.append((corr, bran))
    while len(rows) < target:
        corr = random.choice(corr_accounts)
        bran = random.choice(BRANCHES)
        rows.append((corr, bran))
    conn.executemany("INSERT INTO message_feed VALUES (?, ?)", rows)
    conn.commit()
    print(f"  message_feed: {len(rows)} rows")
    return rows


def generate_items(conn: sqlite3.Connection, corr_accounts: list[str], target: int = 50_000) -> None:
    """Generate ~1M item rows."""
    batch = []
    count = 0
    for _ in range(target):
        corr = random.choice(corr_accounts)
        stmt_date = random.choice(DATES)
        flag_2 = random.choices(FLAG_2_VALUES, weights=FLAG_2_WEIGHTS, k=1)[0]
        batch.append((corr, stmt_date, flag_2))
        if len(batch) >= BATCH_SIZE:
            conn.executemany("INSERT INTO item VALUES (?, ?, ?)", batch)
            conn.commit()
            count += len(batch)
            batch = []
            if count % 100_000 == 0:
                print(f"    item: {count}/{target}...")
    if batch:
        conn.executemany("INSERT INTO item VALUES (?, ?, ?)", batch)
        conn.commit()
        count += len(batch)
    print(f"  item: {count} rows")


def generate_tlm_headers(conn: sqlite3.Connection, corr_accounts: list[str], target: int = 40_000) -> None:
    """Generate ~800K tlm_bdr_relationship_header rows."""
    batch = []
    count = 0
    for _ in range(target):
        corr = random.choice(corr_accounts)
        owner = random.choice(LAST_ACTION_OWNERS)
        batch.append((corr, owner))
        if len(batch) >= BATCH_SIZE:
            conn.executemany("INSERT INTO tlm_bdr_relationship_header VALUES (?, ?)", batch)
            conn.commit()
            count += len(batch)
            batch = []
            if count % 100_000 == 0:
                print(f"    tlm_bdr_relationship_header: {count}/{target}...")
    if batch:
        conn.executemany("INSERT INTO tlm_bdr_relationship_header VALUES (?, ?)", batch)
        conn.commit()
        count += len(batch)
    print(f"  tlm_bdr_relationship_header: {count} rows")


def generate_recon_bank(conn: sqlite3.Connection) -> None:
    """Generate recon_bank rows: distinct filter combos."""
    rows = []
    for tlm_instance in TLM_INSTANCES:
        for agent in AGENTS:
            for local_acc in random.sample(SET_IDS, 3):
                rows.append(("TLM", tlm_instance, agent, local_acc))
    conn.executemany("INSERT INTO recon_bank VALUES (?, ?, ?, ?)", rows)
    conn.commit()
    print(f"  recon_bank: {len(rows)} rows")


def generate_manual_match_stats(conn: sqlite3.Connection, target: int = 10_000) -> None:
    """Generate mr_csum_man_match_stats_hist rows."""
    batch = []
    count = 0
    for _ in range(target):
        agent = random.choice(AGENTS)
        setid = random.choice(SET_IDS)
        stmt_date = random.choice(DATES)
        bran = random.choice(BRANCHES)
        corr = random.choice(CORR_ACCOUNTS)
        total = random.randint(50, 500)
        automatch = int(total * random.uniform(0.7, 0.95))
        manual = random.randint(1, 30)
        tlm_instance = random.choice(TLM_INSTANCES)
        batch.append((agent, setid, stmt_date, bran, corr, total, automatch, manual, tlm_instance))
        if len(batch) >= BATCH_SIZE:
            conn.executemany("INSERT INTO mr_csum_man_match_stats_hist VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", batch)
            conn.commit()
            count += len(batch)
            batch = []
    if batch:
        conn.executemany("INSERT INTO mr_csum_man_match_stats_hist VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", batch)
        conn.commit()
        count += len(batch)
    print(f"  mr_csum_man_match_stats_hist: {count} rows")


def main() -> None:
    SEED_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SEED_DB_PATH.exists():
        SEED_DB_PATH.unlink()
        print(f"Removed existing {SEED_DB_PATH}")

    print(f"Generating seed database at {SEED_DB_PATH}")
    start = time.time()

    conn = sqlite3.connect(str(SEED_DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=OFF")

    print("Creating tables...")
    create_tables(conn)

    print("Generating data...")
    bank_rows = generate_bank(conn)
    mf_rows = generate_message_feed(conn, bank_rows)
    corr_accounts = list({corr for corr, _ in mf_rows})
    generate_items(conn, corr_accounts)
    generate_tlm_headers(conn, corr_accounts)
    generate_recon_bank(conn)
    generate_manual_match_stats(conn)

    print("Creating indexes...")
    create_indexes(conn)

    conn.execute("ANALYZE")
    conn.close()

    size_mb = SEED_DB_PATH.stat().st_size / (1024 * 1024)
    elapsed = time.time() - start
    print(f"\nDone! {size_mb:.1f} MB in {elapsed:.1f}s")
    print(f"Path: {SEED_DB_PATH}")

    # Update databases.json with the correct absolute path to seed.db
    databases_json_path = SCRIPT_DIR.parent / "backend" / "app" / "config" / "databases.json"
    if databases_json_path.exists():
        import json as json_mod
        config = json_mod.loads(databases_json_path.read_text())
        abs_path = str(SEED_DB_PATH.resolve())
        sqlite_uri = f"sqlite:///{abs_path}"
        updated = False
        for db in config.get("databases", []):
            if db.get("dialect") == "sqlite" and db.get("sqlalchemy_uri") != sqlite_uri:
                db["sqlalchemy_uri"] = sqlite_uri
                updated = True
        if updated:
            databases_json_path.write_text(json_mod.dumps(config, indent=2) + "\n")
            print(f"Updated databases.json with seed.db path: {sqlite_uri}")


if __name__ == "__main__":
    main()
