"""Step 1 spec for reasoning/judge.parse_verdict. Make these pass, one at a time."""

import pytest

from app.reasoning.judge import Verdict, parse_verdict


def test_clean_json():
    v = parse_verdict('{"verdict": "supported", "reason": "the excerpt says h=8"}')
    assert v == Verdict(status="supported", reason="the excerpt says h=8")


def test_json_inside_markdown_fences():
    raw = '```json\n{"verdict": "contradicted", "reason": "excerpt says 8, claim says 16"}\n```'
    assert parse_verdict(raw).status == "contradicted"


def test_chatter_before_and_after_the_json():
    raw = 'Sure! Here is my assessment:\n{"verdict": "unsupported", "reason": "not mentioned"}\nHope that helps.'
    assert parse_verdict(raw).status == "unsupported"


def test_verdict_is_case_and_whitespace_insensitive():
    assert parse_verdict('{"verdict": "  Supported ", "reason": "x"}').status == "supported"


def test_missing_reason_defaults_to_empty():
    assert parse_verdict('{"verdict": "supported"}').reason == ""


def test_braces_in_the_chatter_before_the_json():
    raw = 'Use {braces} like so: {"verdict":"supported", "reason":"ok"}'
    assert parse_verdict(raw).status == "supported"


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "I think it is supported.",  # prose, no JSON
        '{"verdict": "maybe", "reason": "dunno"}',  # not one of our three statuses
        '{"reason": "forgot the verdict"}',
        '{"verdict": "supported", ',  # truncated JSON
    ],
)
def test_garbage_raises_value_error(raw):
    # Fail CLOSED: we never guess a verdict. The caller decides whether to retry.
    with pytest.raises(ValueError):
        parse_verdict(raw)
