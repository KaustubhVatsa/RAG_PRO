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
