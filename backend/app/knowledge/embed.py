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
      query_prefix = "Represent this sentence for searching relevant passages: "

      def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5", batch_size: int = 32):
          if batch_size < 1:
              raise ValueError("batch_size must be positive")

          from sentence_transformers import SentenceTransformer

          self.model_name = model_name
          self.batch_size = batch_size
          self.model = SentenceTransformer(model_name)
          get_dimension = getattr(self.model, "get_embedding_dimension", None)
          if get_dimension is None:
              get_dimension = self.model.get_sentence_embedding_dimension
          dim = get_dimension()
          if dim is None:
              raise ValueError(f"Could not determine embedding dimension for {model_name}")
          self.dim = dim

      def embed_documents(self, texts: list[str]) -> list[list[float]]:
          if not texts:
              return []
          vectors = self.model.encode(
              texts,
              batch_size=self.batch_size,
              convert_to_numpy=True,
              normalize_embeddings=True,
              show_progress_bar=False,
          )
          return vectors.tolist()

      def embed_query(self, text: str) -> list[float]:
          vector = self.model.encode(
              f"{self.query_prefix}{text}",
              convert_to_numpy=True,
              normalize_embeddings=True,
              show_progress_bar=False,
          )
          return vector.tolist()


def build_embedder(settings: Settings) -> Embedder:
    if settings.embedder == "bge":
        return SentenceTransformerEmbedder()
    from app.dev.hash_embedder import HashEmbedder

    return HashEmbedder()
