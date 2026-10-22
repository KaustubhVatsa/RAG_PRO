"""PARTNER spec for P2. Remove the xfail marker once parse_pdf is implemented."""

import pytest

pymupdf = pytest.importorskip("pymupdf")  # install with: pip install -e ".[knowledge]"

from app.knowledge.ingest.parse import parse_pdf  # noqa: E402


def _make_pdf() -> bytes:
    doc = pymupdf.open()
    for title, body in [
        ("1 Introduction", "Cats are mammals."),
        ("2 Methods", "We measured tails."),
    ]:
        page = doc.new_page()
        page.insert_text((72, 90), title, fontsize=20)
        page.insert_text((72, 140), body, fontsize=11)
    return doc.tobytes()


def test_whitespace_spans_are_preserved():
    from app.knowledge.ingest.parse import _extract_text_block

    block = _extract_text_block(
        {
            "type": 0,
            "bbox": (0, 0, 100, 20),
            "lines": [
                {
                    "spans": [
                        {"text": "Professional", "size": 11, "font": "Helvetica"},
                        {"text": " ", "size": 11, "font": "Helvetica"},
                        {"text": "Summary", "size": 11, "font": "Helvetica"},
                    ]
                }
            ],
        }
    )
    assert block is not None
    assert block["text"] == "Professional Summary"


def test_unhelpful_metadata_title_falls_back_to_page_title():
    pdf = pymupdf.open()
    pdf.set_metadata({"title": "arXiv:1706.03762v7 [cs.CL]"})
    page = pdf.new_page()
    page.insert_text((72, 90), "Attention Is All You Need", fontsize=20)
    page.insert_text((72, 140), "We present a model.", fontsize=11)

    parsed = parse_pdf(pdf.tobytes(), "attention.pdf")
    assert parsed.title == "Attention Is All You Need"


def test_arxiv_identifier_is_skipped_when_selecting_page_title():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 60), "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023", fontsize=20)
    page.insert_text((72, 100), "Attention Is All You Need", fontsize=17)

    parsed = parse_pdf(pdf.tobytes(), "attention.pdf")
    assert parsed.title == "Attention Is All You Need"


def test_contact_details_are_trimmed_from_page_title():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text(
        (72, 90),
        "Example Person +1-555-0100 | person@example.com | https://example.com",
        fontsize=20,
    )

    parsed = parse_pdf(pdf.tobytes(), "resume.pdf")
    assert parsed.title == "Example Person"


def test_spaced_repeated_page_headers_are_removed():
    pdf = pymupdf.open()
    for page_number in range(1, 3):
        page = pdf.new_page()
        page.insert_text((72, 80), f"Page content {page_number}", fontsize=11)
        page.insert_text((36, 810), f"P a g e {page_number} | Workbook", fontsize=10)

    parsed = parse_pdf(pdf.tobytes(), "workbook.pdf")
    assert all("Workbook" not in block.text for page in parsed.pages for block in page.blocks)


def test_pages_are_one_based_and_contain_text():
    parsed = parse_pdf(_make_pdf(), "cats.pdf")
    assert [p.page for p in parsed.pages] == [1, 2]
    assert "Cats are mammals" in " ".join(b.text for b in parsed.pages[0].blocks)


def test_large_font_block_is_detected_as_heading():
    parsed = parse_pdf(_make_pdf(), "cats.pdf")
    headings = [b.text for b in parsed.pages[0].blocks if b.is_heading]
    assert any("Introduction" in h for h in headings)


def test_garbage_bytes_raise_value_error():
    with pytest.raises(ValueError):
        parse_pdf(b"%PDF-1.4 not really", "bad.pdf")
