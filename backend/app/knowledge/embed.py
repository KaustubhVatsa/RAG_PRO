"""PARTNER TASK P4: embeddings.  PARTNER ENTRY POINT #2 (build_embedder).

Implement SentenceTransformerEmbedder with a local open model (free, no API):
  - default model: "BAAI/bge-small-en-v1.5" (384 dims). Try "BAAI/bge-base-en-v1.5" and
    "intfloat/e5-small-v2" for the embedding ablation (P9).
  - BGE quirk: queries need the prefix "Represent this sentence for searching relevant
    passages: " but documents do not. This asymmetry is why embed_query != embed_documents.
  - normalize_embeddings=True so cosine similarity == dot product.
  - embed_documents must batch (e.g. 32) and not load the model more than once.
"""

from __future__ import annotations

from app.config import Settings
from app.core.interfaces import Embedder


class SentenceTransformerEmbedder:
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.model_name = model_name
        self.dim = 384  # TODO: read from the model instead of hard-coding
        raise NotImplementedError("P4: load the sentence-transformers model")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError("P4")

    def embed_query(self, text: str) -> list[float]:
        raise NotImplementedError("P4")


def build_embedder(settings: Settings) -> Embedder:
    if settings.embedder == "bge":
        return SentenceTransformerEmbedder()
    from app.dev.hash_embedder import HashEmbedder

    return HashEmbedder()
