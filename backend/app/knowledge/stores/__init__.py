"""PARTNER ENTRY POINT #1. Public factory the app calls; keep the signature."""

from __future__ import annotations

from app.config import Settings
from app.core.interfaces import ChunkStore
from app.knowledge.stores.memory import MemoryStore


def build_store(settings: Settings) -> ChunkStore:
    if settings.store == "mongo":
        from app.knowledge.stores.mongo import MongoStore

        return MongoStore(settings.mongo_uri, settings.mongo_db)
    return MemoryStore()
