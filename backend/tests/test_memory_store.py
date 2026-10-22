from app.dev.hash_embedder import HashEmbedder


def test_text_search_finds_the_right_passage(store, demo_id):
    hits = store.text_search("how many attention heads in the base model", [demo_id], k=3)
    assert hits and hits[0].chunk.page == 5 and hits[0].source == "bm25"


def test_text_search_respects_doc_filter(store):
    assert store.text_search("attention heads", ["some-other-doc"], k=3) == []


def test_vector_search_roundtrip(store, demo_id):
    emb = HashEmbedder()
    chunks = store.get_page_chunks(demo_id, 5)
    store.upsert_chunks(
        [c.model_copy(update={"embedding": emb.embed_documents([c.text])[0]}) for c in chunks]
    )
    hits = store.vector_search(emb.embed_query("multi-head attention heads"), [demo_id], k=2)
    assert hits and hits[0].source == "vector"
    assert hits[0].chunk.page == 5


def test_delete_removes_chunks(store, demo_id):
    store.delete_document(demo_id)
    assert store.get_document(demo_id) is None
    assert store.get_page_chunks(demo_id, 5) == []
