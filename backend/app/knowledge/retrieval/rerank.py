"""PARTNER TASK P7c: cross-encoder reranker.

A bi-encoder (embeddings) scores query and passage separately; a cross-encoder reads them
TOGETHER, so it is far more accurate but too slow for the whole corpus. The standard recipe:
retrieve ~30 candidates cheaply, rerank them, keep the top k.
Use sentence-transformers CrossEncoder with "BAAI/bge-reranker-base" (or the smaller
"cross-encoder/ms-marco-MiniLM-L-6-v2"). Set source="rerank" on the returned chunks.
"""

from __future__ import annotations

from app.core.schemas import ScoredChunk


class CrossEncoderReranker:
    def __init__(self, model_name: str = "BAAI/bge-reranker-base"):
        self.model_name = model_name
        raise NotImplementedError("P7c: load the cross-encoder once")

    def rerank(self, query: str, candidates: list[ScoredChunk], k: int) -> list[ScoredChunk]:
        raise NotImplementedError("P7c")
