from __future__ import annotations

from app.middleware.framing import frame_headers_for_path


def test_embed_path_gets_frame_ancestors():
    h = frame_headers_for_path("/embed/dashboards/quickrec-stats", ["http://localhost:5173"])
    assert h == {"Content-Security-Policy": "frame-ancestors 'self' http://localhost:5173"}


def test_embed_path_multiple_origins():
    h = frame_headers_for_path("/embed/x", ["http://localhost:5173", "https://rectrace.example"])
    assert h["Content-Security-Policy"] == (
        "frame-ancestors 'self' http://localhost:5173 https://rectrace.example"
    )


def test_non_embed_keeps_x_frame_options():
    h = frame_headers_for_path("/dashboards", ["http://localhost:5173"])
    assert h == {"X-Frame-Options": "SAMEORIGIN"}
