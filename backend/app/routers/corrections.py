"""Corrections API: audited value injection into completed artifacts."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.app.corrections import CORRECTABLE_FOLDERS, CorrectionError, inject_correction, revert_last
from backend.app.envelope import envelope
from backend.app.hf_token_auth import resolve_identity
from backend.app.quota import get_user_id
from backend.app.storage import load_artifact
from pydantic import BaseModel

router = APIRouter(prefix="/api/corrections", tags=["corrections"])


class CorrectionRequest(BaseModel):
    folder: str
    artifact_id: str
    path: str
    value: Any
    reason: str = ""


@router.post("", operation_id="correction_inject")
def inject(body: CorrectionRequest, request: Request, user_id: str = Depends(get_user_id)):
    """Inject a corrected value into a completed artifact (past-job fix). The
    original value is kept and the correction is audited on the artifact."""
    by = resolve_identity(request).user_id
    try:
        correction = inject_correction(user_id, body.folder, body.artifact_id, body.path,
                                       body.value, body.reason, by)
    except CorrectionError as error:
        raise HTTPException(status_code=422, detail=str(error))
    return envelope(data=correction, artifact_id=body.artifact_id)


@router.get("/{folder}/{artifact_id}", operation_id="correction_list")
def list_corrections(folder: str, artifact_id: str, user_id: str = Depends(get_user_id)):
    if folder not in CORRECTABLE_FOLDERS:
        raise HTTPException(status_code=422, detail=f"folder '{folder}' is not correctable")
    record = load_artifact(user_id, folder, artifact_id)
    if record is None:
        raise HTTPException(status_code=404, detail="artifact not found")
    return envelope(data={
        "corrections": record["data"].get("corrections", []),
        "history": record["data"].get("correction_history", []),
    })


@router.post("/{folder}/{artifact_id}/revert", operation_id="correction_revert")
def revert(folder: str, artifact_id: str, user_id: str = Depends(get_user_id)):
    """Undo the most recent correction (restores its original value)."""
    reverted = revert_last(user_id, folder, artifact_id)
    if reverted is None:
        raise HTTPException(status_code=404, detail="no correction to revert")
    return envelope(data=reverted, artifact_id=artifact_id)
