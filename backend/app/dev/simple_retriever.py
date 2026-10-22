"""Stand-in Retriever: plain lexical search through the store. It is also the
BASELINE the real retriever has to beat in the retrieval eval."""

from __future__ import annotations

from app.core.interfaces import ChunkStore
from app.core.schemas import ScoredChunk


class SimpleRetriever:
    def __init__(self, store: ChunkStore):
        self.store = store

    def retrieve(self, query: str, doc_ids: list[str], k: int = 8) -> list[ScoredChunk]:
        return self.store.text_search(query, doc_ids, k)
