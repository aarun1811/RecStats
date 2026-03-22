def test_export_pdf(client):
    resp = client.post(
        "/api/export/pdf",
        json={
            "format": "pdf",
            "dashboard_id": "recon-overview",
            "filters": {},
        },
    )
    assert resp.status_code == 202
    data = resp.json()
    assert "job_id" in data
    assert data["status"] in ("queued", "processing", "completed", "failed")


def test_export_excel(client):
    resp = client.post(
        "/api/export/excel",
        json={
            "format": "excel",
            "dashboard_id": "recon-overview",
            "filters": {},
        },
    )
    assert resp.status_code == 202
    data = resp.json()
    assert "job_id" in data


def test_export_status(client):
    # Create an export first
    resp = client.post(
        "/api/export/pdf",
        json={
            "format": "pdf",
            "dashboard_id": "recon-overview",
            "filters": {},
        },
    )
    job_id = resp.json()["job_id"]

    # Check status
    resp2 = client.get(f"/api/export/status/{job_id}")
    assert resp2.status_code == 200
    data = resp2.json()
    assert data["job_id"] == job_id


def test_export_status_not_found(client):
    resp = client.get("/api/export/status/nonexistent")
    assert resp.status_code == 404
