"""SQLite artifact backend (spec §10 durability) — the `sqlite` storage mode.

Replaces the flat-JSON files with a single WAL-mode SQLite database, so
artifacts and the credits ledger survive concurrent writes from the job
pool without the last-writer-wins hazard of separate JSON files. Binary
blobs (screenshots) still live on the filesystem — SQLite would work but
files serve directly via FileResponse.

Same functional shape as the file backend; `storage.py` dispatches to it
when USERSYNC_STORAGE=sqlite. WAL lets many readers run alongside one
writer; a process-wide lock serializes writes within this process.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from backend.app.config import get_settings

_write_lock = threading.Lock()
_initialized: set[str] = set()


def _db_path() -> Path:
    root = get_settings().data_dir
    root.mkdir(parents=True, exist_ok=True)
    return root / "usersync.db"


def _connect() -> sqlite3.Connection:
    path = str(_db_path())
    conn = sqlite3.connect(path, check_same_thread=False, timeout=30)
    conn.row_factory = sqlite3.Row
    if path not in _initialized:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS artifacts (
                user_id TEXT NOT NULL,
                folder TEXT NOT NULL,
                artifact_id TEXT NOT NULL,
                kind TEXT,
                created_at REAL,
                provenance TEXT,
                data TEXT,
                PRIMARY KEY (user_id, folder, artifact_id)
            )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_artifacts_folder ON artifacts(user_id, folder)")
        conn.commit()
        _initialized.add(path)
    return conn


def save_artifact(
    user_id: str, folder: str, kind: str, data: Any,
    provenance: dict[str, Any] | None = None, artifact_id: str | None = None,
) -> dict[str, Any]:
    artifact_id = artifact_id or f"{kind}-{uuid.uuid4().hex[:12]}"
    record = {
        "artifact_id": artifact_id, "kind": kind, "created_at": time.time(),
        "provenance": provenance or {}, "data": data,
    }
    with _write_lock:
        conn = _connect()
        conn.execute(
            "INSERT INTO artifacts (user_id, folder, artifact_id, kind, created_at, provenance, data) "
            "VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(user_id, folder, artifact_id) DO UPDATE SET "
            "kind=excluded.kind, created_at=excluded.created_at, "
            "provenance=excluded.provenance, data=excluded.data",
            (user_id, folder, artifact_id, kind, record["created_at"],
             json.dumps(record["provenance"]), json.dumps(data)),
        )
        conn.commit()
        conn.close()
    return record


def load_artifact(user_id: str, folder: str, artifact_id: str) -> dict[str, Any] | None:
    conn = _connect()
    row = conn.execute(
        "SELECT kind, created_at, provenance, data FROM artifacts "
        "WHERE user_id=? AND folder=? AND artifact_id=?",
        (user_id, folder, artifact_id),
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return {
        "artifact_id": artifact_id, "kind": row["kind"], "created_at": row["created_at"],
        "provenance": json.loads(row["provenance"] or "{}"), "data": json.loads(row["data"] or "null"),
    }


def list_artifacts(user_id: str, folder: str) -> list[dict[str, Any]]:
    conn = _connect()
    rows = conn.execute(
        "SELECT artifact_id, kind, created_at, provenance FROM artifacts "
        "WHERE user_id=? AND folder=? ORDER BY created_at ASC",
        (user_id, folder),
    ).fetchall()
    conn.close()
    return [
        {"artifact_id": r["artifact_id"], "kind": r["kind"],
         "created_at": r["created_at"], "provenance": json.loads(r["provenance"] or "{}")}
        for r in rows
    ]
