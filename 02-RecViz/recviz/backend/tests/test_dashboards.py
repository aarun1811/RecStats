def test_list_dashboards(client):
    resp = client.get("/api/dashboards")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 2
    names = [d["name"] for d in data["dashboards"]]
    assert "Reconciliation Overview" in names


def test_get_dashboard(client):
    resp = client.get("/api/dashboards/recon-overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "recon-overview"
    assert len(data["charts"]) == 4
    assert len(data["cross_filter_rules"]) == 1


def test_get_dashboard_not_found(client):
    resp = client.get("/api/dashboards/nonexistent")
    assert resp.status_code == 404


def test_create_dashboard(client):
    resp = client.post(
        "/api/dashboards",
        json={"name": "Test Dashboard", "description": "For testing"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Dashboard"
    assert data["id"] is not None

    # Verify it appears in list
    resp2 = client.get(f"/api/dashboards/{data['id']}")
    assert resp2.status_code == 200


def test_update_dashboard(client):
    resp = client.put(
        "/api/dashboards/recon-overview",
        json={"name": "Updated Overview"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Overview"
    # Description should be unchanged
    assert data["description"] == "High-level view of reconciliation status across all entities"


def test_update_dashboard_not_found(client):
    resp = client.put(
        "/api/dashboards/nonexistent",
        json={"name": "nope"},
    )
    assert resp.status_code == 404
