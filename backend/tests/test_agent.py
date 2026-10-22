from app.core.schemas import ChatRequest, DoneEvent, RetrievalEvent, TokenEvent
from app.dev.simple_retriever import SimpleRetriever
from app.llm.mock import MockLLM
from app.reasoning.agent import answer_stream
from app.reasoning.citations import build_citations, extract_markers


def _run(store, demo_id, question):
    req = ChatRequest(question=question, doc_ids=[demo_id])
    return list(answer_stream(req, SimpleRetriever(store), MockLLM()))


def test_event_order_and_final_answer(store, demo_id):
    events = _run(store, demo_id, "How many attention heads does the base model use?")
    kinds = [e.type for e in events]
    assert kinds[0] == "retrieval" and kinds[-1] == "done"
    assert "token" in kinds
    done = events[-1]
    assert isinstance(done, DoneEvent) and not done.answer.abstained
    assert done.answer.citations, "markers in the text must become citations"
    assert all(c.page >= 1 for c in done.answer.citations)


def test_streamed_tokens_reassemble_to_answer_text(store, demo_id):
    events = _run(store, demo_id, "scaled dot-product attention")
    streamed = "".join(e.text for e in events if isinstance(e, TokenEvent)).strip()
    assert streamed == events[-1].answer.text


def test_no_retrieval_hits_means_abstain(store, demo_id):
    events = _run(store, demo_id, "zzzz qqqq")
    assert isinstance(events[0], RetrievalEvent) and events[0].chunks == []
    assert events[-1].answer.abstained


def test_retrieval_event_never_leaks_embeddings(store, demo_id):
    events = _run(store, demo_id, "attention heads")
    assert all(sc.chunk.embedding is None for sc in events[0].chunks)


def test_invented_citation_numbers_are_dropped(store, demo_id):
    chunks = SimpleRetriever(store).retrieve("attention", [demo_id], k=2)
    cites = build_citations("Real [1]. Invented [9].", chunks)
    assert [c.n for c in cites] == [1]
    assert extract_markers("a [2][3] b [2]") == [2, 3]
