"""Developer, Identity & Billing API: credits, usage ledger (spec.md Tab 7)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.app.envelope import envelope
from backend.app.quota import account_state, get_user_id

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/credits", operation_id="account_credits")
def credits(user_id: str = Depends(get_user_id)):
    state = account_state(user_id)
    return envelope(data={"user_id": user_id, "credits": state["credits"]})


@router.get("/usage", operation_id="account_usage")
def usage(user_id: str = Depends(get_user_id)):
    state = account_state(user_id)
    return envelope(data={"user_id": user_id, "usage": state["usage"], "credits": state["credits"]})
