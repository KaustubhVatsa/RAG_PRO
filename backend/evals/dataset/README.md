# Eval dataset format (JSONL, one question per line)

| field | meaning |
|---|---|
| `id` | unique id |
| `doc_id` | document the question is about (must be ingested first; `demo-attention` is built in) |
| `type` | `answerable` \| `multihop` \| `unanswerable` \| `false_premise` |
| `question` | the user question |
| `gold_answer` | reference answer; `null` for `unanswerable` |
| `gold_pages` | 1-based pages that contain the evidence; `[]` for `unanswerable` |

Why the types matter: `unanswerable` and `false_premise` rows measure whether the system
**abstains / pushes back** instead of hallucinating. A system that answers everything scores
100% on answerable rows and 0% here.

Target for the real dataset: 3-5 papers, >= 40 questions, ~25% unanswerable/false-premise.
Label by hand; it is tedious and it is the most valuable part of the project.
