"""In-memory ChunkStore. Complete and working: used for dev, tests and as the reference
implementation that MongoStore must behave like (see tests/knowledge/test_store_contract.py)."""

from __future__ import annotations

import math
import re
from collections import Counter

import numpy as np

from app.core.schemas import Chunk, Document, ScoredChunk

_TOKEN = re.compile(r"[a-z0-9]+")
_STOP = frozenset(
    "a an and are as at be by for from how in is it of on or the this that to was were what "
    "when where which who why with does do did you your their its into than then".split()
)


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in _STOP]


class MemoryStore:
    def __init__(self) -> None:
        self._docs: dict[str, Document] = {}
        self._chunks: dict[str, Chunk] = {}

    # ---- documents
    def put_document(self, doc: Document) -> None:
        self._docs[doc.id] = doc

    def update_document(self, doc_id: str, **fields) -> None:
        self._docs[doc_id] = self._docs[doc_id].model_copy(update=fields)

    def get_document(self, doc_id: str) -> Document | None:
        return self._docs.get(doc_id)

    def list_documents(self) -> list[Document]:
        return sorted(self._docs.values(), key=lambda d: d.created_at, reverse=True)

    def delete_document(self, doc_id: str) -> None:
        self._docs.pop(doc_id, None)
        for cid in [c for c, ch in self._chunks.items() if ch.doc_id == doc_id]:
            del self._chunks[cid]

    # ---- chunks
    def upsert_chunks(self, chunks: list[Chunk]) -> None:
        for c in chunks:
            self._chunks[c.id] = c

    def get_chunks(self, chunk_ids: list[str]) -> list[Chunk]:
        return [self._chunks[i] for i in chunk_ids if i in self._chunks]

    def get_page_chunks(self, doc_id: str, page: int) -> list[Chunk]:
        found = [c for c in self._chunks.values() if c.doc_id == doc_id and c.page == page]
        return sorted(found, key=lambda c: c.ord)

    def _candidates(self, doc_ids: list[str]) -> list[Chunk]:
        wanted = set(doc_ids)
        return [c for c in self._chunks.values() if c.doc_id in wanted]

    # ---- search
    def vector_search(
        self, embedding: list[float], doc_ids: list[str], k: int
    ) -> list[ScoredChunk]:
        cands = [c for c in self._candidates(doc_ids) if c.embedding is not None]
        if not cands:
            return []
        q = np.asarray(embedding, dtype=float)
        q = q / (np.linalg.norm(q) or 1.0)
        mat = np.asarray([c.embedding for c in cands], dtype=float)
        mat = mat / np.clip(np.linalg.norm(mat, axis=1, keepdims=True), 1e-12, None)
        sims = mat @ q
        order = np.argsort(-sims)[:k]
        return [ScoredChunk(chunk=cands[i], score=float(sims[i]), source="vector") for i in order]

    def text_search(self, query: str, doc_ids: list[str], k: int) -> list[ScoredChunk]:
        """BM25 over the candidate chunks (k1=1.5, b=0.75)."""
        cands = self._candidates(doc_ids)
        q_terms = set(tokenize(query))
        if not cands or not q_terms:
            return []
        docs = [Counter(tokenize(c.text)) for c in cands]
        lengths = [sum(d.values()) for d in docs]
        avg_len = (sum(lengths) / len(lengths)) or 1.0
        n = len(cands)
        scored: list[ScoredChunk] = []
        for chunk, tf, length in zip(cands, docs, lengths):
            score = 0.0
            for term in q_terms:
                f = tf.get(term, 0)
                if not f:
                    continue
                df = sum(1 for d in docs if term in d)
                idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
                score += idf * f * 2.5 / (f + 1.5 * (0.25 + 0.75 * length / avg_len))
            if score > 0:
                scored.append(ScoredChunk(chunk=chunk, score=score, source="bm25"))
        scored.sort(key=lambda s: s.score, reverse=True)
        return scored[:k]
