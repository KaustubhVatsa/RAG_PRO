"""PARTNER TASK P7a: lexical retriever = store.text_search (Atlas Search in MongoStore).
Trivial once the store works; kept as its own class so the ablation can toggle it."""

from __future__ import annotations

from app.core.interfaces import ChunkStore
from app.core.schemas import ScoredChunk


class BM25Retriever:
    def __init__(self, store: ChunkStore):
        self.store = store

    def retrieve(self, query: str, doc_ids: list[str], k: int = 8) -> list[ScoredChunk]:
        raise NotImplementedError("P7a")
