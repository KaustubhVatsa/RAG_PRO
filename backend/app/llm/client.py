"""LLM clients. One OpenAI-compatible client covers every free/open-model provider
(Groq, OpenRouter, Cerebras, Google AI Studio, Ollama...): only base_url/key/model differ."""

from __future__ import annotations

import hashlib
import json
import threading
import time
from collections.abc import Iterator
from pathlib import Path

from app.config import Settings
from app.core.interfaces import LLM, LLMResult, LLMRole


class DiskCache:
    """Tiny JSON-file cache keyed by request hash. Free tiers are rate-limited; evals
    re-run the same prompts constantly, so caching them is the difference between
    'works' and '429 all night'."""

    def __init__(self, directory: Path):
        self.dir = directory
        self.dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def key(**parts) -> str:
        return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()

    def get(self, key: str) -> dict | None:
        path = self.dir / f"{key}.json"
        return json.loads(path.read_text()) if path.exists() else None

    def put(self, key: str, value: dict) -> None:
        (self.dir / f"{key}.json").write_text(json.dumps(value))


class Throttle:
    """Spaces calls at least 60/rpm seconds apart. Thread-safe: the claim judge runs several
    calls at once, and they must share one budget."""

    def __init__(self, rpm: int):
        self.interval = 60.0 / rpm
        self._lock = threading.Lock()
        self._next = 0.0

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            start = max(now, self._next)
            self._next = start + self.interval
        if start > now:
            time.sleep(start - now)


class OpenAICompatLLM:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._clients: dict[tuple, object] = {}
        self._throttles = {
            role: Throttle(rpm) for role in ("main", "fast", "judge") if (rpm := settings.rpm(role))
        }
        self._cache = DiskCache(settings.data_dir / "llm_cache") if settings.llm_cache else None

    def _client(self, role: LLMRole):
        from openai import OpenAI  # imported lazily so mock-only dev needs no network deps

        base_url, api_key, model = self.settings.role_config(role)
        if not api_key and "localhost" not in (base_url or ""):
            raise RuntimeError(
                f"No API key for LLM role '{role}'. Set LLM_API_KEY (and LLM_BASE_URL) in .env "
                "or use LLM_PROVIDER=mock. See docs/LLM_PROVIDERS.md."
            )
        ident = (base_url, api_key)
        if ident not in self._clients:
            # max_retries gives exponential backoff on 429/5xx, which free tiers hit often
            self._clients[ident] = OpenAI(
                base_url=base_url, api_key=api_key or "ollama", max_retries=4, timeout=60
            )
        return self._clients[ident], model

    def _pace(self, role: LLMRole) -> None:
        if role in self._throttles:
            self._throttles[role].wait()

    def _extra(self, role: LLMRole) -> dict:
        effort = self.settings.reasoning_effort(role)
        return {"reasoning_effort": effort} if effort else {}

    def complete(
        self,
        messages: list[dict],
        *,
        role: LLMRole = "main",
        temperature: float = 0.0,
        max_tokens: int = 1024,
        json_mode: bool = False,
    ) -> LLMResult:
        client, model = self._client(role)
        cache_key = None
        if self._cache:
            cache_key = DiskCache.key(
                model=model, messages=messages, t=temperature, m=max_tokens, j=json_mode
            )
            hit = self._cache.get(cache_key)
            if hit:
                return LLMResult(**hit, cached=True)

        kwargs: dict = self._extra(role)
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        self._pace(role)  # after the cache check: cache hits cost no quota
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )
        usage = resp.usage
        result = LLMResult(
            text=resp.choices[0].message.content or "",
            model=model,
            input_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            output_tokens=getattr(usage, "completion_tokens", 0) or 0,
        )
        if self._cache and cache_key:
            self._cache.put(cache_key, result.model_dump(exclude={"cached"}))
        return result

    def stream(
        self,
        messages: list[dict],
        *,
        role: LLMRole = "main",
        temperature: float = 0.0,
        max_tokens: int = 1024,
    ) -> Iterator[str]:
        client, model = self._client(role)
        self._pace(role)
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **self._extra(role),
        )
        for event in resp:
            if event.choices and event.choices[0].delta.content:
                yield event.choices[0].delta.content


def build_llm(settings: Settings) -> LLM:
    if settings.llm_provider == "openai_compat":
        return OpenAICompatLLM(settings)
    from app.llm.mock import MockLLM

    return MockLLM()
