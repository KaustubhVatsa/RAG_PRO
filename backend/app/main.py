from __future__ import annotations

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, documents, evals, health
from app.deps import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Verity API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    api = APIRouter(prefix="/api")
    for module in (health, documents, chat, evals):
        api.include_router(module.router)
    app.include_router(api)
    return app


app = create_app()
