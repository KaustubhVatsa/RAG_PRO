"""PARTNER TASK P3: ParsedPages -> Chunks.   Tests: tests/knowledge/test_chunk.py

Spec:
  - Section-aware: a heading block starts a new section; chunk.section = latest heading.
  - Greedy-pack paragraphs into chunks of <= max_tokens, with ~overlap_tokens carried over
    from the end of the previous chunk (same section only).
  - A paragraph longer than max_tokens is split on sentence boundaries.
  - chunk.page = page where the chunk STARTS (that is what the citation links to).
  - ids are f"{doc_id}:{ord}", ord = 0,1,2,... in reading order.
  - Never emit empty chunks. Embeddings are NOT set here (the pipeline does that).
Why it matters: chunk size/overlap is the #1 retrieval-quality lever. Make them parameters
so P9 can ablate them.
"""

from __future__ import annotations

from app.core.schemas import Chunk
from app.knowledge.ingest.types import ParsedPage


def count_tokens(text: str) -> int:
    """Cheap approximation (~1.3 tokens per word). Swap for tiktoken if you like."""
    return int(len(text.split()) * 1.3)


def chunk_pages(
    pages: list[ParsedPage],
    doc_id: str,
    max_tokens: int = 400,
    overlap_tokens: int = 60,
) -> list[Chunk]:
    raise NotImplementedError("P3: section-aware chunking")
