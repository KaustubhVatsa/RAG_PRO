"""R4: from per-claim verdicts to ONE number for the whole answer, and a decision.

R4.1  answer_confidence(claims)   -> float | None      (done)
R4.2  should_abstain(claims, ...) -> bool + reason
R4.3  wire both into agent.answer_stream
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.schemas import Claim


def answer_confidence(claims: list[Claim]) -> float | None:
    """How much of this answer did the judge actually back up? A number from 0.0 to 1.0.

    Rules (see tests/test_confidence.py):
      - Only claims the judge ruled on count: supported, unsupported, contradicted.
      - 'unverified' claims are IGNORED: we couldn't check them, which is not the same as failing.
      - confidence = (number supported) / (number ruled on)
      - If nothing was ruled on (no claims, or all unverified), return None: "no opinion".
        Never return 0.0 or 1.0 for "we don't know".
    """
    ruled_on = [c for c in claims if c.status != "unverified"]
    if not ruled_on:
        return None
    supported = sum(1 for c in ruled_on if c.status == "supported")
    return supported / len(ruled_on)


@dataclass(frozen=True)
class AbstainDecision:
    abstain: bool
    reason: str | None = None


def should_abstain(claims: list[Claim], threshold: float = 0.5) -> AbstainDecision:
    """Decide whether to withhold an answer instead of showing it.

    Two rules, strongest first:
      1. HARD STOP: any 'contradicted' claim. The model asserted something its own cited source
         says is false. That is a hallucination, and a good average score must not hide it.
      2. SOFT RULE: confidence below `threshold` means most checked claims lack support.

    No opinion (confidence is None) never causes an abstention: if the judge was down or
    rate-limited, we show the answer with its claims marked 'unverified' instead of punishing it.
    """
    if any(c.status == "contradicted" for c in claims):
        return AbstainDecision(True, "a claim is contradicted by the source it cites")
    confidence = answer_confidence(claims)
    if confidence is not None and confidence < threshold:
        return AbstainDecision(True, f"only {confidence:.0%} of the checked claims are supported")
    return AbstainDecision(False)
