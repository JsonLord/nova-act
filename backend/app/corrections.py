"""Audited value injection — past-job corrections (dev retroactive fixes).

Lets a developer inject a corrected value into a *completed* artifact (a
journey run's steering, a persona's field, an analysis result) by dotted
path. Every injection is **audited, not silent**: the original value is kept
and a correction record (path, from, to, reason, when, who) is appended to
the artifact, so corrections are reversible and traceable.

Guardrails: owner-only (the artifact store is already per-user), a folder
allow-list (never account/credits/jobs/system), and reserved-path protection
(cannot rewrite `provenance` or `corrections` themselves).
"""

from __future__ import annotations

import time
from typing import Any

from backend.app.storage import load_artifact, save_artifact

CORRECTABLE_FOLDERS = {"journeys", "personas", "analyses", "steering", "social_mirror", "design_reviews"}
RESERVED_ROOTS = {"corrections", "provenance"}


class CorrectionError(ValueError):
    pass


def _get_by_path(data: Any, path: str) -> Any:
    node = data
    for seg in path.split("."):
        if isinstance(node, list):
            node = node[int(seg)]
        elif isinstance(node, dict) and seg in node:
            node = node[seg]
        else:
            raise CorrectionError(f"path not found: {path}")
    return node


def _set_by_path(data: Any, path: str, value: Any) -> Any:
    """Set an existing path (no silent creation of new structure). Returns the
    previous value."""
    segs = path.split(".")
    node = data
    for seg in segs[:-1]:
        if isinstance(node, list):
            node = node[int(seg)]
        elif isinstance(node, dict) and seg in node:
            node = node[seg]
        else:
            raise CorrectionError(f"path not found: {path}")
    last = segs[-1]
    if isinstance(node, list):
        idx = int(last)
        if not 0 <= idx < len(node):
            raise CorrectionError(f"index out of range: {path}")
        previous = node[idx]
        node[idx] = value
    elif isinstance(node, dict):
        if last not in node:
            raise CorrectionError(f"path not found (no silent create): {path}")
        previous = node[last]
        node[last] = value
    else:
        raise CorrectionError(f"cannot set into {type(node).__name__} at {path}")
    return previous


def inject_correction(
    user_id: str, folder: str, artifact_id: str, path: str, value: Any, reason: str, by: str,
) -> dict[str, Any]:
    if folder not in CORRECTABLE_FOLDERS:
        raise CorrectionError(f"folder '{folder}' is not correctable")
    root = path.split(".", 1)[0]
    if root in RESERVED_ROOTS:
        raise CorrectionError(f"cannot correct reserved path '{root}'")

    record = load_artifact(user_id, folder, artifact_id)
    if record is None:
        raise CorrectionError("artifact not found")
    data = record["data"]

    previous = _set_by_path(data, path, value)
    correction = {
        "path": path, "from": previous, "to": value, "reason": reason,
        "by": by, "at": time.time(),
    }
    data.setdefault("corrections", []).append(correction)
    save_artifact(user_id, folder, record["kind"], data,
                  provenance={**record["provenance"], "corrected": True}, artifact_id=artifact_id)
    return correction


def revert_last(user_id: str, folder: str, artifact_id: str) -> dict[str, Any] | None:
    """Undo the most recent correction (restores its `from` value)."""
    record = load_artifact(user_id, folder, artifact_id)
    if record is None or not record["data"].get("corrections"):
        return None
    data = record["data"]
    last = data["corrections"].pop()
    _set_by_path(data, last["path"], last["from"])
    reverted = {**last, "reverted": True, "reverted_at": time.time()}
    data.setdefault("correction_history", []).append(reverted)
    save_artifact(user_id, folder, record["kind"], data, provenance=record["provenance"], artifact_id=artifact_id)
    return reverted
