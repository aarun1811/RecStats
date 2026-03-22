def test_search(client):
    resp = client.post(
        "/api/search",
        json={"query": "entity A", "limit": 10},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "hits" in data
    assert "total" in data
    assert data["total"] == 0  # mock returns empty
