"""PARTNER spec for P3. Remove the xfail marker once chunk_pages is implemented."""

from app.knowledge.ingest.chunk import chunk_pages, count_tokens
from app.knowledge.ingest.types import Block, ParsedPage

PARA = " ".join(f"word{i}" for i in range(120))  # ~156 tokens


def _pages():
    return [
        ParsedPage(
            page=1,
            blocks=[Block(text="1 Introduction", is_heading=True)]
            + [Block(text=PARA) for _ in range(6)],
        ),
        ParsedPage(
            page=2,
            blocks=[Block(text="2 Methods", is_heading=True)]
            + [Block(text=PARA) for _ in range(3)],
        ),
    ]


def test_chunks_respect_max_tokens():
    chunks = chunk_pages(_pages(), "d", max_tokens=400, overlap_tokens=60)
    assert chunks and all(count_tokens(c.text) <= 400 for c in chunks)


def test_ids_and_order_are_sequential():
    chunks = chunk_pages(_pages(), "d")
    assert [c.id for c in chunks] == [f"d:{i}" for i in range(len(chunks))]
    assert [c.ord for c in chunks] == list(range(len(chunks)))


def test_section_and_page_metadata():
    chunks = chunk_pages(_pages(), "d")
    assert chunks[0].section == "1 Introduction" and chunks[0].page == 1
    assert chunks[-1].section == "2 Methods" and chunks[-1].page == 2


def test_new_heading_starts_new_chunk():
    chunks = chunk_pages(_pages(), "d")
    assert not any("Introduction" in (c.section or "") and c.page == 2 for c in chunks)


def test_consecutive_chunks_in_a_section_overlap():
    chunks = [
        c
        for c in chunk_pages(_pages(), "d", max_tokens=200, overlap_tokens=50)
        if c.section == "1 Introduction"
    ]
    assert len(chunks) >= 2
    tail = set(chunks[0].text.split()[-10:])
    assert tail & set(chunks[1].text.split()[:60])


def test_no_empty_chunks_and_no_embeddings_yet():
    chunks = chunk_pages(_pages(), "d")
    assert all(c.text.strip() and c.embedding is None for c in chunks)


def test_oversized_paragraph_is_split_under_token_limit():
    text = " ".join(f"Sentence{i}." for i in range(80))
    pages = [ParsedPage(page=3, blocks=[Block(text=text)])]

    chunks = chunk_pages(pages, "long", max_tokens=30, overlap_tokens=0)

    assert len(chunks) > 1
    assert all(count_tokens(chunk.text) <= 30 for chunk in chunks)
