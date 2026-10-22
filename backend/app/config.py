"""Runtime configuration. Everything is an env var (see .env.example); defaults give a
fully offline dev setup: in-memory store, keyword retriever, mock LLM. No keys, no DB."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.interfaces import LLMRole


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    # --- which implementation to use for each seam (the "dev switches")
    store: Literal["memory", "mongo"] = "memory"
    retriever: Literal["fake", "real"] = "fake"
    ingestor: Literal["fake", "real"] = "fake"
    embedder: Literal["hash", "bge"] = "hash"
    llm_provider: Literal["mock", "openai_compat"] = "mock"

    # --- mongo
    mongo_uri: str = "mongodb://localhost:27017/?directConnection=true"
    mongo_db: str = "verity"

    # --- LLM: one shared endpoint, optionally overridden per role
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_main_base_url: str | None = None
    llm_main_api_key: str | None = None
    llm_main_model: str = "openai/gpt-oss-120b"
    llm_fast_base_url: str | None = None
    llm_fast_api_key: str | None = None
    llm_fast_model: str = "openai/gpt-oss-20b"
    llm_judge_base_url: str | None = None
    llm_judge_api_key: str | None = None
    llm_judge_model: str = "gemini-2.5-flash"
    # For 'thinking' models (gpt-oss, Gemini 2.5): low|medium|high (Gemini also 'none'). Thinking
    # tokens count against max_tokens, so leaving this unset can yield an EMPTY reply. Per role,
    # because non-thinking models reject the parameter. Leave unset for those.
    llm_main_reasoning_effort: str | None = None
    llm_fast_reasoning_effort: str | None = None
    llm_judge_reasoning_effort: str | None = None
    llm_cache: bool = False  # disk-cache completions: saves free-tier quota during evals

    # --- app
    data_dir: Path = Path("data")
    top_k: int = 6
    max_upload_mb: int = 25
    cors_origins: str = "http://localhost:5173"

    def reasoning_effort(self, role: LLMRole) -> str | None:
        return getattr(self, f"llm_{role}_reasoning_effort")

    def role_config(self, role: LLMRole) -> tuple[str | None, str | None, str]:
        """(base_url, api_key, model) for a role, falling back to the shared endpoint."""
        base = getattr(self, f"llm_{role}_base_url") or self.llm_base_url
        key = getattr(self, f"llm_{role}_api_key") or self.llm_api_key
        return base, key, getattr(self, f"llm_{role}_model")
