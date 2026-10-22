"""R4.2: should_abstain, and R4.3: the agent uses it."""

from app.core.schemas import ChatRequest, Claim, DoneEvent
from app.dev.simple_retriever import SimpleRetriever
from app.llm.mock import MockLLM
from app.reasoning.agent import answer_stream
from app.reasoning.confidence import should_abstain


def c(status):
    return Claim(text="x", status=status)


def test_a_single_contradicted_claim_is_a_hard_stop_even_with_high_confidence():
    claims = [c("supported")] * 9 + [c("contradicted")]  # 90% supported
    d = should_abstain(claims)
    assert d.abstain and "contradicted" in d.reason


def test_low_confidence_abstains_with_a_readable_reason():
    d = should_abstain([c("supported"), c("unsupported"), c("unsupported")])
    assert d.abstain and "33%" in d.reason


def test_threshold_is_the_boundary_and_is_configurable():
    claims = [c("supported"), c("unsupported")]  # exactly 0.5
    assert not should_abstain(claims, threshold=0.5).abstain  # equal to threshold: keep
    assert should_abstain(claims, threshold=0.6).abstain


def test_no_opinion_never_abstains():
    assert not should_abstain([]).abstain
    assert not should_abstain([c("unverified"), c("unverified")]).abstain


# ---- the agent applies it
class LyingLLM(MockLLM):
    def stream(self, messages, **kw):
        yield from 'Uses 16 heads [1].\n\nEvidence:\n[1] "sixteen heads"'.split(" ")


def _done(llm, store, demo_id):
    req = ChatRequest(question="How many attention heads?", doc_ids=[demo_id])
    return [e for e in answer_stream(req, SimpleRetriever(store), llm) if isinstance(e, DoneEvent)][
        0
    ]


def test_agent_shows_a_well_supported_answer_with_its_confidence(store, demo_id):
    ans = _done(MockLLM(), store, demo_id).answer
    assert not ans.abstained and ans.confidence == 1.0 and "mock answer" in ans.text


def test_agent_withholds_an_answer_whose_quote_was_fabricated(store, demo_id):
    ans = _done(LyingLLM(), store, demo_id).answer
    assert ans.abstained and ans.abstain_reason
    assert "16 heads" not in ans.text  # the bad answer is replaced...
    assert ans.claims and ans.citations  # ...but the evidence of WHY is kept
