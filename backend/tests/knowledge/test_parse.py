"""PARTNER spec for P2. Remove the xfail marker once parse_pdf is implemented."""

import pytest

fitz = pytest.importorskip("fitz")  # install with: pip install -e ".[knowledge]"

from app.knowledge.ingest.parse import parse_pdf  # noqa: E402


def _make_pdf() -> bytes:
    doc = fitz.open()
    for title, body in [
        ("1 Introduction", "Cats are mammals."),
        ("2 Methods", "We measured tails."),
    ]:
        page = doc.new_page()
        page.insert_text((72, 90), title, fontsize=20)
        page.insert_text((72, 140), body, fontsize=11)
    return doc.tobytes()


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
