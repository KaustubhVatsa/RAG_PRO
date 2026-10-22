from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import Settings
from app.deps import get_settings

router = APIRouter()


@router.get("/health")
def health(s: Settings = Depends(get_settings)) -> dict:
    """Also reports which implementations are live, so the UI can show a 'mock mode' badge."""
    return {
        "status": "ok",
        "store": s.store,
        "retriever": s.retriever,
        "ingestor": s.ingestor,
        "llm_provider": s.llm_provider,
    }
