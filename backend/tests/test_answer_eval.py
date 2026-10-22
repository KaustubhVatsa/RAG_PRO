"""The eval harness itself must be trustworthy: test grading rules and summary maths offline."""

from app.llm.mock import MockLLM
from evals.answer_eval import _parse_label, classify, summarize

ANSWERABLE = {"type": "answerable", "question": "q", "gold_answer": "8"}
TRAP = {"type": "unanswerable", "question": "q", "gold_answer": None}
PREMISE = {"type": "false_premise", "question": "q", "gold_answer": "it did not"}


def test_abstaining_is_right_for_traps_and_a_false_refusal_otherwise():
    llm = MockLLM()
    assert classify(TRAP, "x", True, llm) == "correct"
    assert classify(PREMISE, "x", True, llm) == "correct"
    assert classify(ANSWERABLE, "x", True, llm) == "refusal"


def test_parse_label_tolerates_chatter_and_rejects_unknown_labels():
    assert _parse_label('Sure {"label": " Hallucination ", "reason": "x"} done') == "hallucination"
    assert _parse_label('{"label": "maybe"}') is None
    assert _parse_label("no json here") is None


def test_summarize_rates():
    rows = [
        (ANSWERABLE, "correct"),
        (ANSWERABLE, "refusal"),
        (TRAP, "hallucination"),
        (PREMISE, "correct"),
    ]
    s = summarize(rows)
    assert s["n"] == 4 and s["hallucination_rate"] == 0.25
    assert s["trap_hallucination_rate"] == 0.5  # 1 of 2 trap questions
    assert s["answerable_correct_rate"] == 0.5 and s["false_refusal_rate"] == 0.5


def test_judge_eval_score_catch_rate_and_false_alarms():
    from evals.judge_eval import score

    pairs = [
        ("supported", "supported"),
        ("supported", "unsupported"),  # a false alarm
        ("contradicted", "contradicted"),
        ("contradicted", "supported"),  # a hallucination that slipped through
        ("unsupported", "none"),  # judge gave no verdict: counts as NOT caught-as-supported
    ]
    s = score(pairs)
    assert s["false_alarm_rate"] == 0.5
    assert s["catch_rate"] == round(2 / 3, 3)
    assert s["accuracy"] == 0.4 and s["no_verdict"] == 1


def test_judge_cases_reference_real_fixture_passages():
    import json

    from app.dev.fixtures import demo_chunks
    from evals.judge_eval import CLASSES, DATASET

    ords = {c.ord for c in demo_chunks()}
    cases = [json.loads(line) for line in DATASET.read_text().splitlines() if line.strip()]
    assert len(cases) == 30 and all(c["label"] in CLASSES for c in cases)
    assert all(set(c["evidence"]) <= ords for c in cases)
