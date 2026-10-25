"""Contract tests: MemoryStore (reference) always runs; MongoStore runs only when
MONGO_TEST_URI is set (e.g. after `make db`:  MONGO_TEST_URI='mongodb://localhost:27017/?directConnection=true').
PARTNER P5: make the Mongo variant pass; every assertion here is the spec."""

import os
import time
import uuid

import pytest

from app.core.schemas import Chunk, Document
from app.dev.hash_embedder import HashEmbedder
from app.knowledge.stores.memory import MemoryStore


def _stores():
    yield pytest.param(MemoryStore, id="memory")
    uri = os.getenv("MONGO_TEST_URI")
    yield pytest.param(
        lambda: __import__("app.knowledge.stores.mongo", fromlist=["MongoStore"]).MongoStore(
            uri, f"verity_test_{uuid.uuid4().hex[:6]}", 256
        ),
        id="mongo",
        marks=pytest.mark.skipif(not uri, reason="MONGO_TEST_URI not set"),
    )


@pytest.fixture(params=list(_stores()))
def fresh(request):
    return request.param()


def _seed(store):
    emb = HashEmbedder()
    store.put_document(Document(id="d1", title="T", filename="t.pdf", status="ready"))
    texts = [
        "multi head attention uses eight heads",
        "the optimizer is adam with warmup",
        "bleu score results",
    ]
    store.upsert_chunks(
        [
            Chunk(
                id=f"d1:{i}",
                doc_id="d1",
                ord=i,
                page=i + 1,
                text=t,
                embedding=emb.embed_documents([t])[0],
            )
            for i, t in enumerate(texts)
        ]
    )
    return emb


def _wait_for_search_indexing(store, embedding, query, doc_ids):
    if isinstance(store, MemoryStore):
        return
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        vector_hits = store.vector_search(embedding, doc_ids, k=1)
        text_hits = store.text_search(query, doc_ids, k=1)
        if vector_hits and text_hits:
            return
        time.sleep(0.25)
    raise AssertionError("Atlas Search indexes did not include the upserted chunks in time")


def test_document_crud(fresh):
    _seed(fresh)
    assert fresh.get_document("d1").title == "T"
    fresh.update_document("d1", status="failed", error="boom")
    assert fresh.get_document("d1").status == "failed"
    assert [d.id for d in fresh.list_documents()] == ["d1"]


def test_vector_and_text_search_agree_on_the_obvious_hit(fresh):
    emb = _seed(fresh)
    query_embedding = emb.embed_query("how many attention heads")
    _wait_for_search_indexing(fresh, query_embedding, "attention heads", ["d1"])
    v = fresh.vector_search(query_embedding, ["d1"], k=1)
    t = fresh.text_search("attention heads", ["d1"], k=1)
    assert v[0].chunk.id == t[0].chunk.id == "d1:0"
    assert v[0].source == "vector" and t[0].source == "bm25"


def test_search_is_scoped_to_doc_ids(fresh):
    emb = _seed(fresh)
    assert fresh.vector_search(emb.embed_query("attention"), ["other"], k=3) == []
    assert fresh.text_search("attention", ["other"], k=3) == []


def test_page_lookup_and_delete(fresh):
    _seed(fresh)
    assert [c.id for c in fresh.get_page_chunks("d1", 2)] == ["d1:1"]
    fresh.delete_document("d1")
    assert fresh.get_document("d1") is None and fresh.get_page_chunks("d1", 2) == []
