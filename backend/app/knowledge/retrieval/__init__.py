"""PARTNER ENTRY POINT #4. Public factory the app calls; keep the signature."""

from __future__ import annotations

from app.config import Settings
from app.core.interfaces import ChunkStore, Retriever


def build_retriever(store: ChunkStore, settings: Settings) -> Retriever:
    if settings.retriever == "real":
        from app.knowledge.embed import build_embedder
        from app.knowledge.retrieval.hybrid import HybridRetriever

        return HybridRetriever(store, build_embedder(settings), use_bm25=True, use_rerank=False)
    from app.dev.simple_retriever import SimpleRetriever

    return SimpleRetriever(store)
