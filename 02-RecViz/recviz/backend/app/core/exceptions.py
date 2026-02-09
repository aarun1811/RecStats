from fastapi import Request
from fastapi.responses import JSONResponse


class SupersetError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


class SidecarError(Exception):
    def __init__(self, detail: str):
        self.detail = detail


async def superset_error_handler(request: Request, exc: SupersetError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "superset_error", "detail": exc.detail},
    )


async def sidecar_error_handler(request: Request, exc: SidecarError):
    return JSONResponse(
        status_code=500,
        content={"error": "sidecar_error", "detail": exc.detail},
    )
