"""PARTNER TASK P5: MongoDB (Atlas) ChunkStore.   Tests: tests/knowledge/test_store_contract.py

Behave EXACTLY like MemoryStore (read memory.py: it is the executable spec).

Local dev: `make db` starts the `mongodb/mongodb-atlas-local` image, which supports
$vectorSearch and $search locally. Prod: MongoDB Atlas free tier (M0).

Collections: `documents` (use Document.id as _id), `chunks` (use Chunk.id as _id).

Indexes (create idempotently in __init__ via collection.create_search_index):
  - vector index on chunks.embedding:
      {"fields": [
         {"type": "vector", "path": "embedding", "numDimensions": <embedder.dim>, "similarity": "cosine"},
         {"type": "filter", "path": "doc_id"}]}
  - Atlas Search (lexical) index on chunks.text, plus a "token" field for doc_id.
  - normal index on (doc_id, page) and (doc_id, ord).
Queries: aggregation pipelines with $vectorSearch (filter doc_id $in, numCandidates ~10*k)
and $search (compound: text must + filter in doc_id). Project out `embedding` in text
search results and map `score` via {"$meta": "vectorSearchScore"} / "searchScore".
Index builds are asynchronous: after creating them, poll until queryable (or document it).

Gotchas to read about: M0 free tier limits the number of search indexes; documents must
be < 16MB; always filter by doc_id so one user's search never leaks across documents.
"""

from __future__ import annotations

from app.core.schemas import Chunk, Document, ScoredChunk


class MongoStore:
    def __init__(self, uri: str, db_name: str, embedding_dim: int = 384):
        raise NotImplementedError("P5")

    def put_document(self, doc: Document) -> None:
        raise NotImplementedError("P5")

    def update_document(self, doc_id: str, **fields) -> None:
        raise NotImplementedError("P5")

    def get_document(self, doc_id: str) -> Document | None:
        raise NotImplementedError("P5")

    def list_documents(self) -> list[Document]:
        raise NotImplementedError("P5")

    def delete_document(self, doc_id: str) -> None:
        raise NotImplementedError("P5")

    def upsert_chunks(self, chunks: list[Chunk]) -> None:
        raise NotImplementedError("P5")

    def get_chunks(self, chunk_ids: list[str]) -> list[Chunk]:
        raise NotImplementedError("P5")

    def get_page_chunks(self, doc_id: str, page: int) -> list[Chunk]:
        raise NotImplementedError("P5")

    def vector_search(
        self, embedding: list[float], doc_ids: list[str], k: int
    ) -> list[ScoredChunk]:
        raise NotImplementedError("P5")

    def text_search(self, query: str, doc_ids: list[str], k: int) -> list[ScoredChunk]:
        raise NotImplementedError("P5")
