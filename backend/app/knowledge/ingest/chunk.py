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

import re

from app.core.schemas import Chunk
from app.knowledge.ingest.types import ParsedPage

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


def count_tokens(text: str) -> int:
    """Cheap approximation (~1.3 tokens per word). Swap for tiktoken if you like."""
    return int(len(text.split()) * 1.3)


def _split_words(text: str, max_tokens: int) -> list[str]:
    segments: list[str] = []
    current: list[str] = []
    for word in text.split():
        candidate = " ".join([*current, word])
        if current and count_tokens(candidate) > max_tokens:
            segments.append(" ".join(current))
            current = []
        current.append(word)
    if current:
        segments.append(" ".join(current))
    return segments


def _split_paragraph(text: str, max_tokens: int) -> list[str]:
    if count_tokens(text) <= max_tokens:
        return [text]

    segments: list[str] = []
    current: list[str] = []
    for sentence in (part.strip() for part in _SENTENCE_END.split(text.strip())):
        if not sentence:
            continue
        if count_tokens(sentence) > max_tokens:
            if current:
                segments.append(" ".join(current))
                current = []
            segments.extend(_split_words(sentence, max_tokens))
        elif current and count_tokens(" ".join([*current, sentence])) > max_tokens:
            segments.append(" ".join(current))
            current = [sentence]
        else:
            current.append(sentence)
    if current:
        segments.append(" ".join(current))
    return segments


def _trailing_overlap(words: list[tuple[str, int]], overlap_tokens: int) -> list[tuple[str, int]]:
    overlap: list[tuple[str, int]] = []
    for item in reversed(words):
        candidate = [item, *overlap]
        if count_tokens(" ".join(word for word, _ in candidate)) > overlap_tokens:
            break
        overlap = candidate
    return overlap


def chunk_pages(
    pages: list[ParsedPage],
    doc_id: str,
    max_tokens: int = 400,
    overlap_tokens: int = 60,
) -> list[Chunk]:
    if max_tokens <= 0:
        raise ValueError("max_tokens must be greater than zero")
    if overlap_tokens < 0:
        raise ValueError("overlap_tokens cannot be negative")

    overlap_tokens = min(overlap_tokens, max_tokens)
    chunks: list[Chunk] = []
    current_words: list[tuple[str, int]] = []
    current_section: str | None = None

    def emit() -> None:
        if not current_words:
            return
        text = " ".join(word for word, _ in current_words).strip()
        if text:
            ordinal = len(chunks)
            chunks.append(
                Chunk(
                    id=f"{doc_id}:{ordinal}",
                    doc_id=doc_id,
                    ord=ordinal,
                    page=current_words[0][1],
                    section=current_section,
                    text=text,
                )
            )

    for parsed_page in pages:
        for block in parsed_page.blocks:
            block_text = block.text.strip()
            if block.is_heading:
                emit()
                current_words = []
                current_section = block_text or None
                continue
            if not block_text:
                continue

            for segment in _split_paragraph(block_text, max_tokens):
                segment_words = segment.split()
                current_text = " ".join(word for word, _ in current_words)
                candidate = " ".join(filter(None, (current_text, " ".join(segment_words))))
                if current_words and count_tokens(candidate) > max_tokens:
                    previous_words = current_words
                    emit()
                    current_words = _trailing_overlap(previous_words, overlap_tokens)
                    while current_words:
                        overlap_text = " ".join(word for word, _ in current_words)
                        if (
                            count_tokens(" ".join((overlap_text, " ".join(segment_words))))
                            <= max_tokens
                        ):
                            break
                        current_words.pop(0)

                current_words.extend((word, parsed_page.page) for word in segment_words)

    emit()
    return chunks
