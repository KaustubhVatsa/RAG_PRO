"""REASONING-OWNED answer eval. Runs from backend/:

    python -m evals.answer_eval --label naive_rag

v0 measures abstention behaviour (needs no judge model): on unanswerable / false-premise
rows the system should abstain or push back; on answerable rows it should not abstain.
TODO(reasoning): LLM-judge correctness + faithfulness (role='judge', a different model
family than the generator), citation precision, hallucination rate, cost/latency; then the
ablation: naive -> +quote check -> +claim verifier -> +abstention threshold.
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from app.core.schemas import ChatRequest, DoneEvent
from evals.retrieval_eval import RESULTS


def run(dataset: Path, label: str) -> dict:
    from app.deps import get_llm, get_retriever, get_settings, get_store
    from app.reasoning.agent import answer_stream

    get_store()
    retriever, llm, settings = get_retriever(), get_llm(), get_settings()
    rows = [json.loads(line) for line in dataset.read_text().splitlines() if line.strip()]

    stats = {"answerable": [0, 0], "should_abstain": [0, 0]}  # [correct, total]
    for r in rows:
        req = ChatRequest(question=r["question"], doc_ids=[r["doc_id"]])
        done = None
        for ev in answer_stream(req, retriever, llm, top_k=settings.top_k):
            if isinstance(ev, DoneEvent):
                done = ev
        assert done is not None, "agent stream ended without a DoneEvent"
        should_abstain = r["type"] in ("unanswerable", "false_premise")
        bucket = "should_abstain" if should_abstain else "answerable"
        stats[bucket][1] += 1
        stats[bucket][0] += int(done.answer.abstained == should_abstain)

    result = {
        "label": label,
        "kind": "answer",
        "n_questions": len(rows),
        "abstention_accuracy": {k: round(c / t, 3) if t else None for k, (c, t) in stats.items()},
        "created_at": datetime.now(UTC).isoformat(),
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / f"answer_{label}.json").write_text(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", type=Path, default=Path("evals/dataset/demo.jsonl"))
    ap.add_argument("--label", default="baseline")
    args = ap.parse_args()
    print(json.dumps(run(args.dataset, args.label), indent=2))
