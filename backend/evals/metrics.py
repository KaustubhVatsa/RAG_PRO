"""Retrieval metrics at PAGE level (gold evidence is labelled by page)."""

from __future__ import annotations


def recall_at_k(retrieved_pages: list[int], gold_pages: list[int], k: int) -> float:
    """1.0 if any gold page appears in the top-k retrieved chunks' pages, else 0.0
    (hit-rate flavour). Rows with no gold pages are skipped by the caller."""
    return float(bool(set(retrieved_pages[:k]) & set(gold_pages)))


def reciprocal_rank(retrieved_pages: list[int], gold_pages: list[int]) -> float:
    for rank, page in enumerate(retrieved_pages, start=1):
        if page in gold_pages:
            return 1.0 / rank
    return 0.0
