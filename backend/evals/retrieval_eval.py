"""PARTNER-OWNED retrieval eval (task P9). Runs from backend/:

    python -m evals.retrieval_eval --dataset evals/dataset/demo.jsonl
    RETRIEVER=real EMBEDDER=bge python -m evals.retrieval_eval --label hybrid

Writes evals/results/retrieval_<label>.json, which the dashboard page can display.
TODO(P9): ablation runner over [vector-only, bm25-only, hybrid, hybrid+rerank] and over
chunk sizes / embedding models; matplotlib chart saved to docs/.
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from evals.metrics import recall_at_k, reciprocal_rank

RESULTS = Path(__file__).parent / "results"


def run(dataset: Path, label: str, ks: tuple[int, ...] = (1, 3, 5)) -> dict:
    from app.deps import get_retriever, get_store  # after env is set

    get_store()  # loads the demo fixture when STORE=memory
    retriever = get_retriever()
    rows = [json.loads(line) for line in dataset.read_text().splitlines() if line.strip()]
    rows = [r for r in rows if r["gold_pages"]]  # answerable rows only

    per_k = {k: [] for k in ks}
    rr: list[float] = []
    for r in rows:
        hits = retriever.retrieve(r["question"], [r["doc_id"]], k=max(ks))
        pages = [h.chunk.page for h in hits]
        for k in ks:
            per_k[k].append(recall_at_k(pages, r["gold_pages"], k))
        rr.append(reciprocal_rank(pages, r["gold_pages"]))

    n = len(rows) or 1
    result = {
        "label": label,
        "kind": "retrieval",
        "n_questions": len(rows),
        **{f"recall@{k}": round(sum(v) / n, 3) for k, v in per_k.items()},
        "mrr": round(sum(rr) / n, 3),
        "created_at": datetime.now(UTC).isoformat(),
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / f"retrieval_{label}.json").write_text(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", type=Path, default=Path("evals/dataset/demo.jsonl"))
    ap.add_argument("--label", default="baseline")
    args = ap.parse_args()
    print(json.dumps(run(args.dataset, args.label), indent=2))
