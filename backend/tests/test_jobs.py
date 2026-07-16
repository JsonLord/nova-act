"""Bounded job runner (item 9): concurrency cap, status tracking, visibility."""

import os
import tempfile
import threading
import time

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture()
def env(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("USERSYNC_MAX_WORKERS", "2")
    from backend.app.config import get_settings

    get_settings.cache_clear()
    # Reset the pool so the new max_workers takes effect.
    import backend.app.jobs as jobs

    jobs._executor = None
    yield jobs
    jobs._executor = None
    get_settings.cache_clear()


def test_status_lifecycle_and_error_capture(env):
    jobs = env
    done = threading.Event()
    jobs.submit("u", "test", lambda: done.set())
    assert done.wait(2)
    time.sleep(0.1)
    records = jobs.list_jobs("u")
    assert records[0]["status"] == "done"

    boom = jobs.submit("u", "test", lambda: (_ for _ in ()).throw(RuntimeError("kaboom")))
    time.sleep(0.3)
    failed = next(j for j in jobs.list_jobs("u") if j["job_id"] == boom)
    assert failed["status"] == "failed" and "kaboom" in failed["error"]


def test_concurrency_is_bounded(env):
    jobs = env
    peak = [0]
    lock = threading.Lock()
    release = threading.Event()

    def slow():
        with lock:
            peak[0] = max(peak[0], jobs.active_count())
        release.wait(2)

    for _ in range(6):
        jobs.submit("u", "slow", slow)
    time.sleep(0.3)
    running_now = jobs.active_count()
    release.set()
    time.sleep(0.3)
    assert running_now <= 2  # never exceeds max_workers
    assert peak[0] <= 2


def test_jobs_endpoint_reports_queue(env, monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings

    get_settings.cache_clear()
    client = TestClient(create_app())
    body = client.get("/api/jobs").json()["data"]
    assert body["queue"]["max_workers"] == 2
    assert "jobs" in body


def test_reconcile_marks_interrupted(env):
    jobs = env
    jobs._record("u", "job-stuck", kind="journey", status="running", submitted_at=time.time())
    jobs.reconcile_on_startup("u")
    stuck = next(j for j in jobs.list_jobs("u") if j["job_id"] == "job-stuck")
    assert stuck["status"] == "interrupted"
