"""R4.1 spec for reasoning/confidence.answer_confidence."""

import pytest

from app.core.schemas import Claim
from app.reasoning.confidence import answer_confidence


def c(status):
    return Claim(text="x", status=status)


def test_all_supported_is_one():
    assert answer_confidence([c("supported"), c("supported")]) == 1.0


def test_none_supported_is_zero():
    assert answer_confidence([c("unsupported"), c("contradicted")]) == 0.0


def test_mixed_is_the_fraction_supported():
    assert answer_confidence([c("supported"), c("supported"), c("contradicted")]) == pytest.approx(
        2 / 3
    )


def test_unverified_claims_are_ignored_not_counted_as_failures():
    assert answer_confidence([c("supported"), c("unverified"), c("unverified")]) == 1.0


def test_no_opinion_when_nothing_was_ruled_on():
    assert answer_confidence([]) is None
    assert answer_confidence([c("unverified")]) is None
