import time

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _sse_events(text: str) -> list[tuple[str, dict]]:
    import json

    out = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        out.append((lines["event"], json.loads(lines["data"])))
    return out


def test_health_reports_mock_mode():
    body = client.get("/api/health").json()
    assert body["status"] == "ok" and body["llm_provider"] == "mock"


def test_demo_document_is_preloaded():
    docs = client.get("/api/documents").json()
    assert any(d["id"] == "demo-attention" and d["status"] == "ready" for d in docs)


def test_chat_streams_sse_ending_in_done():
    r = client.post(
        "/api/chat",
        json={"question": "How many attention heads?", "doc_ids": ["demo-attention"]},
    )
    assert r.status_code == 200
    events = _sse_events(r.text)
    assert events[0][0] == "retrieval" and events[-1][0] == "done"
    assert events[-1][1]["answer"]["citations"]


def test_chat_rejects_unknown_or_empty_docs():
    assert client.post("/api/chat", json={"question": "x", "doc_ids": []}).status_code == 422
    assert client.post("/api/chat", json={"question": "x", "doc_ids": ["nope"]}).status_code == 409


def test_upload_rejects_non_pdf():
    r = client.post("/api/documents", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_upload_flow_processing_then_ready():
    r = client.post(
        "/api/documents", files={"file": ("paper.pdf", b"%PDF-1.4 fake", "application/pdf")}
    )
    assert r.status_code == 202
    doc_id = r.json()["id"]
    for _ in range(50):  # FakeIngestor takes ~1s
        if client.get(f"/api/documents/{doc_id}").json()["status"] == "ready":
            break
        time.sleep(0.1)
    assert client.get(f"/api/documents/{doc_id}").json()["status"] == "ready"
    assert client.delete(f"/api/documents/{doc_id}").status_code == 204


def test_uploaded_pdf_can_be_downloaded_and_is_removed_on_delete():
    pdf = b"%PDF-1.4 original bytes \x00\xff"
    doc_id = client.post(
        "/api/documents", files={"file": ("p.pdf", pdf, "application/pdf")}
    ).json()["id"]
    r = client.get(f"/api/documents/{doc_id}/file")
    assert r.status_code == 200 and r.content == pdf
    assert r.headers["content-type"] == "application/pdf"
    assert client.delete(f"/api/documents/{doc_id}").status_code == 204
    assert client.get(f"/api/documents/{doc_id}/file").status_code == 404


def test_the_demo_document_has_no_stored_file():
    assert client.get("/api/documents/demo-attention/file").status_code == 404


def test_path_tricks_in_the_document_id_find_nothing():
    assert client.get("/api/documents/..%2F..%2Fsecret/file").status_code == 404
