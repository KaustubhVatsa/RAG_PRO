"""Claim-level verification: the project's differentiator.

For every sentence of the answer we decide: supported / unsupported / contradicted / unverified.
Cheapest, most certain checks run first:

  1. no citation on the sentence      -> 'unverified' (nothing to check it against)
  2. a cited quote failed the verbatim check (R2) -> 'unsupported', no LLM needed
  3. otherwise ask the JUDGE model (R3) to compare the claim with the cited passages
  4. judge failed / unparseable        -> 'unverified' (we never guess)

TODO(reasoning): aggregate to Answer.confidence and abstain when most claims are unsupported (R4).
"""

from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor

from app.core.interfaces import LLM
from app.core.schemas import Citation, Claim, ScoredChunk
from app.reasoning.citations import extract_markers
from app.reasoning.judge import judge_claim

_SENTENCE = re.compile(r"(?<=[.!?])\s+")
_MARKER = re.compile(r"\s*\[\d+\]")


def split_claims(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE.split(text) if s.strip()]


def strip_markers(sentence: str) -> str:
    """'The model uses 8 heads [1].' -> 'The model uses 8 heads.' (the judge doesn't need [n])"""
    return _MARKER.sub("", sentence).strip()


def verify_claims(
    answer_text: str, citations: list[Citation], chunks: list[ScoredChunk], llm: LLM
) -> list[Claim]:
    by_n = {c.n: c for c in citations}
    chunk_text = {sc.chunk.id: sc.chunk.text for sc in chunks}

    def check(sentence: str) -> Claim:
        evidence = [by_n[n] for n in extract_markers(sentence) if n in by_n]
        if not evidence:
            return Claim(text=sentence, status="unverified", note="no citation to check")
        if any(e.verified is False for e in evidence):
            return Claim(
                text=sentence,
                status="unsupported",
                evidence=evidence,
                note="a cited quote was not found verbatim in the source",
            )
        passages = [chunk_text[e.chunk_id] for e in evidence if e.chunk_id in chunk_text]
        verdict = judge_claim(strip_markers(sentence), passages, llm) if passages else None
        if verdict is None:
            return Claim(
                text=sentence,
                status="unverified",
                evidence=evidence,
                note="the judge gave no verdict",
            )
        return Claim(
            text=sentence, status=verdict.status, evidence=evidence, note=verdict.reason or None
        )

    sentences = split_claims(answer_text)
    # One judge call per sentence; they are independent network waits, so run them side by side.
    with ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(check, sentences))
