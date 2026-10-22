"""PARTNER TASK P7b: Reciprocal Rank Fusion.   Tests: tests/knowledge/test_fusion.py"""

from __future__ import annotations


def rrf_fuse(rankings: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    """Merge several best-first id lists into one.

    score(id) = sum over rankings containing id of 1 / (k + rank), rank starting at 1.
    Return (id, score) sorted by score descending (ties: keep first-seen order).
    Why RRF: vector scores (cosine) and BM25 scores live on different scales, so we fuse
    on RANKS instead of trying to normalize scores.
    """
    raise NotImplementedError("P7b")
