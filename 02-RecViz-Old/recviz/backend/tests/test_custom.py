def test_custom_aggregation_weighted_aging(client):
    resp = client.post(
        "/api/custom/aggregations",
        json={"type": "weighted_aging", "params": {}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "weighted_aging"
    assert len(data["data"]) > 0


def test_custom_aggregation_rolling_recon_rate(client):
    resp = client.post(
        "/api/custom/aggregations",
        json={"type": "rolling_recon_rate", "params": {"window_days": 7}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "rolling_recon_rate"


def test_custom_aggregation_break_velocity(client):
    resp = client.post(
        "/api/custom/aggregations",
        json={"type": "break_velocity", "params": {"period": "daily"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "break_velocity"


def test_custom_aggregation_unsupported_type(client):
    resp = client.post(
        "/api/custom/aggregations",
        json={"type": "not_real", "params": {}},
    )
    assert resp.status_code == 400
    assert "Unsupported" in resp.json()["detail"]
