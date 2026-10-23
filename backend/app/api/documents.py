from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from fastapi.responses import Response

from app.config import Settings
from app.core.interfaces import ChunkStore, Ingestor
from app.core.schemas import Chunk, Document
from app.deps import get_file_store, get_ingestor, get_settings, get_store
from app.storage import FileStore

router = APIRouter(prefix="/documents")


def _run_ingest(ingestor: Ingestor, store: ChunkStore, doc_id: str, data: bytes, name: str) -> None:
    try:
        ingestor.ingest(doc_id, data, name)
    except Exception as exc:  # last line of defence: never leave a doc stuck in 'processing'
        store.update_document(doc_id, status="failed", error=f"{type(exc).__name__}: {exc}")


@router.get("", response_model=list[Document])
def list_documents(store: ChunkStore = Depends(get_store)):
    return store.list_documents()


@router.post("", response_model=Document, status_code=202)
async def upload_document(
    file: UploadFile,
    background: BackgroundTasks,
    store: ChunkStore = Depends(get_store),
    ingestor: Ingestor = Depends(get_ingestor),
    files: FileStore = Depends(get_file_store),
    settings: Settings = Depends(get_settings),
):
    data = await file.read()
    if not data.startswith(b"%PDF"):
        raise HTTPException(400, "Only PDF files are supported")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"PDF larger than {settings.max_upload_mb} MB")

    filename = file.filename or "document.pdf"
    doc = Document(id=uuid.uuid4().hex[:12], title=Path(filename).stem, filename=filename)
    files.save(doc.id, data)  # the original PDF (for the viewer); chunks go through the ingestor
    store.put_document(doc)
    background.add_task(_run_ingest, ingestor, store, doc.id, data, filename)
    return doc


@router.get("/{doc_id}", response_model=Document)
def get_document(doc_id: str, store: ChunkStore = Depends(get_store)):
    doc = store.get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.delete("/{doc_id}", status_code=204)
def delete_document(
    doc_id: str,
    store: ChunkStore = Depends(get_store),
    files: FileStore = Depends(get_file_store),
):
    store.delete_document(doc_id)
    files.delete(doc_id)


@router.get("/{doc_id}/file")
def get_file(doc_id: str, files: FileStore = Depends(get_file_store)):
    """Original PDF bytes, for the in-browser viewer."""
    data = files.read(doc_id)
    if data is None:
        raise HTTPException(404, "No stored file for this document")
    return Response(content=data, media_type="application/pdf")


@router.get("/{doc_id}/chunks", response_model=list[Chunk])
def get_chunks(doc_id: str, page: int, store: ChunkStore = Depends(get_store)):
    """Chunks on one page (to highlight cited passages in the viewer)."""
    return [c.model_copy(update={"embedding": None}) for c in store.get_page_chunks(doc_id, page)]
