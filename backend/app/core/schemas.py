"""SHARED CONTRACT (frozen): data shapes used by every layer and by the frontend.

Changing anything here needs sign-off from BOTH owners (see CODEOWNERS) because the
frontend types (frontend/src/api/types.ts) and contracts/openapi.yaml mirror it.
Adding an optional field is fine; renaming or removing a field is a breaking change.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

DocStatus = Literal["processing", "ready", "failed"]
ChatMode = Literal["answer", "teacher", "factcheck"]
ClaimStatus = Literal["supported", "unsupported", "contradicted", "unverified"]
RetrievalSource = Literal["vector", "bm25", "hybrid", "rerank"]


def utcnow() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------- knowledge layer
class Document(BaseModel):
    id: str
    title: str
    filename: str
    status: DocStatus = "processing"
    n_pages: int = 0
    n_chunks: int = 0
    error: str | None = None
    created_at: datetime = Field(default_factory=utcnow)


class Chunk(BaseModel):
    """A passage of a document. `page` is 1-based and is what citations point to."""

    id: str  # convention: f"{doc_id}:{ord}"
    doc_id: str
    ord: int  # position of the chunk within the document, starting at 0
    page: int
    section: str | None = None  # nearest heading, e.g. "3.2 Attention"
    text: str
    embedding: list[float] | None = None  # never sent to the frontend


class ScoredChunk(BaseModel):
    chunk: Chunk
    score: float  # higher is better; scale depends on `source`, do not compare across sources
    source: RetrievalSource


# ---------------------------------------------------------------- reasoning layer
class Citation(BaseModel):
    n: int  # the [n] marker used in the answer text
    chunk_id: str
    doc_id: str
    page: int
    quote: str  # exact span from the chunk that backs the claim


class Claim(BaseModel):
    """One atomic statement extracted from the answer, with its verification verdict."""

    text: str
    status: ClaimStatus = "unverified"
    evidence: list[Citation] = Field(default_factory=list)
    note: str | None = None


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    question: str  # in factcheck mode: the statement to check
    doc_ids: list[str]
    mode: ChatMode = "answer"
    history: list[Message] = Field(default_factory=list)


class Answer(BaseModel):
    text: str
    citations: list[Citation] = Field(default_factory=list)
    claims: list[Claim] = Field(default_factory=list)
    abstained: bool = False
    abstain_reason: str | None = None
    confidence: float | None = None  # 0..1, None until the verifier is wired in
    mode: ChatMode = "answer"


# ---------------------------------------------------------------- SSE events (POST /api/chat)
class RetrievalEvent(BaseModel):
    type: Literal["retrieval"] = "retrieval"
    chunks: list[ScoredChunk]


class TokenEvent(BaseModel):
    type: Literal["token"] = "token"
    text: str


class ClaimsEvent(BaseModel):
    type: Literal["claims"] = "claims"
    claims: list[Claim]


class DoneEvent(BaseModel):
    type: Literal["done"] = "done"
    answer: Answer


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


ChatEvent = RetrievalEvent | TokenEvent | ClaimsEvent | DoneEvent | ErrorEvent
