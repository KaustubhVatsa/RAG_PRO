"""Turn [n] markers in the model's text into Citation objects tied to real chunks."""

from __future__ import annotations

import re

from app.core.schemas import Citation, ScoredChunk

_MARKER = re.compile(r"\[(\d+)\]")


def extract_markers(text: str) -> list[int]:
    seen: list[int] = []
    for m in _MARKER.finditer(text):
        n = int(m.group(1))
        if n not in seen:
            seen.append(n)
    return seen


def build_citations(text: str, chunks: list[ScoredChunk], quote_chars: int = 240) -> list[Citation]:
    """Only markers that point at a real excerpt become citations; invented numbers
    (e.g. [9] when 6 excerpts were given) are dropped.

    TODO(reasoning): v0 uses the start of the chunk as the quote. Next step is quote-then-
    answer: have the model return an exact supporting span and check it appears VERBATIM in
    the chunk (a deterministic, free hallucination detector)."""
    out: list[Citation] = []
    for n in extract_markers(text):
        if 1 <= n <= len(chunks):
            c = chunks[n - 1].chunk
            out.append(
                Citation(
                    n=n, chunk_id=c.id, doc_id=c.doc_id, page=c.page, quote=c.text[:quote_chars]
                )
            )
    return out
