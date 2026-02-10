def test_execute_sql(client):
    resp = client.post(
        "/api/sql/execute",
        json={"database_id": 1, "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "columns" in data
    assert "data" in data
    assert data["row_count"] >= 0
    assert data["query_id"] is not None


def test_list_databases(client):
    resp = client.get("/api/sql/databases")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 2
    assert data["databases"][0]["name"] == "Oracle Primary (RECON)"
