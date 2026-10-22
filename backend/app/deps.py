"""Dependency wiring: the ONLY place that decides which implementation backs each seam
(driven by env switches in config.py). Singletons, built lazily on first use."""

from __future__ import annotations

from functools import lru_cache

from app.config import Settings
from app.core.interfaces import LLM, ChunkStore, Ingestor, Retriever
from app.knowledge.ingest import build_ingestor
from app.knowledge.retrieval import build_retriever
from app.knowledge.stores import build_store
from app.llm import build_llm


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_store() -> ChunkStore:
    store = build_store(get_settings())
    if get_settings().store == "memory":
        from app.dev.fixtures import load_demo

        load_demo(store)  # so the UI has a document to chat with on first run
    return store


@lru_cache
def get_retriever() -> Retriever:
    return build_retriever(get_store(), get_settings())


@lru_cache
def get_ingestor() -> Ingestor:
    return build_ingestor(get_store(), get_settings())


@lru_cache
def get_llm() -> LLM:
    return build_llm(get_settings())
