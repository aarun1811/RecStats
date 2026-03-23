"""Mock query results keyed by data_source_id.

These mirror the exact shape Superset's SQL Lab API would return.
"""

import random

random.seed(42)

AGENTS = ["AGENT_01", "AGENT_02", "AGENT_03", "AGENT_04", "AGENT_05"]
SET_IDS = ["SET_001", "SET_002", "SET_003", "SET_004", "SET_005", "SET_006"]
BRANCHES = ["BR001", "BR002", "BR003", "BR004"]
DATES = ["2026-03-22", "2026-03-21", "2026-03-20", "2026-03-19", "2026-03-18"]
TLM_INSTANCES = ["TLMP_CONSUMER", "TLMP_FINANCE", "TLMP_WEALTH"]
CORR_ACCOUNTS = ["CA001", "CA002", "CA003", "CA004"]


def _generate_breaks_rows(n: int = 20) -> list[dict]:
    rows = []
    for _ in range(n):
        rows.append({
            "agent_code": random.choice(AGENTS),
            "local_acc_no": random.choice(SET_IDS),
            "bran_code": random.choice(BRANCHES),
            "stmt_date": random.choice(DATES),
            "breaks_count": random.randint(1, 50),
        })
    return rows


def _generate_automatch_rows(n: int = 20) -> list[dict]:
    rows = []
    for _ in range(n):
        total = random.randint(50, 500)
        automatch = int(total * random.uniform(0.7, 0.98))
        rows.append({
            "agent_code": random.choice(AGENTS),
            "set_id": random.choice(SET_IDS),
            "bran_code": random.choice(BRANCHES),
            "stmt_date": random.choice(DATES),
            "corr_acc_no": random.choice(CORR_ACCOUNTS),
            "total_items": total,
            "automatch_items": automatch,
        })
    return rows


def _generate_manual_match_rows(n: int = 15) -> list[dict]:
    rows = []
    for _ in range(n):
        total = random.randint(50, 500)
        automatch = int(total * random.uniform(0.7, 0.95))
        manual = random.randint(1, 30)
        rows.append({
            "agent_code": random.choice(AGENTS),
            "set_id": random.choice(SET_IDS),
            "stmt_date": random.choice(DATES),
            "bran_code": random.choice(BRANCHES),
            "corr_acc_no": random.choice(CORR_ACCOUNTS),
            "total_items": total,
            "automatch_items": automatch,
            "total_manual_match_count": manual,
        })
    return rows


MOCK_QUERY_RESULTS: dict[str, dict] = {
    "tlm_breaks": {
        "columns": ["agent_code", "local_acc_no", "bran_code", "stmt_date", "breaks_count"],
        "rows": _generate_breaks_rows(20),
    },
    "tlm_automatch": {
        "columns": ["agent_code", "set_id", "bran_code", "stmt_date", "corr_acc_no", "total_items", "automatch_items"],
        "rows": _generate_automatch_rows(20),
    },
    "reconmgmt_manual": {
        "columns": ["agent_code", "set_id", "stmt_date", "bran_code", "corr_acc_no", "total_items", "automatch_items", "total_manual_match_count"],
        "rows": _generate_manual_match_rows(15),
    },
}

MOCK_DISTINCT_VALUES: dict[str, dict[str, list[str]]] = {
    "reconmgmt_recon_bank": {
        "recon_engine_env": TLM_INSTANCES,
        "agent_code": AGENTS,
        "local_acc_no": SET_IDS,
    },
}
