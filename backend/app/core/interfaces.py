"""SHARED CONTRACT (frozen): the seams between layers.

Each layer codes against these Protocols, never against another layer's internals:

    reasoning/  --uses-->  Retriever, LLM
    knowledge/  --implements-->  Retriever, Ingestor, ChunkStore, Embedder
    llm/        --implements-->  LLM

That is what lets the two owners work independently: the reasoning side runs on the
in-memory store + keyword retriever until the knowledge side ships the real ones.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Literal, Protocol

from pydantic import BaseModel

from app.core.schemas import Chunk, Document, ScoredChunk

LLMRole = Literal["main", "fast", "judge"]


class LLMResult(BaseModel):
    text: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cached: bool = False


class LLM(Protocol):
    """Chat-completion client. `role` picks the model: main=answers, fast=cheap steps
    (query rewrite, claim splitting), judge=evals/verification (a different model family)."""

    def complete(
        self,
        messages: list[dict],
        *,
        role: LLMRole = "main",
        temperature: float = 0.0,
        max_tokens: int = 1024,
        json_mode: bool = False,
    ) -> LLMResult: ...

    def stream(
        self,
        messages: list[dict],
        *,
        role: LLMRole = "main",
        temperature: float = 0.0,
        max_tokens: int = 1024,
    ) -> Iterator[str]: ...


class Embedder(Protocol):
    dim: int

    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class ChunkStore(Protocol):
    """Persistence for documents + chunks (+ embeddings). Implementations: MemoryStore, MongoStore."""

    def put_document(self, doc: Document) -> None: ...

    def update_document(self, doc_id: str, **fields) -> None: ...

    def get_document(self, doc_id: str) -> Document | None: ...

    def list_documents(self) -> list[Document]: ...

    def delete_document(self, doc_id: str) -> None:
        """Remove the document AND all of its chunks."""
        ...

    def upsert_chunks(self, chunks: list[Chunk]) -> None: ...

    def get_chunks(self, chunk_ids: list[str]) -> list[Chunk]: ...

    def get_page_chunks(self, doc_id: str, page: int) -> list[Chunk]: ...

    def vector_search(
        self, embedding: list[float], doc_ids: list[str], k: int
    ) -> list[ScoredChunk]:
        """Nearest chunks by cosine similarity, restricted to doc_ids. source='vector'."""
        ...

    def text_search(self, query: str, doc_ids: list[str], k: int) -> list[ScoredChunk]:
        """Lexical (BM25-style) search, restricted to doc_ids. source='bm25'."""
        ...


class Retriever(Protocol):
    def retrieve(self, query: str, doc_ids: list[str], k: int = 8) -> list[ScoredChunk]:
        """Best-first list of at most k chunks. Must never raise on an empty result."""
        ...


class Ingestor(Protocol):
    def ingest(self, doc_id: str, pdf_bytes: bytes, filename: str) -> Document:
        """Parse -> chunk -> embed -> store. Runs in a background task.

        The Document row already exists with status='processing'; the ingestor must
        finish by setting status='ready' (plus n_pages / n_chunks) or status='failed'
        (plus error) via store.update_document, and return the final Document.
        """
        ...
