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


def _use_sqlite() -> bool:
    return get_settings().usersync_storage.strip().lower() == "sqlite"


def _ledger_path():
    root = get_settings().data_dir
    root.mkdir(parents=True, exist_ok=True)
    return root / "credits_ledger.json"


def _load_entry(ledger_key: str) -> dict[str, Any] | None:
    """Load one account's ledger entry (per-row in sqlite mode — no whole-file
    rewrite hazard under the concurrent job pool)."""
    if _use_sqlite():
        from backend.app.storage import load_artifact

        record = load_artifact("__ledger__", "credits", ledger_key)
        return record["data"] if record else None
    path = _ledger_path()
    if path.is_file():
        return json.loads(path.read_text()).get(ledger_key)
    return None


def _store_entry(ledger_key: str, state: dict[str, Any]) -> None:
    if _use_sqlite():
        from backend.app.storage import save_artifact

        save_artifact("__ledger__", "credits", "credit", state, artifact_id=ledger_key)
        return
    path = _ledger_path()
    ledger = json.loads(path.read_text()) if path.is_file() else {}
    ledger[ledger_key] = state
    path.write_text(json.dumps(ledger))


def get_user_id(request: Request) -> str:
    """Resolve the account owner (storage paths): HF token bearer, cookie, or anonymous."""
    from backend.app.hf_token_auth import resolve_identity

    return resolve_identity(request).user_id


def get_ledger_key(request: Request) -> str:
    """Resolve the budget key: per-HF-token for API callers (each token gets
    its own 1000-request budget), username for browser sessions."""
    from backend.app.hf_token_auth import resolve_identity

    return resolve_identity(request).ledger_key


def account_state(user_id: str) -> dict[str, Any]:
    with _lock:
        state = _load_entry(user_id)
        if state is None:
            state = {"credits": get_settings().free_credits, "usage": {}}
            _store_entry(user_id, state)
        return state


def charge(category: str, cost: int = 1):
    """Dependency factory: meters the call and rejects when credits run out."""

    def _charge(request: Request, ledger_key: str = Depends(get_ledger_key)) -> dict[str, Any]:
        with _lock:
            state = _load_entry(ledger_key) or {"credits": get_settings().free_credits, "usage": {}}
            if state["credits"] < cost:
                raise HTTPException(
                    status_code=402,
                    detail="Out of credits for this token/account (1000 free API requests per HF token)",
                )
            state["credits"] -= cost
            state["usage"][category] = state["usage"].get(category, 0) + cost
            _store_entry(ledger_key, state)
            return {
                "ledger_key": ledger_key,
                "category": category,
                "cost": cost,
                "credits_remaining": state["credits"],
            }

    return _charge
