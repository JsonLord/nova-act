"""Background job runner with a bounded worker pool and a persistent registry.

Journeys and social simulations were launched as bare `threading.Thread`
daemons — fine for a demo, but with no concurrency cap (the Space can only
host 1-2 browser sessions), no queue, and no visibility. This is the honest
prerequisite before real load (spec §17.4).

- A single `ThreadPoolExecutor` with `USERSYNC_MAX_WORKERS` bounds concurrent
  work (browser sessions in particular). Excess jobs queue.
- A persistent registry (JSON under /data) tracks each job's kind, status,
  target artifact, timing, and error, surviving handler crashes so the UI
  and `/api/jobs` can report queued/running/done/failed.
- `submit()` returns immediately with a job id; the callable runs on a
  worker. Errors are captured, not lost.

Persistence is process-recovery for *records*, not for in-flight execution:
a Space restart marks previously-running jobs `interrupted` (the artifact's
own status is the source of truth for partial progress).
"""

from __future__ import annotations

import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from backend.app.config import get_settings
from backend.app.storage import list_artifacts, load_artifact, save_artifact

_lock = threading.Lock()
_executor: ThreadPoolExecutor | None = None
_active = 0  # currently-running (not just submitted) job count


def _pool() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=get_settings().max_workers)
    return _executor


def _record(user_id: str, job_id: str, **fields: Any) -> None:
    existing = load_artifact(user_id, "jobs", job_id)
    data = existing["data"] if existing else {}
    data.update(fields)
    save_artifact(user_id, "jobs", "job", data, provenance={"job": True}, artifact_id=job_id)


def submit(
    user_id: str,
    kind: str,
    fn: Callable[[], Any],
    target_artifact_id: str | None = None,
) -> str:
    """Queue a job on the bounded pool; returns its id immediately."""
    job_id = f"job-{uuid.uuid4().hex[:12]}"
    _record(
        user_id, job_id, kind=kind, status="queued",
        target_artifact_id=target_artifact_id, submitted_at=time.time(),
    )

    def wrapped() -> None:
        global _active
        with _lock:
            _active += 1
        _record(user_id, job_id, status="running", started_at=time.time())
        try:
            fn()
            _record(user_id, job_id, status="done", ended_at=time.time())
        except Exception as error:  # capture, never lose
            _record(user_id, job_id, status="failed", ended_at=time.time(), error=str(error)[:500])
        finally:
            with _lock:
                _active -= 1

    _pool().submit(wrapped)
    return job_id


def active_count() -> int:
    with _lock:
        return _active


def queue_state() -> dict[str, int]:
    return {"active": active_count(), "max_workers": get_settings().max_workers}


def list_jobs(user_id: str) -> list[dict[str, Any]]:
    jobs = []
    for entry in list_artifacts(user_id, "jobs"):
        record = load_artifact(user_id, "jobs", entry["artifact_id"])
        if record:
            jobs.append({"job_id": entry["artifact_id"], **record["data"]})
    return sorted(jobs, key=lambda j: j.get("submitted_at", 0), reverse=True)


def reconcile_on_startup(user_id: str) -> None:
    """Mark jobs that were running when the process died as interrupted."""
    for entry in list_artifacts(user_id, "jobs"):
        record = load_artifact(user_id, "jobs", entry["artifact_id"])
        if record and record["data"].get("status") in ("queued", "running"):
            _record(user_id, entry["artifact_id"], status="interrupted", ended_at=time.time())


def reconcile_all() -> None:
    """Reconcile stale jobs for every user with a jobs folder (startup)."""
    users_dir = get_settings().data_dir / "users"
    if not users_dir.is_dir():
        return
    for user_dir in users_dir.iterdir():
        if (user_dir / "jobs").is_dir():
            reconcile_on_startup(user_dir.name)
