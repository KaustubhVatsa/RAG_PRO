# Partner guide: the Knowledge layer

You own **everything between a PDF and a list of relevant passages**: parsing, chunking,
embeddings, storage, retrieval, and the retrieval eval. You do not need an LLM, an API key,
the frontend, or the other half's code to do any of it. Read this top to bottom once.

## What you're building (one paragraph)

When someone uploads a paper we must turn it into searchable passages, and when they ask a
question we must return the handful of passages that contain the answer. If retrieval returns
the wrong passages, the LLM either hallucinates or says "I don't know", no matter how good the
prompt is. So retrieval quality sets the ceiling for the whole product, and the numbers you
produce (recall@k, MRR, ablations) are the resume-worthy part of your half.

```
PDF --parse--> pages/blocks --chunk--> Chunks --embed--> vectors --store--> MongoDB
question --embed--> vector --vector search + keyword search--> fuse (RRF) --rerank--> top-k chunks
```

## Get running (10 minutes)

```bash
git clone <repo> && cd verity
make setup                 # backend venv + core deps
make setup-knowledge       # + PyMuPDF, pymongo, sentence-transformers (big download, ~2 GB with torch)
make test                  # expect: passed + several "xfailed" (those are YOUR to-do list)
make eval-retrieval        # baseline numbers on the demo fixture, so you have a score to beat
```

`xfailed` means "a test exists, the feature doesn't yet". When you implement a feature,
**delete the `pytestmark = pytest.mark.xfail(...)` line in that test file**; from then on a
failure is a real failure. Your goal is zero xfails in `tests/knowledge/`.

## Rules of engagement (how we avoid stepping on each other)

1. **Your files:** `backend/app/knowledge/**`, `backend/tests/knowledge/**`,
   `backend/evals/retrieval_eval.py`, `backend/evals/metrics.py`.
2. **Frozen contract:** `backend/app/core/` (`schemas.py`, `interfaces.py`). Code *against* it, don't
   edit it. If you truly need a change, open an issue/PR and tag your partner; it needs both approvals.
3. **Keep the 4 factory functions' signatures:** `build_store`, `build_embedder`, `build_ingestor`,
   `build_retriever`. The app calls only those, so everything else is yours to restructure.
4. `MemoryStore` (`knowledge/stores/memory.py`) is the executable spec for `MongoStore`.
   Don't change its behaviour; read it before writing the Mongo version.
5. Small PRs into `main`, one task each, CI must be green. Commit messages: `P3: section-aware chunker`.

## The switches

Your work becomes live in the app by flipping env vars in `.env`:

| var | `fake` / default (dev double) | yours |
|---|---|---|
| `STORE` | `memory` | `mongo` after P5 |
| `INGESTOR` | `fake` (ignores the PDF) | `real` after P6 |
| `EMBEDDER` | `hash` (offline stub) | `bge` after P4 |
| `RETRIEVER` | `fake` (keyword only) | `real` after P7 |

Your partner develops the answering side against the fake ones, so they are never blocked on you.
When a milestone lands, tell them to flip the switch.

## Tasks, in order

Each task lists the file, what "done" means, and what to read. **Do them in order**, because later
ones depend on earlier ones, but P1 to P4 are independent of P5 (use `MemoryStore` meanwhile).

