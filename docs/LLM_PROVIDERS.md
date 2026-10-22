# Free / open-model LLM options

The backend talks to any **OpenAI-compatible** chat endpoint (`app/llm/client.py`), so switching
provider is only `.env` changes (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_*_MODEL`). No code changes.

> Free tiers, rate limits and model ids change often (some models rotate out). Treat the table as a
> starting point and check each provider's current docs and model list before relying on it.

| Provider | Open-weight models | `LLM_BASE_URL` | Notes |
|---|---|---|---|
| **Groq** | Llama 3.x family, others | `https://api.groq.com/openai/v1` | Very fast, free tier with per-minute/day token limits. Best default for `main` + `fast`. |
| **OpenRouter** | many models with a `:free` variant (Llama, Qwen, DeepSeek, Gemma...) | `https://openrouter.ai/api/v1` | One key, many models; free variants are rate-limited and sometimes unavailable. Good for a *different-family judge*. |
| **Google AI Studio** | Gemma (open); Gemini (not open weights) | `https://generativelanguage.googleapis.com/v1beta/openai/` | Generous free tier. Gemini is not open-source but is free and a different family, handy as the judge. |
| **Cerebras** | Llama family | `https://api.cerebras.ai/v1` | Free tier, very fast. |
| **Ollama (local)** | Llama, Qwen, Mistral, Gemma... | `http://localhost:11434/v1` | Fully free and offline, limited by your laptop (7-8B models run fine on 16 GB). No key needed. Great for development without quota worries. |

## Roles

| Role | Used for | Suggestion |
|---|---|---|
| `main` | final answers | a strong 70B-class model (e.g. Llama 3.3 70B on Groq) |
| `fast` | query rewriting, claim splitting | a small 8B model |
| `judge` | claim verification and evals | **a different model family** than `main` (e.g. Gemini Flash via AI Studio, or a Qwen/Gemma model via OpenRouter). A model grades its own family too kindly. |

Per-role overrides: `LLM_JUDGE_BASE_URL`, `LLM_JUDGE_API_KEY`, `LLM_JUDGE_MODEL` (same for `MAIN`, `FAST`).

## Making free tiers last

- `LLM_CACHE=true` caches completions on disk, so re-running an eval costs nothing for unchanged prompts.
- Use the `fast` model for cheap steps; keep `main` for the final answer only.
- Build and debug the pipeline on `LLM_PROVIDER=mock` or local Ollama; save the hosted quota for evals.
- Not every free model supports JSON mode / structured output reliably. `json_mode=True` is a request,
  not a guarantee: parse defensively and retry once on invalid JSON (do this in the verifier).

## Embeddings and reranking are not LLM calls

They run locally with open models (`BAAI/bge-small-en-v1.5`, `BAAI/bge-reranker-base`) via
sentence-transformers: free, no rate limits, no keys.
