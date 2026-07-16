"""Developer, Identity & Billing API: credits, usage ledger (spec.md Tab 7)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.app.envelope import envelope
from backend.app.hf_token_auth import resolve_identity
from backend.app.llm_config import (
    PROVIDERS,
    LlmConfig,
    Modality,
    load_llm_config,
    resolve_llm,
    save_llm_config,
)
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


@router.get("/llm-providers", operation_id="account_llm_providers")
def llm_providers():
    """BYOK provider catalog: per-provider defaults for the text and vision
    (multimodal) slots, so the frontend can prefill model fields."""
    return envelope(
        data=[
            {
                "id": provider_id,
                "label": meta["label"],
                "base_url": meta["base_url"],
                "token_hint": meta["token_hint"],
                "text_default": meta["text_default"],
                "vision_default": meta["vision_default"],
                "supports_vision": meta["vision_default"] is not None,
            }
            for provider_id, meta in PROVIDERS.items()
        ]
    )


def _require_login(request: Request):
    """Credentials are session-only and bound to a logged-in HF identity —
    anonymous callers must use per-request X-LLM-* headers instead."""
    identity = resolve_identity(request)
    if identity.via == "anonymous":
        raise HTTPException(
            status_code=401,
            detail="Sign in with Hugging Face to store keys for this session "
            "(or pass X-LLM-* headers per request without storing anything)",
        )
    return identity


@router.get("/llm-config", operation_id="account_llm_config_get")
def llm_config_get(request: Request):
    identity = _require_login(request)
    config = load_llm_config(identity.user_id)
    return envelope(
        data={
            "text": config.text.masked() if config and config.text else None,
            "vision": config.vision.masked() if config and config.vision else None,
            "storage": "session-only (in-memory, TTL 12h, cleared on restart)",
        }
    )


@router.post("/llm-config", operation_id="account_llm_config_set")
def llm_config_set(body: LlmConfig, request: Request):
    """Save BYOK slots for the logged-in HF user's session. Keys are held
    in-memory only (TTL-bound, never persisted) and masked on every read.
    Sending a slot without api_key keeps the previously stored key."""
    identity = _require_login(request)
    previous = load_llm_config(identity.user_id)
    for modality in ("text", "vision"):
        slot = getattr(body, modality)
        old = getattr(previous, modality, None) if previous else None
        if slot and not slot.api_key and old and old.provider == slot.provider:
            slot.api_key = old.api_key
    save_llm_config(identity.user_id, body)
    config = load_llm_config(identity.user_id)
    return envelope(
        data={
            "text": config.text.masked() if config.text else None,
            "vision": config.vision.masked() if config.vision else None,
        }
    )


@router.delete("/llm-config", operation_id="account_llm_config_delete")
def llm_config_delete(request: Request):
    identity = _require_login(request)
    save_llm_config(identity.user_id, LlmConfig())
    return envelope(data={"text": None, "vision": None})


@router.post("/llm-config/test/{modality}", operation_id="account_llm_config_test")
async def llm_config_test(modality: Modality, request: Request):
    """Fire a one-token live call through the resolved slot so the user can
    verify provider/model/token before running real workloads."""
    identity = _require_login(request)
    resolved = resolve_llm(request, identity.user_id, modality)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"No {modality} model configured")
    from backend.app.llm import LlmCallError, chat

    try:
        reply = await chat(resolved, "Reply with the single word: ok", temperature=0.0, timeout_s=30)
        ok = True
    except LlmCallError as error:
        reply = str(error)
        ok = False
    return envelope(
        data={
            "ok": ok,
            "provider": resolved.provider,
            "model": resolved.model,
            "source": resolved.source,
            "reply": reply[:200],
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
