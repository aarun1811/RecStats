"""Register recon_data database, datasets, charts, and dashboard in Superset."""

import json

import requests

SUPERSET_URL = "http://localhost:8088"
USERNAME = "admin"
PASSWORD = "admin"
RECON_DB_URI = "postgresql://recviz:recviz_dev@localhost:5432/recon_data"

# Session persists cookies (required for CSRF)
s = requests.Session()


def authenticate():
    """Login and set JWT + CSRF headers on the session."""
    resp = s.post(
        f"{SUPERSET_URL}/api/v1/security/login",
        json={"username": USERNAME, "password": PASSWORD, "provider": "db"},
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})

    csrf_resp = s.get(f"{SUPERSET_URL}/api/v1/security/csrf_token/")
    if csrf_resp.ok:
        csrf_token = csrf_resp.json().get("result")
        if csrf_token:
            s.headers.update({"X-CSRFToken": csrf_token, "Referer": SUPERSET_URL})

    return token


def register_database() -> int:
    resp = s.get(f"{SUPERSET_URL}/api/v1/database/")
    resp.raise_for_status()
    for db in resp.json().get("result", []):
        if db.get("database_name") == "recon_data":
            print(f"  Database 'recon_data' already registered (id={db['id']})")
            return db["id"]

    resp = s.post(f"{SUPERSET_URL}/api/v1/database/", json={
        "database_name": "recon_data",
        "sqlalchemy_uri": RECON_DB_URI,
        "expose_in_sqllab": True,
        "allow_run_async": True,
        "allow_ctas": False,
        "allow_cvas": False,
        "allow_dml": False,
        "allow_file_upload": False,
        "extra": json.dumps({"allows_virtual_table_explore": True}),
    })
    resp.raise_for_status()
    db_id = resp.json()["id"]
    print(f"  Registered database 'recon_data' (id={db_id})")
    return db_id


def create_dataset(db_id: int, table_name: str, schema: str = "public") -> int:
    resp = s.get(f"{SUPERSET_URL}/api/v1/dataset/", params={
        "q": json.dumps({"filters": [{"col": "table_name", "opr": "eq", "value": table_name}]})
    })
    resp.raise_for_status()
    results = resp.json().get("result", [])
    if results:
        print(f"  Dataset '{table_name}' already exists (id={results[0]['id']})")
        return results[0]["id"]

    resp = s.post(f"{SUPERSET_URL}/api/v1/dataset/", json={
        "database": db_id,
        "table_name": table_name,
        "schema": schema,
    })
    resp.raise_for_status()
    ds_id = resp.json()["id"]
    print(f"  Created dataset '{table_name}' (id={ds_id})")
    return ds_id


def create_chart(ds_id: int, chart_name: str, viz_type: str, params: dict) -> int:
    resp = s.get(f"{SUPERSET_URL}/api/v1/chart/", params={
        "q": json.dumps({"filters": [{"col": "slice_name", "opr": "eq", "value": chart_name}]})
    })
    resp.raise_for_status()
    results = resp.json().get("result", [])
    if results:
        print(f"  Chart '{chart_name}' already exists (id={results[0]['id']})")
        return results[0]["id"]

    resp = s.post(f"{SUPERSET_URL}/api/v1/chart/", json={
        "slice_name": chart_name,
        "datasource_id": ds_id,
        "datasource_type": "table",
        "viz_type": viz_type,
        "params": json.dumps(params),
    })
    resp.raise_for_status()
    chart_id = resp.json()["id"]
    print(f"  Created chart '{chart_name}' (id={chart_id})")
    return chart_id


