"""Artifact store under HF `/data` (or ./data) with the shared folder layout.

Every artifact is a JSON document with provenance; artifact ids are stable
references passed between packs (spec.md §13: pass ids, not payloads).

Two backends, selected by `USERSYNC_STORAGE` (spec §10):
- `files`  — flat JSON files (simple, the original default).
- `sqlite` — a single WAL-mode SQLite DB (durable under concurrent writes
             from the job pool). The default for production/Space runs.
Binary blobs (screenshots) always live on the filesystem in both modes.
"""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

from backend.app.config import get_settings


def _use_sqlite() -> bool:
    return get_settings().usersync_storage.strip().lower() == "sqlite"


def _user_root(user_id: str) -> Path:
    root = get_settings().data_dir / "users" / user_id
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_artifact(
    user_id: str,
    folder: str,
    kind: str,
    data: Any,
    provenance: dict[str, Any] | None = None,
    artifact_id: str | None = None,
) -> dict[str, Any]:
    if _use_sqlite():
        from backend.app import sqlite_store

        return sqlite_store.save_artifact(user_id, folder, kind, data, provenance, artifact_id)
    artifact_id = artifact_id or f"{kind}-{uuid.uuid4().hex[:12]}"
    record = {
        "artifact_id": artifact_id,
        "kind": kind,
        "created_at": time.time(),
        "provenance": provenance or {},
        "data": data,
    }
    folder_path = _user_root(user_id) / folder
    folder_path.mkdir(parents=True, exist_ok=True)
    (folder_path / f"{artifact_id}.json").write_text(json.dumps(record))
    return record


def load_artifact(user_id: str, folder: str, artifact_id: str) -> dict[str, Any] | None:
    if _use_sqlite():
        from backend.app import sqlite_store

        return sqlite_store.load_artifact(user_id, folder, artifact_id)
    path = _user_root(user_id) / folder / f"{artifact_id}.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text())


def save_binary(user_id: str, folder: str, name: str, data: bytes) -> str:
    """Store a binary blob (e.g. a step screenshot) and return its repo path."""
    folder_path = _user_root(user_id) / folder
    folder_path.mkdir(parents=True, exist_ok=True)
    path = folder_path / name
    path.write_bytes(data)
    return str(path.relative_to(get_settings().data_dir))


def list_artifacts(user_id: str, folder: str) -> list[dict[str, Any]]:
    if _use_sqlite():
        from backend.app import sqlite_store

        return sqlite_store.list_artifacts(user_id, folder)
    folder_path = _user_root(user_id) / folder
    if not folder_path.is_dir():
        return []
    records = []
    for path in sorted(folder_path.glob("*.json")):
        record = json.loads(path.read_text())
        records.append({k: record[k] for k in ("artifact_id", "kind", "created_at", "provenance")})
    return records
