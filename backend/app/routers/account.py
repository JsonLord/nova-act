"""Developer, Identity & Billing API: credits, usage ledger (spec.md Tab 7)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from backend.app.envelope import envelope
from backend.app.hf_token_auth import resolve_identity
from backend.app.quota import account_state

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/credits", operation_id="account_credits")
def credits(request: Request):
    identity = resolve_identity(request)
    state = account_state(identity.ledger_key)
    return envelope(
        data={
            "user_id": identity.user_id,
            "auth_via": identity.via,
            "credits": state["credits"],
            "budget_scope": "per HF token (1000 requests each)" if identity.via == "hf_token" else "per account",
        }
    )


@router.get("/usage", operation_id="account_usage")
def usage(request: Request):
    identity = resolve_identity(request)
    state = account_state(identity.ledger_key)
    return envelope(
        data={
            "user_id": identity.user_id,
            "auth_via": identity.via,
            "usage": state["usage"],
            "credits": state["credits"],
        }
    )
