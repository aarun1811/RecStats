def test_list_datasets(client):
    resp = client.get("/api/datasets")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 2
    assert data["datasets"][0]["name"] == "recon_breaks"


def test_get_dataset_by_id(client):
    resp = client.get("/api/datasets/1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 1
    assert len(data["columns"]) == 7


def test_get_dataset_not_found(client):
    resp = client.get("/api/datasets/999")
    assert resp.status_code == 404


def test_get_dataset_data(client):
    resp = client.post("/api/datasets/1/data", json={"filters": {}})
    assert resp.status_code == 200
    data = resp.json()
    assert data["row_count"] == 5
    assert data["next_offset"] is None  # all data fits in one page


def test_get_dataset_data_paginated(client):
    resp = client.post(
        "/api/datasets/1/data",
        json={"filters": {}, "offset": 0, "limit": 2},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["data"]) == 2
    assert data["next_offset"] == 2


def test_get_dataset_data_not_found(client):
    resp = client.post("/api/datasets/999/data", json={"filters": {}})
    assert resp.status_code == 404
