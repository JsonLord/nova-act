"""Credits ledger: 1000 free credits per account, metered per quota category.

File-backed so it survives restarts on HF persistent storage; the gateway
remains the eventual source of truth (spec.md §9) — this is the per-station
enforcement point.
"""

from __future__ import annotations

import json
import threading
from typing import Any

from fastapi import Depends, HTTPException, Request

from backend.app.config import get_settings

_lock = threading.Lock()


def _ledger_path():
    root = get_settings().data_dir
    root.mkdir(parents=True, exist_ok=True)
    return root / "credits_ledger.json"


def _load() -> dict[str, Any]:
    path = _ledger_path()
    if path.is_file():
        return json.loads(path.read_text())
    return {}


def _store(ledger: dict[str, Any]) -> None:
    _ledger_path().write_text(json.dumps(ledger))


def get_user_id(request: Request) -> str:
    """Resolve the account: HF user cookie when present, else anonymous."""
    hf_user = request.cookies.get("hf_user")
    if hf_user:
        try:
            parsed = json.loads(hf_user)
            return str(parsed.get("preferred_username") or parsed.get("name") or "anonymous")
        except (ValueError, AttributeError):
            return "anonymous"
    return "anonymous"


def account_state(user_id: str) -> dict[str, Any]:
    with _lock:
        ledger = _load()
        state = ledger.get(user_id)
        if state is None:
            state = {"credits": get_settings().free_credits, "usage": {}}
            ledger[user_id] = state
            _store(ledger)
        return state


def charge(category: str, cost: int = 1):
    """Dependency factory: meters the call and rejects when credits run out."""

    def _charge(request: Request, user_id: str = Depends(get_user_id)) -> dict[str, Any]:
        with _lock:
            ledger = _load()
            state = ledger.setdefault(
                user_id, {"credits": get_settings().free_credits, "usage": {}}
            )
            if state["credits"] < cost:
                raise HTTPException(status_code=402, detail="Out of credits")
            state["credits"] -= cost
            state["usage"][category] = state["usage"].get(category, 0) + cost
            _store(ledger)
            return {
                "user_id": user_id,
                "category": category,
                "cost": cost,
                "credits_remaining": state["credits"],
            }

    return _charge
