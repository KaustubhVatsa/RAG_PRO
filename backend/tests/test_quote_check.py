"""R2: quote-then-answer + the deterministic verbatim check."""

from app.core.schemas import ChatRequest, ClaimsEvent, DoneEvent
from app.dev.simple_retriever import SimpleRetriever
from app.llm.mock import MockLLM
from app.reasoning.agent import answer_stream
from app.reasoning.citations import normalize, quote_in_chunk, split_evidence

CHUNK = "The base model uses h=8 parallel attention heads.\nFor each head d_k = d_v = 64."


def test_split_evidence_parses_quotes_and_strips_the_block():
    raw = 'It uses eight heads [1].\n\nEvidence:\n[1] "uses h=8 parallel attention heads"'
    text, quotes = split_evidence(raw)
    assert text == "It uses eight heads [1]."
    assert quotes == {1: "uses h=8 parallel attention heads"}


def test_missing_evidence_block_is_not_an_error():
    text, quotes = split_evidence("Just an answer [1].")
    assert text == "Just an answer [1]." and quotes == {}


def test_exact_quote_passes_even_with_case_whitespace_and_curly_quotes():
    assert quote_in_chunk("USES  h=8 parallel\nattention heads", CHUNK)
    assert normalize("“ﬁne” – tuned") == '"fine" - tuned'


def test_paraphrase_fails_the_check():
    # Same meaning, different words: strict matching deliberately rejects it.
    assert not quote_in_chunk("the model employs eight attention heads", CHUNK)
    assert not quote_in_chunk("", CHUNK)


class LyingLLM(MockLLM):
    """Cites a real excerpt but invents the quote: exactly the failure we want to catch."""

    def stream(self, messages, **kw):
        text = 'The base model uses 16 heads [1].\n\nEvidence:\n[1] "uses sixteen parallel attention heads"'
        yield from text.split(" ")


def _run(llm, store, demo_id):
    req = ChatRequest(question="How many attention heads?", doc_ids=[demo_id])
    return list(answer_stream(req, SimpleRetriever(store), llm))


def test_honest_model_gets_verified_citations(store, demo_id):
    done = _run(MockLLM(), store, demo_id)[-1]
    assert isinstance(done, DoneEvent)
    assert done.answer.citations and all(c.verified is True for c in done.answer.citations)
    assert all(c.status != "unsupported" for c in done.answer.claims)


def test_fabricated_quote_is_flagged_and_claim_marked_unsupported(store, demo_id):
    events = _run(LyingLLM(), store, demo_id)
    done = events[-1]
    cite = done.answer.citations[0]
    assert cite.verified is False
    assert "sixteen" not in cite.quote  # we never show the fabricated quote as if it were evidence
    claims = next(e for e in events if isinstance(e, ClaimsEvent)).claims
    assert claims[0].status == "unsupported" and "verbatim" in (claims[0].note or "")