### P1: Orient (30 min)
Read `core/schemas.py`, `core/interfaces.py`, `knowledge/stores/memory.py`, `dev/fixtures.py` and
the fixture JSON. Run `make eval-retrieval` and note the baseline. **Done when:** you can explain
what a `Chunk` is and why `page` matters (it's what citations link to).

### P2: PDF parsing, `knowledge/ingest/parse.py`
`parse_pdf(bytes, filename) -> ParsedDoc`. Spec is in the file's docstring. Use PyMuPDF
(`import fitz`). **Done when:** `tests/knowledge/test_parse.py` passes *and* you've parsed 3 real
papers (put them in `backend/data/samples/`, not committed) and eyeballed the output.
Gotchas: two-column layouts (block order!), headers/footers repeated on every page, ligatures
(`ﬁ`), hyphenated line breaks, equations turning into garbage. Write down what breaks;
that list is a README section and a stretch goal (Docling/Marker).

### P3: Chunking, `knowledge/ingest/chunk.py`
`chunk_pages(...) -> list[Chunk]`. Spec in the docstring and tests. **Done when:**
`tests/knowledge/test_chunk.py` passes. Why this matters: chunks too small lose context, too large
dilute the embedding and waste LLM tokens. Make `max_tokens`/`overlap_tokens` parameters so P9 can sweep them.

### P4: Embeddings, `knowledge/embed.py`
`SentenceTransformerEmbedder` with `BAAI/bge-small-en-v1.5`. **Done when:** a quick script shows that
`cosine("How many attention heads?", chunk_about_heads)` beats an unrelated chunk, and
`embed_documents` on 200 chunks takes seconds, not minutes (batching, single model load).
Concept: an embedding maps text to a vector so that *similar meaning = nearby vectors*. Query and
document embeddings are produced slightly differently for BGE (see docstring).

### P5: MongoDB store, `knowledge/stores/mongo.py`
```bash
make db        # starts mongodb-atlas-local in docker (supports $vectorSearch and $search)
MONGO_TEST_URI='mongodb://localhost:27017/?directConnection=true' make test
```
**Done when:** the `mongo` variants in `tests/knowledge/test_store_contract.py` pass (same tests that
`MemoryStore` passes). Concepts to learn: vector search indexes (HNSW), `numCandidates`, pre-filtering
by `doc_id`, Atlas Search (Lucene BM25). The index definitions are in the file docstring. Index builds are
asynchronous, so expect a short delay before the first query works.
> The local Atlas image and the Atlas free tier (M0) are the *same* engine, but M0 limits the number of
> search indexes and storage (512 MB). Check the current limits in the Atlas docs before the deploy week.

### P6: Ingest pipeline, `knowledge/ingest/pipeline.py`
Wire P2 to P5: parse, chunk, embed, upsert, then mark the document `ready` (or `failed` with the error;
never raise). **Done when:** `INGESTOR=real EMBEDDER=bge STORE=mongo` and an upload through the API
makes the doc go `processing` to `ready`, and `get_page_chunks` returns text. Add a test with a tiny
generated PDF (see `test_parse.py` for how). **Milestone M2: tell your partner to flip `INGESTOR=real`.**

### P7: Retrieval, `knowledge/retrieval/*`
Order: **7a** `vector.py` + `bm25.py` (thin), **7b** `fusion.py` (pure function, tests exist, quick win),
**7c** `rerank.py` (cross-encoder), **7d** `hybrid.py` (compose them; flags for the ablation).
**Done when:** `RETRIEVER=real` works, `tests/knowledge/test_fusion.py` passes, and the retrieval eval
shows hybrid ≥ the baseline from P1. Concepts: why dense search misses exact terms ("BLEU 28.4", "d_k")
and BM25 misses paraphrases; RRF fuses by rank; a cross-encoder reads query+passage together.
**Milestone M3: tell your partner to flip `RETRIEVER=real`.**

### P8: CLI, `knowledge/cli.py`
`ingest`, `search`, `docs` commands so you can demo and debug without the API. Done when you can
`make cli ARGS="..."` your way through ingest + search on a real paper.

### P9: Retrieval eval + ablations, `evals/retrieval_eval.py`  (the resume centrepiece)
1. **Build the dataset** in the format of `evals/dataset/README.md`: 3-5 real papers, ≥ 40 questions,
   each with `gold_pages` you verified by reading the PDF. Include ~25% `unanswerable`/`false_premise`
   (your partner's answer eval uses them too). Your partner reviews your labels (a second pair of eyes).
2. **Ablation table** (this is what goes on the resume): vector-only, bm25-only, hybrid, hybrid+rerank, then sweep
   chunk size (200/400/800) and embedding model (bge-small vs bge-base vs e5-small).
3. A chart (matplotlib) saved to `docs/` and embedded in the README.
Metrics already implemented in `evals/metrics.py`: recall@k (hit-rate flavour) and MRR at page level.
Consider adding nDCG and a stricter chunk-level metric if you label chunk ids.

### Stretch (pick any, in order of value)
- Equation/table-aware parsing with Docling or Marker, with before/after retrieval numbers.
- "Small-to-big" retrieval: embed small chunks, return the surrounding section.
- Query-time metadata filters (section, page range).
- Contextual chunk headers ("Paper title > Section > text") before embedding; measure the lift.

## Concept cheat-sheet (read these terms up before the matching task)

| term | one-liner |
|---|---|
| Chunking | cutting a document into passages small enough to embed and cite |
| Embedding | a vector for a text; nearby vectors = similar meaning |
| Cosine similarity | angle between two vectors; the standard "how similar" score |
| HNSW | the graph index that makes nearest-neighbour search fast (approximate) |
| BM25 | classic keyword scoring (term frequency × rarity, length-normalised) |
| RRF | Reciprocal Rank Fusion: merge rankings by `Σ 1/(k+rank)` |
| Bi-encoder vs cross-encoder | embed separately (fast) vs read together (accurate, slow) |
| recall@k / MRR | did a right passage show up in the top k / how high was the first one |

## Definition of done for your half
- [ ] Upload a real PDF in the UI → ready, with sensible chunks and page numbers
- [ ] `RETRIEVER=real` beats the keyword baseline on your eval set; table + chart in the README
- [ ] Zero xfail markers left in `tests/knowledge/`; CI green
- [ ] You can whiteboard the pipeline and justify every choice (chunk size, k, RRF, reranker). That's the interview.
