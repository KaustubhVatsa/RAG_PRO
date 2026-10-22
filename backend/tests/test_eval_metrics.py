from pathlib import Path

from evals.metrics import recall_at_k, reciprocal_rank
from evals.retrieval_eval import run


def test_metrics():
    assert recall_at_k([3, 5, 7], [5], k=1) == 0.0
    assert recall_at_k([3, 5, 7], [5], k=2) == 1.0
    assert reciprocal_rank([3, 5, 7], [5]) == 0.5
    assert reciprocal_rank([3], [9]) == 0.0


def test_baseline_retrieval_eval_runs_end_to_end(tmp_path, monkeypatch):
    import evals.retrieval_eval as mod

    monkeypatch.setattr(mod, "RESULTS", tmp_path)
    result = run(Path("evals/dataset/demo.jsonl"), "pytest")
    assert result["n_questions"] == 5 and 0.0 <= result["mrr"] <= 1.0
