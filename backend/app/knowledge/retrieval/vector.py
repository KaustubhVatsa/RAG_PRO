"""PARTNER TASK P7a: dense retriever = embed the query, then store.vector_search."""

from __future__ import annotations

from app.core.interfaces import ChunkStore, Embedder
from app.core.schemas import ScoredChunk


class VectorRetriever:
    def __init__(self, store: ChunkStore, embedder: Embedder):
        self.store, self.embedder = store, embedder

    def retrieve(self, query: str, doc_ids: list[str], k: int = 8) -> list[ScoredChunk]:
        raise NotImplementedError("P7a")
