def test_list_views_empty(client):
    resp = client.get("/api/views")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_and_get_view(client):
    resp = client.post(
        "/api/views",
        json={
            "name": "My View",
            "filters": {"entities": ["Entity A"], "statuses": ["Unmatched"]},
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My View"
    view_id = data["id"]

    # Get by ID
    resp2 = client.get(f"/api/views/{view_id}")
    assert resp2.status_code == 200
    assert resp2.json()["name"] == "My View"


def test_delete_view(client):
    # Create
    resp = client.post(
        "/api/views",
        json={"name": "To Delete", "filters": {}},
    )
    view_id = resp.json()["id"]

    # Delete
    resp2 = client.delete(f"/api/views/{view_id}")
    assert resp2.status_code == 204

    # Verify gone
    resp3 = client.get(f"/api/views/{view_id}")
    assert resp3.status_code == 404


def test_delete_view_not_found(client):
    resp = client.delete("/api/views/nonexistent")
    assert resp.status_code == 404


def test_get_view_not_found(client):
    resp = client.get("/api/views/nonexistent")
    assert resp.status_code == 404
