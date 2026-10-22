"""R3: the claim JUDGE: asks a model "does this evidence support this claim?".

This file is built in small steps, test-first (see docs/learning/02-claim-judge.md):
  Step 1  parse_verdict   turn the judge model's raw reply into a Verdict      <-- YOU ARE HERE
  Step 2  judge_prompt    build the messages we send to the judge
  Step 3  judge_claim     call the model, parse, retry once on garbage
  Step 4  wire into verifier.verify_claims
"""

from __future__ import annotations

import json
from typing import Literal

from pydantic import BaseModel, ValidationError

VerdictStatus = Literal["supported", "unsupported", "contradicted"]


class Verdict(BaseModel):
    status: VerdictStatus
    reason: str = ""


_decoder = json.JSONDecoder()


def _extract_json_object(raw: str) -> dict:
    """Return the first JSON object in `raw` that has a "verdict" key, or raise ValueError.

    We can't trust the first "{" (the chatter may contain braces, e.g. "use {x} like so"), so we
    try every "{" as a possible start. raw_decode parses ONE object starting at a position and
    ignores whatever text follows it, so trailing chatter is not a problem either.
    """
    pos = raw.find("{")
    while pos != -1:
        try:
            obj, _end = _decoder.raw_decode(raw, pos)
        except ValueError:  # not JSON from this "{"; try the next one
            obj = None
        if isinstance(obj, dict) and "verdict" in obj:
            return obj
        pos = raw.find("{", pos + 1)
    raise ValueError("no JSON object with a 'verdict' in the judge's reply")


def parse_verdict(raw: str) -> Verdict:
    """Turn the judge model's raw text into a Verdict, or raise ValueError.

    The judge is told to answer with JSON like:
        {"verdict": "supported", "reason": "the excerpt says h=8"}
    but real models wrap it in ```json fences, add chatter before/after it, change the case
    of the verdict, or forget the reason. See tests/test_verdict_parsing.py for every case.
    """
    # 1-3. dig the JSON object out of the chatter (raises ValueError if there isn't one)
    data = _extract_json_object(raw)

    # 4. read the fields; clean the status, default a missing/null reason to ""
    status = str(data.get("verdict", "")).strip().lower()
    reason = str(data.get("reason") or "")

    # 5. build the Verdict; pydantic rejects any status that isn't one of our three
    try:
        return Verdict(status=status, reason=reason)
    except ValidationError as exc:
        raise ValueError(f"judge returned an invalid verdict {status!r}") from exc
