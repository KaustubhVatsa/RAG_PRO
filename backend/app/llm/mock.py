"""Deterministic offline LLM so the whole stack (and the frontend) runs with no API key.

It behaves like a WELL-BEHAVED model: it cites only excerpts that exist in the prompt and
quotes them word for word. Tests that need a misbehaving model define their own (see
tests/test_quote_check.py)."""

from __future__ import annotations

import re
from collections.abc import Iterator

from app.core.interfaces import LLMResult, LLMRole

_ANSWER = (
    "This is a mock answer grounded in the retrieved excerpts [1]. "
    "It also leans on a second passage [2]. "
    "Set LLM_PROVIDER=openai_compat in .env to get real answers."
)
_EXCERPT = re.compile(r"^\[(\d+)\] \(page [^)]*\)\n(.+)$", flags=re.M)


def _first_words(text: str, n: int = 8) -> str:
    return " ".join(text.split()[:n])


def _mock_reply(prompt: str) -> str:
    excerpts = {int(num): body for num, body in _EXCERPT.findall(prompt)}
    answer = _ANSWER
    for n in (1, 2):
        if n not in excerpts:
            answer = answer.replace(f" [{n}]", "")
    lines = [f'[{n}] "{_first_words(excerpts[n])}"' for n in (1, 2) if n in excerpts]
    return answer + ("\n\nEvidence:\n" + "\n".join(lines) if lines else "")


class MockLLM:
    def complete(
        self,
        messages: list[dict],
        *,
        role: LLMRole = "main",
        temperature: float = 0.0,
        max_tokens: int = 1024,
        json_mode: bool = False,
    ) -> LLMResult:
        text = '{"claims": []}' if json_mode else _ANSWER
        return LLMResult(text=text, model="mock")

    def stream(
        self,
        messages: list[dict],
        *,
        role: LLMRole = "main",
        temperature: float = 0.0,
        max_tokens: int = 1024,
    ) -> Iterator[str]:
        prompt = "\n".join(m["content"] for m in messages)
        yield from re.findall(r"\S+\s*", _mock_reply(prompt))
