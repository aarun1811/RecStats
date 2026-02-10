def test_list_charts_returns_mock(client):
    resp = client.get("/api/charts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 4
    assert len(data["charts"]) == 4
    assert data["charts"][0]["name"] == "Break Amount by Entity"


def test_get_chart_by_id(client):
    resp = client.get("/api/charts/1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 1
    assert data["viz_type"] == "bar"


def test_get_chart_not_found(client):
    resp = client.get("/api/charts/999")
    assert resp.status_code == 404


def test_get_chart_data(client):
    resp = client.post("/api/charts/1/data", json={"filters": {}})
    assert resp.status_code == 200
    data = resp.json()
    assert data["row_count"] == 4
    assert "entity" in data["columns"]


def test_get_chart_data_not_found(client):
    resp = client.post("/api/charts/999/data", json={"filters": {}})
    assert resp.status_code == 404


def test_get_chart_data_with_filters(client):
    resp = client.post(
        "/api/charts/1/data",
        json={
            "filters": {
                "entities": ["Entity A"],
                "statuses": ["Unmatched"],
            }
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["row_count"] > 0
