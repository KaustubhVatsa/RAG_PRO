"""Internal types for the parsing step (owned by the knowledge layer; not part of the
frozen contract, change freely)."""

from __future__ import annotations

from pydantic import BaseModel


class Block(BaseModel):
    text: str
    is_heading: bool = False
    font_size: float | None = None


class ParsedPage(BaseModel):
    page: int  # 1-based
    blocks: list[Block]


class ParsedDoc(BaseModel):
    title: str
    pages: list[ParsedPage]
