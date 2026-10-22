"""Deterministic offline LLM so the whole stack (and the frontend) runs with no API key."""

from __future__ import annotations

import re
from collections.abc import Iterator

from app.core.interfaces import LLMResult, LLMRole

_CANNED = (
    "This is a mock answer grounded in the retrieved excerpts [1]. "
    "It also leans on a second passage [2]. "
    "Set LLM_PROVIDER=openai_compat in .env to get real answers."
)


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
        text = '{"claims": []}' if json_mode else _CANNED
        return LLMResult(text=text, model="mock")

    def stream(
        self,
        messages: list[dict],
        *,
        role: LLMRole = "main",
        temperature: float = 0.0,
        max_tokens: int = 1024,
    ) -> Iterator[str]:
        # Only cite excerpts that actually exist in the prompt, like a well-behaved model.
        prompt = "\n".join(m["content"] for m in messages)
        available = {int(n) for n in re.findall(r"^\[(\d+)\]", prompt, flags=re.M)}
        text = _CANNED
        for n in (1, 2):
            if n not in available:
                text = text.replace(f" [{n}]", "")
        yield from re.findall(r"\S+\s*", text)
