"""PARTNER TASK P6: orchestrate parse -> chunk -> embed -> store.

IngestPipeline implements the Ingestor protocol (app/core/interfaces.py). Rules:
  - Runs in a background task; NEVER let an exception escape. On any failure call
    store.update_document(doc_id, status="failed", error=str(e)) and return that Document.
  - On success: embed all chunk texts in batches, set chunk.embedding, upsert, then
    store.update_document(doc_id, status="ready", n_pages=..., n_chunks=...).
  - Idempotent: re-ingesting the same doc_id must not duplicate chunks.
"""

from __future__ import annotations

from app.core.interfaces import ChunkStore, Embedder
from app.core.schemas import Document


class IngestPipeline:
    def __init__(self, store: ChunkStore, embedder: Embedder):
        self.store = store
        self.embedder = embedder

    def ingest(self, doc_id: str, pdf_bytes: bytes, filename: str) -> Document:
        raise NotImplementedError("P6")
