from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import API_PREFIX, APP_NAME, APP_VERSION, CORS_ORIGINS
from app.routes import ai, documents, health
from app.utils.errors import AppError

logger = logging.getLogger("lexscope")

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Document extraction & validation for LexScope — AI analysis runs client-side via Gemini.",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "invalid_request",
                "message": "The request was malformed. Check the uploaded file or text payload.",
                "details": {"fields": [err.get("loc") for err in exc.errors()][:5]},
            }
        },
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(_: Request, exc: Exception) -> JSONResponse:
    # Log the exception type only — never the request body (legal documents).
    logger.exception("Unhandled error: %s", type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "Something went wrong on the LexScope server. Please try again.",
            }
        },
    )


app.include_router(health.router, prefix=API_PREFIX, tags=["health"])
app.include_router(documents.router, prefix=API_PREFIX, tags=["documents"])
app.include_router(ai.router, prefix=API_PREFIX, tags=["ai"])

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount(
        "/",
        StaticFiles(directory=FRONTEND_DIST, html=True),
        name="frontend",
    )

if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
