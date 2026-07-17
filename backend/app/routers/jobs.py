"""Jobs API: background-job visibility and queue state (spec §17.4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from backend.app.envelope import envelope
from backend.app.jobs import list_jobs, queue_state
from backend.app.quota import get_user_id
from backend.app.storage import load_artifact

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", operation_id="jobs_list")
def jobs(user_id: str = Depends(get_user_id)):
    return envelope(data={"jobs": list_jobs(user_id), "queue": queue_state()})


@router.get("/{job_id}", operation_id="jobs_get")
def job(job_id: str, user_id: str = Depends(get_user_id)):
    record = load_artifact(user_id, "jobs", job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="job not found")
    return envelope(data={"job_id": job_id, **record["data"]})
