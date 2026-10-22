"""PARTNER TASK P7d: the production retriever.

HybridRetriever.retrieve(query, doc_ids, k):
  1. vector.retrieve(..., k=30) and bm25.retrieve(..., k=30)
  2. rrf_fuse the two id rankings
  3. (optional, toggle via constructor flag) rerank the top ~30 fused with the cross-encoder
  4. return top-k ScoredChunks, source="hybrid" (or "rerank" if reranked)
Constructor flags (use_bm25, use_rerank) exist so the retrieval eval can run the ablation:
vector-only -> +bm25 -> +rerank.
"""

from __future__ import annotations

from app.core.interfaces import ChunkStore, Embedder
from app.core.schemas import ScoredChunk


class HybridRetriever:
    def __init__(
        self,
        store: ChunkStore,
        embedder: Embedder,
        use_bm25: bool = True,
        use_rerank: bool = False,
    ):
        self.store, self.embedder = store, embedder
        self.use_bm25, self.use_rerank = use_bm25, use_rerank

    def retrieve(self, query: str, doc_ids: list[str], k: int = 8) -> list[ScoredChunk]:
        raise NotImplementedError("P7d")
