"""SQLite artifact backend (item 10): durability, concurrency, both modes."""

import os
import tempfile
import threading

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest


@pytest.fixture()
def sqlite_env(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("USERSYNC_STORAGE", "sqlite")
    from backend.app.config import get_settings

    get_settings.cache_clear()
    import backend.app.sqlite_store as ss

    ss._initialized.clear()
    yield
    get_settings.cache_clear()


def test_roundtrip_and_list(sqlite_env):
    from backend.app import storage

    rec = storage.save_artifact("u", "personas", "hub", {"n": 5}, provenance={"seed": 1})
    loaded = storage.load_artifact("u", "personas", rec["artifact_id"])
    assert loaded["data"] == {"n": 5} and loaded["provenance"]["seed"] == 1
    listed = storage.list_artifacts("u", "personas")
    assert listed[0]["artifact_id"] == rec["artifact_id"]
    # No stray JSON artifact files in sqlite mode — the DB is the store.
    from pathlib import Path

    assert (Path(os.environ["USERSYNC_DATA_DIR"]) / "usersync.db").exists()


def test_upsert_by_artifact_id(sqlite_env):
    from backend.app import storage

    storage.save_artifact("u", "journeys", "run", {"status": "running"}, artifact_id="run-1")
    storage.save_artifact("u", "journeys", "run", {"status": "completed"}, artifact_id="run-1")
    assert storage.load_artifact("u", "journeys", "run-1")["data"]["status"] == "completed"
    assert len(storage.list_artifacts("u", "journeys")) == 1  # upsert, not duplicate


def test_concurrent_writes_do_not_corrupt(sqlite_env):
    from backend.app import storage

    def writer(i):
        storage.save_artifact("u", "analyses", "graph", {"i": i}, artifact_id=f"g-{i}")

    threads = [threading.Thread(target=writer, args=(i,)) for i in range(30)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    # All 30 rows present and readable (no last-writer-wins loss).
    assert len(storage.list_artifacts("u", "analyses")) == 30
    assert all(storage.load_artifact("u", "analyses", f"g-{i}")["data"]["i"] == i for i in range(30))


def test_credits_ledger_per_account_in_sqlite(sqlite_env):
    from backend.app.quota import _load_entry, _store_entry

    _store_entry("acct-a", {"credits": 100, "usage": {}})
    _store_entry("acct-b", {"credits": 5, "usage": {}})
    assert _load_entry("acct-a")["credits"] == 100
    assert _load_entry("acct-b")["credits"] == 5
    assert _load_entry("acct-missing") is None


def test_files_mode_still_works(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("USERSYNC_STORAGE", "files")
    from backend.app.config import get_settings

    get_settings.cache_clear()
    from backend.app import storage

    rec = storage.save_artifact("u", "personas", "hub", {"n": 1})
    assert (tmp_path / "users" / "u" / "personas" / f"{rec['artifact_id']}.json").is_file()
    assert storage.load_artifact("u", "personas", rec["artifact_id"])["data"]["n"] == 1
    get_settings.cache_clear()
