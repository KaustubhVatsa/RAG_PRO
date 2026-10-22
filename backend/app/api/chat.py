from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.api.sse import sse
from app.config import Settings
from app.core.interfaces import LLM, ChunkStore, Retriever
from app.core.schemas import ChatRequest
from app.deps import get_llm, get_retriever, get_settings, get_store
from app.reasoning.agent import answer_stream

router = APIRouter()


@router.post("/chat")
def chat(
    req: ChatRequest,
    retriever: Retriever = Depends(get_retriever),
    llm: LLM = Depends(get_llm),
    store: ChunkStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
):
    """Streams SSE events: retrieval -> token* -> claims? -> done  (or error)."""
    if not req.doc_ids:
        raise HTTPException(422, "Select at least one document")
    not_ready = [
        d for d in req.doc_ids if (doc := store.get_document(d)) is None or doc.status != "ready"
    ]
    if not_ready:
        raise HTTPException(409, f"Documents not ready: {', '.join(not_ready)}")
    return StreamingResponse(
        sse(answer_stream(req, retriever, llm, top_k=settings.top_k)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
