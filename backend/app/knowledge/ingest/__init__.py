"""PARTNER ENTRY POINT #3. Public factory the app calls; keep the signature."""

from __future__ import annotations

from app.config import Settings
from app.core.interfaces import ChunkStore, Ingestor


def build_ingestor(store: ChunkStore, settings: Settings) -> Ingestor:
    if settings.ingestor == "real":
        from app.knowledge.embed import build_embedder
        from app.knowledge.ingest.pipeline import IngestPipeline

        return IngestPipeline(store=store, embedder=build_embedder(settings))
    from app.dev.fake_ingestor import FakeIngestor

    return FakeIngestor(store)