def create_dashboard(chart_ids: list[int]) -> int:
    dash_name = "Recon Overview"
    resp = s.get(f"{SUPERSET_URL}/api/v1/dashboard/", params={
        "q": json.dumps({"filters": [{"col": "dashboard_title", "opr": "eq", "value": dash_name}]})
    })
    resp.raise_for_status()
    results = resp.json().get("result", [])
    if results:
        print(f"  Dashboard '{dash_name}' already exists (id={results[0]['id']})")
        return results[0]["id"]

    position = {"DASHBOARD_VERSION_KEY": "v2"}
    for chart_id in chart_ids:
        cid = f"CHART-{chart_id}"
        position[cid] = {
            "type": "CHART", "id": cid, "children": [],
            "meta": {"chartId": chart_id, "width": 6, "height": 50},
        }

    resp = s.post(f"{SUPERSET_URL}/api/v1/dashboard/", json={
        "dashboard_title": dash_name,
        "slug": "recon-overview",
        "position_json": json.dumps(position),
        "published": True,
    })
    resp.raise_for_status()
    dash_id = resp.json()["id"]
    print(f"  Created dashboard '{dash_name}' (id={dash_id})")
    return dash_id


def main():
    print("Authenticating to Superset...")
    token = authenticate()
    print(f"  Got token: {token[:20]}...")

    print("\nRegistering database...")
    db_id = register_database()

    print("\nCreating datasets...")
    txn_ds_id = create_dataset(db_id, "transactions")
    br_ds_id = create_dataset(db_id, "breaks")
    dm_ds_id = create_dataset(db_id, "daily_metrics")
    cp_ds_id = create_dataset(db_id, "counterparties")

    print("\nCreating charts...")
    chart_ids = []

    # -- Transaction charts --
    chart_ids.append(create_chart(txn_ds_id, "Transaction Volume Trend", "echarts_timeseries_line", {
        "x_axis": "trade_date",
        "time_grain_sqla": "P1D",
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "groupby": [],
        "row_limit": 10000,
    }))

    chart_ids.append(create_chart(txn_ds_id, "Transactions by Status", "pie", {
        "groupby": ["status"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "row_limit": 100,
    }))

    chart_ids.append(create_chart(txn_ds_id, "Transactions by Region", "echarts_bar", {
        "x_axis": "region",
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "groupby": ["region"],
        "row_limit": 100,
    }))

    # -- Break charts --
    chart_ids.append(create_chart(br_ds_id, "Break Trend", "echarts_timeseries_line", {
        "x_axis": "created_date",
        "time_grain_sqla": "P1D",
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "groupby": [],
        "row_limit": 10000,
    }))

    chart_ids.append(create_chart(br_ds_id, "Breaks by Category", "pie", {
        "groupby": ["category"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "row_limit": 100,
    }))

    chart_ids.append(create_chart(br_ds_id, "Breaks by Desk", "echarts_bar", {
        "x_axis": "desk",
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "groupby": ["desk"],
        "row_limit": 100,
    }))

    chart_ids.append(create_chart(br_ds_id, "Aging Distribution", "echarts_bar", {
        "x_axis": "aging_bucket",
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "groupby": ["aging_bucket"],
        "row_limit": 100,
    }))

    chart_ids.append(create_chart(br_ds_id, "Breaks by Region", "echarts_bar", {
        "x_axis": "region",
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "groupby": ["region", "category"],
        "row_limit": 100,
    }))

    # -- Daily metrics charts --
    chart_ids.append(create_chart(dm_ds_id, "Match Rate Trend", "echarts_timeseries_line", {
        "x_axis": "date",
        "time_grain_sqla": "P1D",
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "match_rate"}, "aggregate": "AVG"}],
        "groupby": [],
        "row_limit": 10000,
    }))

    chart_ids.append(create_chart(dm_ds_id, "Daily Break Amount", "echarts_timeseries_bar", {
        "x_axis": "date",
        "time_grain_sqla": "P1D",
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "break_amount"}, "aggregate": "SUM"}],
        "groupby": [],
        "row_limit": 10000,
    }))

    print("\nCreating dashboard...")
    dash_id = create_dashboard(chart_ids)

    print(f"\n{'='*50}")
    print("Phase 4 complete!")
    print(f"  Database ID: {db_id}")
    print(f"  Datasets: transactions={txn_ds_id}, breaks={br_ds_id}, daily_metrics={dm_ds_id}, counterparties={cp_ds_id}")
    print(f"  Charts: {chart_ids}")
    print(f"  Dashboard ID: {dash_id}")


if __name__ == "__main__":
    main()
