# Architecture

## The three seams

Two people build in parallel because the system is cut at three narrow interfaces
(`backend/app/core/interfaces.py`). Each side codes against the interface and develops against a
stand-in for the other side.

```
                 React UI  (SSE: retrieval → token* → claims → done)
                    │  HTTP, contracts/openapi.yaml
             ┌──────▼───────┐
             │  api/        │  FastAPI routes, upload, SSE framing        [you]
             └──────┬───────┘
             ┌──────▼───────┐        ┌────────────────┐
             │ reasoning/   │──LLM──▶│ llm/           │  OpenAI-compatible client, mock, cache
             │ agent,       │        └────────────────┘
             │ citations,   │
             │ verifier     │                                             [you]
             └──────┬───────┘
                    │ Retriever.retrieve(query, doc_ids, k) → [ScoredChunk]     ◀── SEAM 1
        ════════════╪════════════════════════════════════════════════════════
             ┌──────▼───────┐
             │ knowledge/   │  retrieval: vector + BM25 → RRF → rerank    [partner]
             │ retrieval    │
             └──────┬───────┘
                    │ ChunkStore (vector_search, text_search, CRUD)             ◀── SEAM 2
             ┌──────▼───────┐
             │ stores/      │  MemoryStore (reference) · MongoStore
             └──────▲───────┘
                    │ Ingestor.ingest(doc_id, pdf_bytes, filename)              ◀── SEAM 3
             ┌──────┴───────┐
             │ ingest/      │  parse → chunk → embed → store              [partner]
             └──────────────┘
```

| Seam | Interface | Reasoning side develops against | Knowledge side delivers |
|---|---|---|---|
| 1 | `Retriever` | `dev/SimpleRetriever` (BM25 over the in-memory store) | `HybridRetriever` |
| 2 | `ChunkStore` | `MemoryStore` | `MongoStore` (must pass the same contract tests) |
| 3 | `Ingestor` | `dev/FakeIngestor` (clones the demo fixture) | `IngestPipeline` |

The API layer has no knowledge of which implementation it gets: `app/deps.py` is the one place that
picks, from env switches (`STORE`, `RETRIEVER`, `INGESTOR`, `EMBEDDER`, `LLM_PROVIDER`).

## The answer pipeline (target state; v0 is the first three boxes)

```
question ─▶ rewrite/decompose (fast model) ─▶ retrieve ─▶ enough evidence? ──no──▶ re-query (max 3×)
                                                              │yes
                                                              ▼
                       answer with [n] citations + exact quotes (main model)
                                                              ▼
                       verbatim-quote check (deterministic) ─▶ claim split ─▶ per-claim entailment (judge)
                                                              ▼
                       drop/flag unsupported claims · confidence · abstain if support is low
```

Why it reduces hallucination, by layer:
1. **Retrieval quality** (partner): wrong passages in = wrong answer out.
2. **Grounded prompt + mandatory citations**: the model can't answer without pointing at text.
3. **Verbatim quote check**: a cited quote that isn't literally in the chunk is fabricated. Free and exact.
4. **Claim verification by a different model family**: independent check of each sentence against its evidence.
5. **Abstention**: unsupported answers become "not in this document" instead of confident fiction.

## Data model (MongoDB)

- `documents`: `Document` (`_id` = id)
- `chunks`: `Chunk` incl. `embedding` (`_id` = id); vector index on `embedding`, search index on `text`,
  always filtered by `doc_id`
- (later) `conversations`, `eval_runs`

## Streaming protocol

`POST /api/chat` returns Server-Sent Events: `retrieval` once, `token` repeatedly, `claims` (when the
verifier runs), `done` with the full `Answer`. The UI renders tokens live, then upgrades the text with
claim colours and citation chips when `claims`/`done` arrive.

## Deployment (week 4)

Frontend: Vercel or Cloudflare Pages. Backend: a Hugging Face Space (Docker) because free CPU Spaces give
far more RAM than typical free web hosts, which matters for the embedding and reranker models. DB: Atlas M0.
Verify each provider's current free-tier limits when you get there; they change.
