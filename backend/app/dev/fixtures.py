"""Loads the demo fixture (paraphrased 'Attention Is All You Need' passages)."""

from __future__ import annotations

import json
from pathlib import Path

from app.core.interfaces import ChunkStore
from app.core.schemas import Chunk, Document

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "demo_attention_chunks.json"
DEMO_DOC_ID = "demo-attention"


def _raw() -> dict:
    return json.loads(FIXTURE.read_text())


def demo_chunks(doc_id: str = DEMO_DOC_ID) -> list[Chunk]:
    return [
        Chunk(
            id=f"{doc_id}:{i}",
            doc_id=doc_id,
            ord=i,
            **{k: c[k] for k in ("page", "section", "text")},
        )
        for i, c in enumerate(_raw()["chunks"])
    ]


def load_demo(store: ChunkStore) -> Document:
    meta = _raw()["doc"]
    chunks = demo_chunks()
    doc = Document(
        id=DEMO_DOC_ID,
        title=meta["title"],
        filename=meta["filename"],
        status="ready",
        n_pages=meta["n_pages"],
        n_chunks=len(chunks),
    )
    store.put_document(doc)
    store.upsert_chunks(chunks)
    return doc
