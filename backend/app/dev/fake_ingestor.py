"""Stand-in Ingestor: ignores the PDF and clones the demo fixture under the new doc id,
so upload -> processing -> ready -> chat works end to end before real ingestion exists."""

from __future__ import annotations

import time

from app.core.interfaces import ChunkStore
from app.core.schemas import Document
from app.dev.fixtures import demo_chunks


class FakeIngestor:
    def __init__(self, store: ChunkStore, delay_s: float = 1.0):
        self.store = store
        self.delay_s = delay_s  # lets the UI show a 'processing' state

    def ingest(self, doc_id: str, pdf_bytes: bytes, filename: str) -> Document:
        time.sleep(self.delay_s)
        chunks = demo_chunks(doc_id)
        self.store.upsert_chunks(chunks)
        self.store.update_document(doc_id, status="ready", n_pages=8, n_chunks=len(chunks))
        return self.store.get_document(doc_id)  # type: ignore[return-value]
