"""HF-token API authentication with a per-token request budget.

Since the backend runs on a Hugging Face Space, callers authenticate with
their own HF token (`Authorization: Bearer hf_...`) — no UserSync-issued
keys needed. The token is validated against the HF Hub (`whoami-v2`) and
metered independently: **each token gets its own budget of 1000 API
requests** (FREE_CREDITS). Rotating to a fresh token starts a fresh budget,
which is exactly the intended free-tier shape; paid tiers lift the cap via
the account layer.

Identity resolution order:
1. `Authorization: Bearer hf_...` header  -> validated HF token
   (user_id = HF username, ledger key = sha256 of the token, so budgets are
   per-token; raw tokens are never stored or logged)
2. `hf_user` cookie (browser OAuth session) -> username-keyed budget
3. anonymous

whoami-v2 responses are cached in-process for 10 minutes so HF is not hit
on every API call.
"""

from __future__ import annotations

import hashlib
import json
import threading
import time
from dataclasses import dataclass

import httpx
from fastapi import HTTPException, Request

WHOAMI_URL = "https://huggingface.co/api/whoami-v2"
_CACHE_TTL_S = 600.0

_cache_lock = threading.Lock()
_token_cache: dict[str, tuple[float, str]] = {}  # token_hash -> (expires_at, username)


@dataclass
class Identity:
    user_id: str  # HF username (storage paths, artifact ownership)
    ledger_key: str  # budget key: per-token for API tokens, username for cookies
    via: str  # "hf_token" | "cookie" | "anonymous"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()[:16]


def _validate_hf_token(token: str) -> str:
    """Return the HF username for a token, 401 on anything invalid."""
    token_hash = _hash_token(token)
    now = time.time()
    with _cache_lock:
        cached = _token_cache.get(token_hash)
        if cached and cached[0] > now:
            return cached[1]
    try:
        response = httpx.get(
            WHOAMI_URL, headers={"Authorization": f"Bearer {token}"}, timeout=10
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Could not reach huggingface.co to validate token")
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Hugging Face token")
    username = str(response.json().get("name") or "hf-user")
    with _cache_lock:
        _token_cache[token_hash] = (now + _CACHE_TTL_S, username)
    return username


def resolve_identity(request: Request) -> Identity:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        username = _validate_hf_token(token)
        return Identity(user_id=username, ledger_key=f"hftok-{_hash_token(token)}", via="hf_token")

    hf_user = request.cookies.get("hf_user")
    if hf_user:
        try:
            parsed = json.loads(hf_user)
            username = str(parsed.get("preferred_username") or parsed.get("name") or "anonymous")
            return Identity(user_id=username, ledger_key=username, via="cookie")
        except (ValueError, AttributeError):
            pass
    return Identity(user_id="anonymous", ledger_key="anonymous", via="anonymous")
