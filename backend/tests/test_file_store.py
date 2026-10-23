"""The same contract is tested against every FileStore implementation.

- LocalFileStore: always.
- GridFSFileStore: always, against `mongomock` (an in-memory fake MongoDB with GridFS support).
- GridFSFileStore on a REAL MongoDB: only if MONGO_TEST_URI is set, e.g. after `make db`:
    MONGO_TEST_URI='mongodb://localhost:27017/?directConnection=true' make test
"""

import os
import uuid

import pytest

from app.storage import GridFSFileStore, LocalFileStore

PDF = b"%PDF-1.4\n\x00\xff\xfe binary \x80 bytes \n%%EOF"  # not valid UTF-8 on purpose


def _make_gridfs_mock(tmp_path):
    pytest.importorskip("pymongo")
    mongomock = pytest.importorskip("mongomock")
    from mongomock.gridfs import enable_gridfs_integration

    enable_gridfs_integration()
    return GridFSFileStore("unused", "verity_test", client=mongomock.MongoClient())


def _make_gridfs_real(tmp_path):
    return GridFSFileStore(os.environ["MONGO_TEST_URI"], f"verity_test_{uuid.uuid4().hex[:6]}")


@pytest.fixture(
    params=[
        pytest.param(lambda tmp: LocalFileStore(tmp / "uploads"), id="local"),
        pytest.param(_make_gridfs_mock, id="gridfs-mock"),
        pytest.param(
            _make_gridfs_real,
            id="gridfs-real",
            marks=pytest.mark.skipif(
                not os.getenv("MONGO_TEST_URI"), reason="MONGO_TEST_URI not set"
            ),
        ),
    ]
)
def fs(request, tmp_path):
    return request.param(tmp_path)


def test_roundtrip_keeps_every_byte(fs):
    fs.save("abc123", PDF)
    assert fs.read("abc123") == PDF


def test_reading_a_missing_file_returns_none(fs):
    assert fs.read("nope") is None


def test_saving_the_same_id_again_replaces_the_file(fs):
    fs.save("abc123", b"%PDF old")
    fs.save("abc123", b"%PDF new")
    assert fs.read("abc123") == b"%PDF new"


def test_delete_removes_the_file_and_is_idempotent(fs):
    fs.save("abc123", PDF)
    fs.delete("abc123")
    assert fs.read("abc123") is None
    fs.delete("abc123")  # deleting twice is fine
    fs.delete("never-existed")


def test_files_are_isolated_by_id(fs):
    fs.save("a", b"%PDF A")
    fs.save("b", b"%PDF B")
    fs.delete("a")
    assert fs.read("a") is None and fs.read("b") == b"%PDF B"


@pytest.mark.parametrize("bad", ["../evil", "a/b", "..", "", "a b", "x" * 100, "a\x00b"])
def test_unsafe_ids_are_rejected_on_save_and_invisible_on_read(fs, bad):
    with pytest.raises(ValueError):
        fs.save(bad, PDF)
    assert fs.read(bad) is None
    fs.delete(bad)  # must not raise or touch anything


def test_local_store_never_writes_outside_its_folder(tmp_path):
    store = LocalFileStore(tmp_path / "uploads")
    with pytest.raises(ValueError):
        store.save("../escaped", PDF)
    assert not (tmp_path / "escaped.pdf").exists()
