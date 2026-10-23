"""Test config. Env vars beat .env, so pin every switch to its offline default here:
the suite must pass on any machine regardless of the developer's local .env (keys, Mongo...)."""

import os
import tempfile

for _k, _v in {
    "STORE": "memory",
    "RETRIEVER": "fake",
    "INGESTOR": "fake",
    "EMBEDDER": "hash",
    "LLM_PROVIDER": "mock",
    "LLM_CACHE": "false",
    "FILE_STORE": "local",
    "DATA_DIR": tempfile.mkdtemp(prefix="verity-test-"),
}.items():
    os.environ[_k] = _v

import pytest

from app.dev.fixtures import DEMO_DOC_ID, load_demo
from app.knowledge.stores.memory import MemoryStore


@pytest.fixture
def store() -> MemoryStore:
    s = MemoryStore()
    load_demo(s)
    return s


@pytest.fixture
def demo_id() -> str:
    return DEMO_DOC_ID
