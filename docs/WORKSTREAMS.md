# Workstreams, tasks and milestones

Two tracks, one contract. Track A = **you** (frontend + API + reasoning). Track B = **partner**
(knowledge layer; detailed tasks in `PARTNER_GUIDE.md`).

## Milestones (the only points where the tracks touch)

| | What lands | Who | Then flip |
|---|---|---|---|
| **M0** | Repo, contracts, mocks, CI (this commit) | done | n/a |
| **M1** | Both can run everything locally against mocks | done | n/a |
| **M2** | Real ingestion: PDF → chunks (+embeddings) in Mongo (P2-P6) | partner | `INGESTOR=real STORE=mongo EMBEDDER=bge` |
| **M3** | Real retrieval: hybrid + rerank (P7) | partner | `RETRIEVER=real` |
| **M4** | Verifier + abstention + real LLM wired (R1-R6) | you | `LLM_PROVIDER=openai_compat` |
| **M5** | Shared eval dataset + both eval reports + ablation charts | both | n/a |
| **M6** | Deployed demo + README with charts + demo video | both | n/a |

Because each side has a working stand-in for the other, M2/M3 and M4 can happen in any order.

## Track A: you (with Claude)

**Frontend (F)**
- F1 Replace the v0 `App.tsx`: proper layout, document sidebar, chat, markdown rendering
- F2 PDF viewer (pdf.js / react-pdf): click a citation → open the page and highlight the quote
- F3 Claim-level view: colour each claim (green/yellow/red), confidence badge, "show evidence" drawer
- F4 Modes UI (answer / teacher / fact-check), abstention styling
- F5 Eval dashboard page (reads `GET /api/eval/latest?kind=retrieval|answer`)
- F6 Loading, error and empty states; mobile layout

**API (A)**
- A1 Persist conversations in Mongo; `GET /api/conversations`
- A2 Rate limiting + upload limits + CORS for the deployed origin
- A3 Move ingestion off `BackgroundTasks` if needed (worker thread/queue) once real PDFs are slow

**Reasoning (R)**: each step is a row in the answer-eval ablation
- R1 Real LLM wired (Groq/OpenRouter/Ollama), prompts tuned, streaming verified
- R2 Quote-then-answer + verbatim check (`citations.py`)
- R3 Claim verifier with the *judge* model (`verifier.py`) → statuses + `Answer.confidence`
- R4 Calibrated abstention (retrieval scores + verifier support)
- R5 Query rewrite/decomposition and the sufficiency→re-retrieve loop (`agent.py`)
- R6 Teacher + fact-check modes done properly (verdict parsing, quiz generation)
- R7 `answer_eval.py`: LLM-judge correctness/faithfulness, citation precision, hallucination rate,
  abstention precision/recall, cost, latency; ablation table + chart

## Track B: partner

P1-P9 in `docs/PARTNER_GUIDE.md`.

## Shared

- **Eval dataset** (`backend/evals/dataset/`): partner leads labelling (3-5 papers, ≥ 40 Qs, ~25% unanswerable
  or false-premise), you review every label and add adversarial/multi-hop questions. One dataset, two eval
  scripts, each owner reports their own ablation.
- **Contract changes**: PR touching `core/` or `contracts/` → both approve. Prefer adding optional fields.

## Working agreement

- `main` is always green. Branch `a/<topic>` or `b/<topic>`, small PRs, squash-merge.
- Don't edit the other track's directories; ask in the PR/issue instead (CODEOWNERS enforces review).
- Weekly 20-minute sync: demo what changed, flip any env switch that's ready, agree on the next milestone.
- Secrets: only in `.env` (git-ignored). Never paste keys in issues or PRs.
