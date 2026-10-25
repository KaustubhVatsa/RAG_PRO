from __future__ import annotations

import sys
from types import SimpleNamespace

from app.knowledge.embed import SentenceTransformerEmbedder


class FakeEmbeddings:
    def __init__(self, values: list):
        self.values = values

    def tolist(self) -> list:
        return self.values


def test_sentence_transformer_embedder_uses_batched_normalized_vectors(monkeypatch):
    models = []

    class FakeModel:
        def __init__(self, model_name: str):
            self.model_name = model_name
            self.calls = []
            models.append(self)

        def get_sentence_embedding_dimension(self) -> int:
            return 2

        def encode(self, texts, **kwargs):
            self.calls.append((texts, kwargs))
            if isinstance(texts, str):
                return FakeEmbeddings([0.6, 0.8])
            return FakeEmbeddings([[0.6, 0.8] for _ in texts])

    monkeypatch.setitem(
        sys.modules,
        "sentence_transformers",
        SimpleNamespace(SentenceTransformer=FakeModel),
    )

    embedder = SentenceTransformerEmbedder(batch_size=7)
    documents = embedder.embed_documents(["first passage", "second passage"])
    query = embedder.embed_query("find the passage")

    assert embedder.dim == 2
    assert len(models) == 1
    assert models[0].model_name == "BAAI/bge-small-en-v1.5"
    assert documents == [[0.6, 0.8], [0.6, 0.8]]
    assert query == [0.6, 0.8]
    assert models[0].calls[0][1] == {
        "batch_size": 7,
        "convert_to_numpy": True,
        "normalize_embeddings": True,
        "show_progress_bar": False,
    }
    assert models[0].calls[1][0] == (
        "Represent this sentence for searching relevant passages: find the passage"
    )
    assert models[0].calls[1][1]["normalize_embeddings"] is True