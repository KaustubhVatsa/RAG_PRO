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

import time

from pymongo import ASCENDING, DESCENDING, MongoClient, ReplaceOne
from pymongo.operations import SearchIndexModel

from app.core.schemas import Chunk, Document, ScoredChunk


class MongoStore:
    _vector_index_name = "chunks_vector_index"
    _text_index_name = "chunks_text_index"

    def __init__(self, uri: str, db_name: str, embedding_dim: int = 384):
        self.client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        self.db = self.client[db_name]
        self.documents = self.db["documents"]
        self.chunks = self.db["chunks"]
        self.embedding_dim = embedding_dim

        self.chunks.create_index([("doc_id", ASCENDING), ("page", ASCENDING)])
        self.chunks.create_index([("doc_id", ASCENDING), ("ord", ASCENDING)])
        self._ensure_search_index(
            SearchIndexModel(
                {
                    "fields": [
                        {
                            "type": "vector",
                            "path": "embedding",
                            "numDimensions": embedding_dim,
                            "similarity": "cosine",
                        },
                        {"type": "filter", "path": "doc_id"},
                    ]
                },
                name=self._vector_index_name,
                type="vectorSearch",
            )
        )
        self._ensure_search_index(
            SearchIndexModel(
                {
                    "mappings": {
                        "dynamic": False,
                        "fields": {
                            "text": {"type": "string"},
                            "doc_id": {"type": "token"},
                        },
                    }
                },
                name=self._text_index_name,
                type="search",
            )
        )
        self._wait_for_search_indexes()

    def _ensure_search_index(self, model: SearchIndexModel) -> None:
        existing = {index["name"] for index in self.chunks.list_search_indexes()}
        if model.document["name"] not in existing:
            self.chunks.create_search_index(model)

    def _wait_for_search_indexes(self, timeout: float = 60.0) -> None:
        expected = {self._vector_index_name, self._text_index_name}
        deadline = time.monotonic() + timeout
        while True:
            indexes = {index["name"]: index for index in self.chunks.list_search_indexes()}
            if all(
                name in indexes
                and (
                    indexes[name].get("queryable") is True
                    or indexes[name].get("status") in {"READY", "STEADY"}
                )
                for name in expected
            ):
                return
            if time.monotonic() >= deadline:
                raise TimeoutError(f"MongoDB search indexes not ready: {sorted(expected)}")
            time.sleep(0.25)

    @staticmethod
    def _model_to_record(model: Document | Chunk) -> dict:
        record = model.model_dump(mode="python")
        record["_id"] = record.pop("id")
        return record

    @staticmethod
    def _record_to_document(record: dict | None) -> Document | None:
        if record is None:
            return None
        record = dict(record)
        record["id"] = record.pop("_id")
        return Document.model_validate(record)

    @staticmethod
    def _record_to_chunk(record: dict) -> Chunk:
        record = dict(record)
        record["id"] = record.pop("_id")
        return Chunk.model_validate(record)

    def put_document(self, doc: Document) -> None:
        self.documents.replace_one({"_id": doc.id}, self._model_to_record(doc), upsert=True)

    def update_document(self, doc_id: str, **fields) -> None:
        existing = self.get_document(doc_id)
        if existing is None:
            raise KeyError(doc_id)
        updated = existing.model_copy(update=fields)
        self.put_document(updated)

    def get_document(self, doc_id: str) -> Document | None:
        return self._record_to_document(self.documents.find_one({"_id": doc_id}))

    def list_documents(self) -> list[Document]:
        return [
            self._record_to_document(record)
            for record in self.documents.find().sort("created_at", DESCENDING)
        ]

    def delete_document(self, doc_id: str) -> None:
        self.documents.delete_one({"_id": doc_id})
        self.chunks.delete_many({"doc_id": doc_id})

    def upsert_chunks(self, chunks: list[Chunk]) -> None:
        if not chunks:
            return
        operations = [
            ReplaceOne({"_id": chunk.id}, self._model_to_record(chunk), upsert=True)
            for chunk in chunks
        ]
        self.chunks.bulk_write(operations, ordered=False)

    def get_chunks(self, chunk_ids: list[str]) -> list[Chunk]:
        if not chunk_ids:
            return []
        found = {
            record["_id"]: self._record_to_chunk(record)
            for record in self.chunks.find({"_id": {"$in": chunk_ids}})
        }
        return [found[chunk_id] for chunk_id in chunk_ids if chunk_id in found]

    def get_page_chunks(self, doc_id: str, page: int) -> list[Chunk]:
        return [
            self._record_to_chunk(record)
            for record in self.chunks.find({"doc_id": doc_id, "page": page}).sort(
                "ord", ASCENDING
            )
        ]

    def vector_search(
        self, embedding: list[float], doc_ids: list[str], k: int
    ) -> list[ScoredChunk]:
        if not embedding or not doc_ids or k <= 0:
            return []
        cursor = self.chunks.aggregate(
            [
                {
                    "$vectorSearch": {
                        "index": self._vector_index_name,
                        "path": "embedding",
                        "queryVector": embedding,
                        "numCandidates": max(k * 10, k),
                        "limit": k,
                        "filter": {"doc_id": {"$in": doc_ids}},
                    }
                },
                {"$set": {"score": {"$meta": "vectorSearchScore"}}},
            ]
        )
        return [
            ScoredChunk(
                chunk=self._record_to_chunk(record),
                score=float(record["score"]),
                source="vector",
            )
            for record in cursor
        ]

    def text_search(self, query: str, doc_ids: list[str], k: int) -> list[ScoredChunk]:
        if not query.strip() or not doc_ids or k <= 0:
            return []
        cursor = self.chunks.aggregate(
            [
                {
                    "$search": {
                        "index": self._text_index_name,
                        "compound": {
                            "must": [{"text": {"query": query, "path": "text"}}],
                            "filter": [{"in": {"path": "doc_id", "value": doc_ids}}],
                        },
                    }
                },
                {"$limit": k},
                {
                    "$project": {
                        "_id": 1,
                        "doc_id": 1,
                        "ord": 1,
                        "page": 1,
                        "section": 1,
                        "text": 1,
                        "score": {"$meta": "searchScore"},
                    }
                },
            ]
        )
        return [
            ScoredChunk(
                chunk=self._record_to_chunk(record),
                score=float(record["score"]),
                source="bm25",
            )
            for record in cursor
        ]
