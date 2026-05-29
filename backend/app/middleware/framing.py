"""Framing-policy headers. /embed/* is cross-origin embeddable via CSP frame-ancestors;
everything else stays same-origin only. Pure function — no config import — so it is
unit-testable in isolation."""

from __future__ import annotations


def frame_headers_for_path(path: str, frame_ancestors: list[str]) -> dict[str, str]:
    # Boundary on "/embed/" (not "/embed") so future routes like /embedded-foo or
    # /embeddable aren't silently treated as cross-origin-embeddable.
    if path == "/embed" or path.startswith("/embed/"):
        ancestors = " ".join(["'self'", *frame_ancestors])
        return {"Content-Security-Policy": f"frame-ancestors {ancestors}"}
    return {"X-Frame-Options": "SAMEORIGIN"}
