"""Claim-level verification: the project's differentiator.

Pipeline: split answer into atomic claims -> for each, check it against ITS cited chunks
-> status in {supported, unsupported, contradicted}.

v0 (this file): sentence split + citation mapping, everything 'unverified'.
TODO(reasoning), in order:
  1. Verbatim-quote check (deterministic).
  2. LLM-judge entailment per claim (role='judge', json_mode) over the cited chunks only.
  3. Optionally an NLI cross-encoder as a cheaper second opinion.
  4. Aggregate to Answer.confidence; abstain when most claims are unsupported.
"""

from __future__ import annotations

import re

from app.core.interfaces import LLM
from app.core.schemas import Citation, Claim
from app.reasoning.citations import extract_markers

_SENTENCE = re.compile(r"(?<=[.!?])\s+")


def split_claims(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE.split(text) if s.strip()]


def verify_claims(answer_text: str, citations: list[Citation], llm: LLM) -> list[Claim]:
    by_n = {c.n: c for c in citations}
    claims: list[Claim] = []
    for sentence in split_claims(answer_text):
        evidence = [by_n[n] for n in extract_markers(sentence) if n in by_n]
        claims.append(Claim(text=sentence, status="unverified", evidence=evidence))
    return claims
