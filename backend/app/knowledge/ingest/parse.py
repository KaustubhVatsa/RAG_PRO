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

import re
from collections import Counter, defaultdict

import fitz

from app.knowledge.ingest.types import Block, ParsedDoc, ParsedPage

_PAGE_NUMBER = re.compile(r"^(?:page\s*)?\d+(?:\s*(?:of|/)\s*\d+)?$", re.IGNORECASE)


def _normalized_text(text: str) -> str:
    return " ".join(text.casefold().split())


def _extract_text_block(raw_block: dict) -> dict | None:
    if raw_block.get("type", 0) != 0:
        return None

    lines: list[str] = []
    spans: list[dict] = []
    for line in raw_block.get("lines", []):
        line_spans = [span for span in line.get("spans", []) if span.get("text", "").strip()]
        if line_spans:
            lines.append("".join(span.get("text", "") for span in line_spans).strip())
            spans.extend(line_spans)

    text = " ".join(line for line in lines if line).strip()
    if not text:
        return None

    sizes = [float(span["size"]) for span in spans if span.get("size") is not None]
    font_size = max(sizes) if sizes else None
    is_bold = any(
        "bold" in str(span.get("font", "")).casefold() or bool(int(span.get("flags", 0)) & 16)
        for span in spans
    )
    return {
        "text": text,
        "font_size": font_size,
        "span_sizes": sizes,
        "is_bold": is_bold,
        "bbox": raw_block.get("bbox"),
    }


def parse_pdf(pdf_bytes: bytes, filename: str = "document.pdf") -> ParsedDoc:
    try:
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Could not read PDF '{filename}': {exc}") from exc

    try:
        if document.is_encrypted or document.needs_pass:
            raise ValueError(f"PDF '{filename}' is encrypted or password-protected")
        if document.page_count == 0:
            raise ValueError(f"PDF '{filename}' contains no pages")

        page_records: list[list[dict]] = []
        page_heights: list[float] = []
        font_sizes: Counter[float] = Counter()

        for page in document:
            raw_blocks = page.get_text("dict").get("blocks", [])
            records = [
                record
                for raw_block in raw_blocks
                if (record := _extract_text_block(raw_block)) is not None
            ]
            page_records.append(records)
            page_heights.append(float(page.rect.height))
            for record in records:
                font_sizes.update(round(size, 1) for size in record["span_sizes"])

        if not any(page_records):
            raise ValueError(f"PDF '{filename}' has no extractable text; it may be image-only")

        most_common_count = max(font_sizes.values(), default=0)
        body_font_size = min(
            (size for size, count in font_sizes.items() if count == most_common_count),
            default=None,
        )

        edge_occurrences: dict[str, set[int]] = defaultdict(set)
        for page_index, records in enumerate(page_records):
            page_height = page_heights[page_index]
            for record in records:
                bbox = record["bbox"]
                if bbox is None:
                    continue
                at_edge = bbox[1] <= page_height * 0.06 or bbox[3] >= page_height * 0.94
                normalized = _normalized_text(record["text"])
                if at_edge and normalized and not _PAGE_NUMBER.fullmatch(normalized):
                    edge_occurrences[normalized].add(page_index)

        repeated_edge_text = {text for text, pages in edge_occurrences.items() if len(pages) >= 2}

        parsed_pages: list[ParsedPage] = []
        for page_index, records in enumerate(page_records):
            blocks: list[Block] = []
            for record in records:
                normalized = _normalized_text(record["text"])
                bbox = record["bbox"]
                at_edge = bbox is not None and (
                    bbox[1] <= page_heights[page_index] * 0.06
                    or bbox[3] >= page_heights[page_index] * 0.94
                )
                if at_edge and (
                    normalized in repeated_edge_text or _PAGE_NUMBER.fullmatch(normalized)
                ):
                    continue

                font_size = record["font_size"]
                large_font = (
                    body_font_size is not None
                    and font_size is not None
                    and font_size > body_font_size * 1.15
                )
                short_bold = record["is_bold"] and len(record["text"].split()) < 12
                blocks.append(
                    Block(
                        text=record["text"],
                        is_heading=large_font or short_bold,
                        font_size=font_size,
                    )
                )
            parsed_pages.append(ParsedPage(page=page_index + 1, blocks=blocks))

        metadata_title = ((document.metadata or {}).get("title") or "").strip()
        if metadata_title:
            title = metadata_title
        else:
            title_record = max(
                page_records[0],
                key=lambda record: record["font_size"] or 0,
                default=None,
            )
            title = title_record["text"] if title_record else filename

        return ParsedDoc(title=title or filename, pages=parsed_pages)
    finally:
        document.close()
