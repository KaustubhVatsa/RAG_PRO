"""Citations: turn the model's [n] markers + Evidence quotes into Citation objects, and
CHECK the quotes against the real source text.

The idea (quote-then-answer): a model that must copy an exact phrase from the source can't
easily fake support. And because the check is plain string matching, it is free, instant,
and can't itself hallucinate: unlike asking another LLM "is this right?".
"""

from __future__ import annotations

import re
import unicodedata

from app.core.schemas import Citation, ScoredChunk
from app.reasoning.prompts import EVIDENCE_MARKER

_MARKER = re.compile(r"\[(\d+)\]")
_EVIDENCE_LINE = re.compile(r'^\s*\[(\d+)\]\s*["“”«](.+?)["“”»]\s*\.?\s*$')
_QUOTE_FALLBACK_CHARS = 240


def extract_markers(text: str) -> list[int]:
    """[n] numbers in order of first appearance, de-duplicated."""
    seen: list[int] = []
    for m in _MARKER.finditer(text):
        n = int(m.group(1))
        if n not in seen:
            seen.append(n)
    return seen


def split_evidence(raw: str) -> tuple[str, dict[int, str]]:
    """Split the model output into (answer text, {n: quote}).

    The model was told to end with an "Evidence:" line followed by `[n] "quote"` lines. If the
    marker is missing we return the whole text and no quotes (citations then fall back to
    unverified snippets instead of failing)."""
    idx = raw.rfind(EVIDENCE_MARKER)
    if idx == -1:
        return raw.strip(), {}
    answer, block = raw[:idx].strip(), raw[idx + len(EVIDENCE_MARKER) :]
    quotes: dict[int, str] = {}
    for line in block.splitlines():
        m = _EVIDENCE_LINE.match(line)
        if m:
            quotes[int(m.group(1))] = m.group(2).strip()
    return answer, quotes


def normalize(text: str) -> str:
    """Make two strings comparable: Unicode-normalise (ligatures like 'ﬁ' -> 'fi'), unify
    curly quotes and dashes, lowercase, collapse all whitespace. PDFs are full of these
    differences, and we don't want to call a faithful quote fabricated because of a dash."""
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    text = text.replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", text).strip().casefold()


def quote_in_chunk(quote: str, chunk_text: str) -> bool:
    """Exact (normalised) substring match. Strict on purpose: a paraphrase fails."""
    q = normalize(quote)
    return bool(q) and q in normalize(chunk_text)


def build_citations(
    answer_text: str, quotes: dict[int, str], chunks: list[ScoredChunk]
) -> list[Citation]:
    """One Citation per [n] marker that points at a real excerpt (invented numbers such as
    [9] when 6 excerpts were given are dropped), with `verified` set from the quote check."""
    out: list[Citation] = []
    for n in extract_markers(answer_text):
        if not 1 <= n <= len(chunks):
            continue
        c = chunks[n - 1].chunk
        quote = quotes.get(n)
        if quote is None:
            out.append(
                Citation(
                    n=n,
                    chunk_id=c.id,
                    doc_id=c.doc_id,
                    page=c.page,
                    quote=c.text[:_QUOTE_FALLBACK_CHARS],
                    verified=None,
                )
            )
            continue
        ok = quote_in_chunk(quote, c.text)
        out.append(
            Citation(
                n=n,
                chunk_id=c.id,
                doc_id=c.doc_id,
                page=c.page,
                quote=quote if ok else c.text[:_QUOTE_FALLBACK_CHARS],
                verified=ok,
            )
        )
    return out
