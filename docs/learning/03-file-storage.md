# Learning note 03: where uploaded PDFs live (FileStore)

## The problem
When someone uploads a paper we keep **three different things**, and they belong in different places:

| thing | used for | where it lives |
|---|---|---|
| the original PDF bytes | the in-browser PDF viewer ("jump to page 5") | **FileStore** (this note) |
| the document record (title, status, pages) | the library list, "processing → ready" | ChunkStore (memory now, MongoDB later) |
| the chunks + their vectors | searching | ChunkStore |

Before this change the PDF was written straight to `backend/data/uploads/` inside the API route.
That works on a laptop and **breaks on free hosting**: those hosts reset their disk on every restart/deploy,
so every uploaded PDF (and the viewer) would vanish.

## The idea: one small interface, two implementations
```python
class FileStore(Protocol):
    def save(self, doc_id, data: bytes) -> None
    def read(self, doc_id) -> bytes | None     # None = no such file
    def delete(self, doc_id) -> None           # deleting a missing file is fine
```
- `LocalFileStore`: a folder on disk. Simple, fast, great for development.
- `GridFSFileStore`: MongoDB **GridFS**. Mongo documents are limited to 16 MB, so GridFS splits big files into
  chunks and stores them in two collections (`pdfs.files` metadata + `pdfs.chunks` bytes); you just call
  `put` / `get`. It survives restarts and lives in the same database as everything else.

The API route never knows which one it has. `app/deps.py` picks from `FILE_STORE=local|mongo`.
This is the same trick as the three seams from `docs/ARCHITECTURE.md`: code against an interface, swap the
implementation with config.

## Concepts worth being able to explain
1. **Separate "the file" from "the facts about the file".** Bytes go in a file store, metadata goes in a database.
2. **Path traversal.** `GET /api/documents/<id>/file` puts text from a URL into a file path. An id like
   `../../secret` could read files outside the folder. We allow only `[A-Za-z0-9_-]{1,64}` ids and test the attack.
3. **Idempotent operations.** Saving the same id replaces the file; deleting a missing file is not an error.
   Retries and double-clicks then can't corrupt anything.
4. **Testing one contract against many implementations.** `tests/test_file_store.py` runs the *same* tests against
   the local store and GridFS (using `mongomock`, an in-memory fake MongoDB). A real-MongoDB variant runs when
   `MONGO_TEST_URI` is set.
5. **Honest limits.** Atlas free tier (M0) gives ~512 MB total, and we allow 25 MB per upload, so roughly 20 papers
   alongside the chunks. We load the whole PDF into memory to serve it (fine at 25 MB; streaming would be the
   upgrade).

## Try it
```bash
make test                                    # includes the FileStore contract tests
make db                                      # start local MongoDB (needs Docker running)
MONGO_TEST_URI='mongodb://localhost:27017/?directConnection=true' make test   # now the real-Mongo variants run too
FILE_STORE=mongo STORE=memory make api       # run the API storing PDFs in Mongo
```

## Exercises
1. Serve the PDF as a **stream** from GridFS instead of loading all bytes (`StreamingResponse`). Why does the
   PDF viewer care about HTTP `Range` requests?
2. Add `exists(doc_id)` to the interface and implement it for both stores. Where would the API use it?
3. A user uploads the same paper twice. Should we detect that (hash the bytes)? What would you store?
