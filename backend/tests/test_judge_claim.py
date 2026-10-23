"""R3.3 + R3.4: judge_claim (retry/fail-safe) and verify_claims (the decision order)."""

from app.core.schemas import Chunk, Citation, ScoredChunk
from app.llm.mock import MockLLM
from app.reasoning.judge import judge_claim
from app.reasoning.verifier import strip_markers, verify_claims

GOOD = '{"verdict": "supported", "reason": "says 8"}'


class ScriptedLLM(MockLLM):
    """Returns canned judge replies in order and records every call."""

    def __init__(self, *replies: str | Exception):
        self.replies, self.calls = list(replies), []

    def complete(self, messages, **kw):
        self.calls.append(messages)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        from app.core.interfaces import LLMResult

        return LLMResult(text=reply, model="scripted")


def test_valid_reply_returns_the_verdict():
    assert judge_claim("c", ["e"], ScriptedLLM(GOOD)).status == "supported"


def test_garbage_then_valid_retries_and_shows_the_bad_reply():
    llm = ScriptedLLM("I think so!", GOOD)
    assert judge_claim("c", ["e"], llm).status == "supported"
    assert len(llm.calls) == 2
    assert llm.calls[1][-2] == {"role": "assistant", "content": "I think so!"}


def test_garbage_twice_gives_none_not_a_guess():
    assert judge_claim("c", ["e"], ScriptedLLM("nope", "still nope")) is None


def test_provider_error_gives_none():
    assert judge_claim("c", ["e"], ScriptedLLM(RuntimeError("503"))) is None


# ---- verify_claims
def _chunks():
    ch = Chunk(id="d:0", doc_id="d", ord=0, page=5, text="The base model uses h=8 heads.")
    return [ScoredChunk(chunk=ch, score=1.0, source="bm25")]


def _cite(verified):
    return Citation(n=1, chunk_id="d:0", doc_id="d", page=5, quote="q", verified=verified)


def test_strip_markers():
    assert strip_markers("It uses 8 heads [1][2].") == "It uses 8 heads."


def test_uncited_sentence_is_unverified_and_never_judged():
    llm = ScriptedLLM()  # any call would pop from an empty list and fail
    claims = verify_claims("The question has a false premise.", [], _chunks(), llm)
    assert claims[0].status == "unverified" and llm.calls == []


def test_failed_quote_is_unsupported_without_calling_the_judge():
    llm = ScriptedLLM()
    claims = verify_claims("It uses 16 heads [1].", [_cite(False)], _chunks(), llm)
    assert claims[0].status == "unsupported" and llm.calls == []


def test_judged_claims_carry_status_and_reason_and_get_clean_text():
    llm = ScriptedLLM('{"verdict": "contradicted", "reason": "8 not 16"}')
    claims = verify_claims("It uses 16 heads [1].", [_cite(True)], _chunks(), llm)
    assert (claims[0].status, claims[0].note) == ("contradicted", "8 not 16")
    sent = llm.calls[0][1]["content"]
    assert "It uses 16 heads." in sent and "[1]" not in sent.split("<claim>")[1]


def test_unparseable_judge_leaves_the_claim_unverified():
    llm = ScriptedLLM("nope", "nope")
    claims = verify_claims("It uses 8 heads [1].", [_cite(True)], _chunks(), llm)
    assert claims[0].status == "unverified"


def test_citation_after_the_period_stays_with_its_sentence():
    # Real bug: "…28.4. [1]" was split into "…28.4." (no citation) and "[1]" (empty claim),
    # which got judged 'unsupported' and made a correct answer look 0% confident.
    from app.reasoning.verifier import split_claims

    assert split_claims("It scored 28.4. [1] It also won. [2]") == [
        "It scored 28.4. [1]",
        "It also won. [2]",
    ]


def test_marker_only_fragments_are_not_judged_as_claims():
    llm = ScriptedLLM(GOOD)
    claims = verify_claims("It uses 8 heads. [1]", [_cite(True)], _chunks(), llm)
    assert len(claims) == 1 and claims[0].status == "supported"
    assert len(llm.calls) == 1  # one real claim -> one judge call, not two
