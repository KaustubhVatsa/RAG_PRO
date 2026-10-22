"""PARTNER spec for P7b."""

import pytest

from app.knowledge.retrieval.fusion import rrf_fuse

pytestmark = pytest.mark.xfail(
    raises=NotImplementedError, reason="P7b not implemented", strict=False
)


def test_rrf_orders_by_combined_rank():
    fused = rrf_fuse([["a", "b", "c"], ["b", "c", "a"]], k=60)
    assert [i for i, _ in fused] == ["b", "a", "c"]
    assert fused[0][1] == pytest.approx(1 / 62 + 1 / 61)


def test_rrf_includes_items_from_only_one_list():
    fused = dict(rrf_fuse([["a"], ["b"]]))
    assert set(fused) == {"a", "b"}


def test_rrf_empty():
    assert rrf_fuse([]) == []
