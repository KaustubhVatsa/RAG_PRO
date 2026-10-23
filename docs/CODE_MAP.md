# Code map: what we wrote and where

Paths are relative to `backend/` unless noted. "Yours" = the reasoning / API / UI track.

## The path of one question, with the file for each step

```
POST /api/chat                          app/api/chat.py          validates, then streams SSE
  └─ answer_stream()                    app/reasoning/agent.py   the conductor (read this first)
       1 retrieve passages              app/core/interfaces.py   Retriever (the seam); stand-in: app/dev/simple_retriever.py
       2 build the prompt               app/reasoning/prompts.py rules + numbered excerpts
       3 stream the answer              app/llm/client.py        OpenAI-compatible client, retries, pacing, cache
       4 split answer / quotes          app/reasoning/citations.py  split_evidence, normalize_markers
       5 check quotes verbatim          app/reasoning/citations.py  quote_in_chunk, build_citations
       6 judge each claim               app/reasoning/verifier.py + judge.py
       7 confidence + abstain           app/reasoning/confidence.py
       8 send final answer              app/core/schemas.py      Answer, Claim, Citation (the shared shapes)
```

## Reasoning layer (`app/reasoning/`), yours

| File | What it does | Key functions |
|---|---|---|
| `agent.py` | Runs the whole pipeline for one question and yields SSE events (`retrieval`, `token`, `claims`, `done`). | `answer_stream` |
| `prompts.py` | The grounding rules the answer model must follow: use only the excerpts, cite `[n]`, end with an `Evidence:` block of exact quotes, say "I can't find this" if unanswerable. Has the three modes (answer / teacher / fact-check). | `system_prompt`, `format_context` |
| `citations.py` | Everything about citations. Splits the model output into text and quotes; rewrites odd markers like `【1】` to `[1]`; **checks each quote literally appears in the cited passage** (normalising ligatures, quotes, whitespace). | `split_evidence`, `normalize_markers`, `normalize`, `quote_in_chunk`, `build_citations` |
| `judge.py` | The claim judge. `build_judge_messages` writes the prompt (evidence-only rule, fenced untrusted data); `judge_claim` calls the model and retries once if the reply is garbage; `parse_verdict` turns the reply into a `Verdict` and **fails closed**. | `build_judge_messages`, `judge_claim`, `parse_verdict`, `_extract_json_object`, `_defang` |
| `verifier.py` | Decides each sentence's status in order: no citation → `unverified`; failed quote → `unsupported`; otherwise ask the judge (several in parallel); judge failed → `unverified`. | `verify_claims`, `split_claims`, `strip_markers` |
| `confidence.py` | One number per answer (share of judged claims that are supported) and the show / withhold decision (any contradicted claim is a hard stop). | `answer_confidence`, `should_abstain`, `AbstainDecision` |

## Shared contracts (`app/core/`), changing these needs both owners

| File | What it holds |
|---|---|
| `schemas.py` | Every data shape: `Document`, `Chunk`, `ScoredChunk`, `Citation` (with `verified`), `Claim`, `Answer`, the SSE events. The frontend mirrors these in `frontend/src/api/types.ts` and `contracts/openapi.yaml`. |
| `interfaces.py` | The three seams as Python `Protocol`s: `Retriever`, `ChunkStore`, `Ingestor`; plus `LLM` and `Embedder`. |

## LLM plumbing (`app/llm/`, `app/config.py`, `app/deps.py`)

| File | What it does |
|---|---|
| `llm/client.py` | One client for every provider (Groq, OpenRouter, Ollama…). Per-role models (main / fast / judge), retries, **request pacing** (`Throttle`) for free tiers, disk cache, per-role reasoning effort. |
| `llm/mock.py` | Offline stand-in that behaves well (cites real excerpts, quotes verbatim, judge always agrees). Lets the whole app and the tests run with no keys. |
| `config.py` | All settings from `.env`: implementation switches, per-role model/URL/key/effort/rpm. |
| `deps.py` | The one place that decides which implementation backs each seam. |

## Storage (`app/storage/`), yours
`files.py`: where the original PDF bytes live. `FileStore` interface with `LocalFileStore` (a folder) and `GridFSFileStore` (MongoDB GridFS); switch with `FILE_STORE=local|mongo`. The upload route saves the PDF here, the viewer route reads it. Ids are validated so a URL can't escape the folder. See `docs/learning/03-file-storage.md`.

## API (`app/api/`), yours
`documents.py` (upload, list, delete, serve PDF, chunks-by-page), `chat.py` (the streaming endpoint), `sse.py` (event framing), `evals.py` (serves eval results to the dashboard), `health.py`.

## Partner's layer (`app/knowledge/`), stubs + specs, not built yet
`ingest/` (parse, chunk, pipeline), `embed.py`, `retrieval/` (vector, bm25, fusion, rerank, hybrid), `stores/mongo.py`, `cli.py`. `stores/memory.py` is the finished reference store. `app/dev/` holds the stand-ins used until the real parts land.

## Evals (`evals/`)
| File | What it does |
|---|---|
| `answer_eval.py` | **The hallucination test.** Runs every question once and scores two versions of the answer: the raw draft (baseline) and the checked answer (full). Grades with a judge model from a different family. Writes `evals/results/answer_<label>.json`. |
| `dataset/demo_v2.jsonl` | 21 questions: 10 answerable, 2 multi-hop, 5 unanswerable, 4 false-premise (the traps). |
| `retrieval_eval.py`, `metrics.py` | Retrieval recall@k / MRR: the partner's eval. |

## Tests (`tests/`), 70+ checks, all offline
`test_quote_check.py` (R2), `test_verdict_parsing.py`, `test_judge_prompt.py`, `test_judge_claim.py` (R3), `test_confidence.py`, `test_abstain.py` (R4), `test_answer_eval.py` (the eval's own grading), `test_llm_config.py`, `test_agent.py`, `test_api.py`. `conftest.py` pins everything to offline defaults so a local `.env` can never change results.

## Run it
```bash
make test                                   # all offline tests
make api                                    # API (uses .env: real models if configured)
cd backend && .venv/bin/python -m evals.answer_eval --label mytry     # the hallucination test
```

## Docs
`docs/learning/01-verbatim-quotes.md`, `02-claim-judge.md` (concepts), `docs/diagrams/` (pictures), `docs/WORKSTREAMS.md` (tasks), `docs/PARTNER_GUIDE.md`.
