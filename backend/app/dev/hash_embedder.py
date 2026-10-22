"""Deterministic bag-of-words hashing embedder: no model download, good enough to test
plumbing (store.vector_search, hybrid fusion) offline. NOT for quality numbers."""

from __future__ import annotations

import hashlib

import numpy as np

from app.knowledge.stores.memory import tokenize


class HashEmbedder:
    def __init__(self, dim: int = 256):
        self.dim = dim

    def _embed(self, text: str) -> list[float]:
        vec = np.zeros(self.dim)
        for tok in tokenize(text):
            h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
            vec[h % self.dim] += 1.0 if (h >> 64) & 1 else -1.0
        norm = np.linalg.norm(vec)
        return (vec / norm if norm else vec).tolist()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)
