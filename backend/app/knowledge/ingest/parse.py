"""PARTNER TASK P2: PDF -> ParsedDoc.

Use PyMuPDF (`import fitz`). Suggested approach:
  1. page.get_text("dict") gives blocks > lines > spans with font sizes.
  2. Body font size = the most common span size in the document (use a Counter).
  3. A block is a heading if its size is clearly larger than body (e.g. > 1.15x) or it is
     bold and short (< ~12 words). Set Block.is_heading / font_size accordingly.
  4. Skip headers/footers/page numbers (blocks in the top/bottom ~6% of the page that repeat).
  5. Title: PDF metadata title if present, else the largest-font text on page 1, else filename.
  6. Raise ValueError for encrypted or image-only PDFs (no extractable text) with a clear
     message; the ingestor turns it into status='failed'.
Stretch (week 2): equations/tables via Docling or Marker.
"""

from __future__ import annotations

from app.knowledge.ingest.types import ParsedDoc


def parse_pdf(pdf_bytes: bytes, filename: str = "document.pdf") -> ParsedDoc:
    raise NotImplementedError("P2: implement with PyMuPDF")
