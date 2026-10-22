"""The answering agent.  v0 = naive RAG with citations (the BASELINE for the answer eval).

    retrieve -> build grounded prompt -> stream answer -> parse citations -> verify claims -> Answer

TODO(reasoning) roadmap (each step becomes a row in the ablation table):
  1. query rewrite / decomposition with the 'fast' model (multi-hop questions)
  2. sufficiency check + re-retrieve loop (the genuinely 'agentic' part, max 3 rounds)
  3. quote-then-answer + verbatim check, claim verifier, calibrated abstention
  4. conversation memory (use req.history when rewriting the query)
"""

from __future__ import annotations

from collections.abc import Iterator

from app.core.interfaces import LLM, Retriever
from app.core.schemas import (
    Answer,
    ChatEvent,
    ChatRequest,
    ClaimsEvent,
    DoneEvent,
    RetrievalEvent,
    ScoredChunk,
    TokenEvent,
)
from app.reasoning.citations import build_citations
from app.reasoning.prompts import ABSTAIN_TEXT, format_context, system_prompt
from app.reasoning.verifier import verify_claims


def _public(chunks: list[ScoredChunk]) -> list[ScoredChunk]:
    """Embeddings are big and useless to the client."""
    return [
        sc.model_copy(update={"chunk": sc.chunk.model_copy(update={"embedding": None})})
        for sc in chunks
    ]


def answer_stream(
    req: ChatRequest, retriever: Retriever, llm: LLM, top_k: int = 6
) -> Iterator[ChatEvent]:
    chunks = _public(retriever.retrieve(req.question, req.doc_ids, k=top_k))
    yield RetrievalEvent(chunks=chunks)

    if not chunks:
        answer = Answer(
            text=ABSTAIN_TEXT,
            abstained=True,
            abstain_reason="no relevant passages retrieved",
            mode=req.mode,
        )
        yield TokenEvent(text=answer.text)
        yield DoneEvent(answer=answer)
        return

    messages = [{"role": "system", "content": system_prompt(req.mode)}]
    messages += [m.model_dump() for m in req.history[-6:]]
    messages.append(
        {
            "role": "user",
            "content": f"Excerpts:\n{format_context(chunks)}\n\nQuestion: {req.question}",
        }
    )

    parts: list[str] = []
    for token in llm.stream(messages, role="main", max_tokens=700):
        parts.append(token)
        yield TokenEvent(text=token)
    text = "".join(parts).strip()

    abstained = text.startswith(ABSTAIN_TEXT[:20])
    citations = [] if abstained else build_citations(text, chunks)
    claims = [] if abstained else verify_claims(text, citations, llm)
    if claims:
        yield ClaimsEvent(claims=claims)
    yield DoneEvent(
        answer=Answer(
            text=text,
            citations=citations,
            claims=claims,
            abstained=abstained,
            abstain_reason="model found no support in the excerpts" if abstained else None,
            mode=req.mode,
        )
    )
