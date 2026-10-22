"""Judge eval: can the claim judge tell a supported claim from a hallucinated one?

    python -m evals.judge_eval --label qwen_v1

Unlike answer_eval this does not depend on the answer model at all. Every case is a claim whose
correct label we KNOW (dataset/judge_cases.jsonl, written against the demo fixture passages):
  supported    paraphrases / implications of the evidence
  contradicted the evidence says otherwise (a number or fact was altered)
  unsupported  plausible, sometimes even true in the real world, but NOT in the evidence

Key numbers:
  catch_rate   of the BAD claims (contradicted + unsupported), how many did the judge refuse to
               call 'supported'?   high = few hallucinations slip through
  false_alarm  of the GOOD claims, how many did the judge refuse to call 'supported'?
               high = we withhold good answers
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

from app.core.interfaces import LLM
from app.reasoning.judge import judge_claim

DATASET = Path(__file__).parent / "dataset" / "judge_cases.jsonl"
RESULTS = Path(__file__).parent / "results"
CLASSES = ("supported", "contradicted", "unsupported")


def score(pairs: list[tuple[str, str]]) -> dict:
    """pairs = [(true_label, predicted_label)]; predicted may be 'none' (judge gave no verdict)."""
    n = len(pairs)
    matrix = {t: Counter(p for tt, p in pairs if tt == t) for t in CLASSES}
    bad = [(t, p) for t, p in pairs if t != "supported"]
    good = [(t, p) for t, p in pairs if t == "supported"]
    return {
        "n": n,
        "accuracy": round(sum(t == p for t, p in pairs) / n, 3) if n else None,
        "catch_rate": round(sum(p != "supported" for _, p in bad) / len(bad), 3) if bad else None,
        "false_alarm_rate": (
            round(sum(p != "supported" for _, p in good) / len(good), 3) if good else None
        ),
        "no_verdict": sum(p == "none" for _, p in pairs),
        "confusion": {t: dict(c) for t, c in matrix.items()},
    }


def run(label: str, llm: LLM | None = None) -> dict:
    from app.deps import get_llm
    from app.dev.fixtures import demo_chunks

    llm = llm or get_llm()
    passages = {c.ord: c.text for c in demo_chunks()}
    cases = [json.loads(line) for line in DATASET.read_text().splitlines() if line.strip()]
    pairs, rows = [], []
    for case in cases:
        verdict = judge_claim(case["claim"], [passages[o] for o in case["evidence"]], llm)
        pred = verdict.status if verdict else "none"
        pairs.append((case["label"], pred))
        rows.append({**case, "predicted": pred, "reason": verdict.reason if verdict else None})
        mark = "ok " if pred == case["label"] else "MISS"
        print(
            f"{mark} {case['id']} true={case['label']:<12} pred={pred:<12} {case['claim'][:55]}",
            flush=True,
        )
    result = {
        "label": label,
        "kind": "judge",
        "model": llm_name(),
        **score(pairs),
        "rows": rows,
        "created_at": datetime.now(UTC).isoformat(),
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / f"judge_{label}.json").write_text(json.dumps(result, indent=2))
    return result


def llm_name() -> str:
    from app.deps import get_settings

    return get_settings().role_config("judge")[2]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", default="dev")
    r = run(ap.parse_args().label)
    print(
        f"\nmodel={r['model']}  accuracy={r['accuracy']}  catch_rate={r['catch_rate']}  "
        f"false_alarm_rate={r['false_alarm_rate']}  no_verdict={r['no_verdict']}"
    )
    for t, c in r["confusion"].items():
        print(f"  true {t:<12} -> {c}")
