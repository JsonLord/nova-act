"""HF-token auth: per-token 1000-request budgets, validation, cookie fallback."""

import os
import tempfile

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.app import hf_token_auth
from backend.app.main import create_app


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings

    get_settings.cache_clear()

    def fake_validate(token: str) -> str:
        if not token.startswith("hf_valid"):
            raise HTTPException(status_code=401, detail="Invalid Hugging Face token")
        return "leon"

    monkeypatch.setattr(hf_token_auth, "_validate_hf_token", fake_validate)
    yield TestClient(create_app())
    get_settings.cache_clear()


def test_invalid_token_is_rejected(client):
    response = client.get("/api/account/credits", headers={"Authorization": "Bearer hf_bogus"})
    assert response.status_code == 401


def test_each_token_gets_its_own_1000_budget(client):
    token_a = {"Authorization": "Bearer hf_valid_aaaa"}
    token_b = {"Authorization": "Bearer hf_valid_bbbb"}

    for headers in (token_a, token_b):
        state = client.get("/api/account/credits", headers=headers).json()["data"]
        assert state == {
            "user_id": "leon",
            "auth_via": "hf_token",
            "credits": 1000,
            "budget_scope": "per HF token (1000 requests each)",
        }

    spend = client.post(
        "/api/personas/generate",
        json={"company_name": "Acme", "count": 4},
        headers=token_a,
    )
    assert spend.status_code == 200
    assert spend.json()["quota"]["credits_remaining"] == 999

    # Same user, different token: budget untouched.
    assert client.get("/api/account/credits", headers=token_b).json()["data"]["credits"] == 1000
    # And the spent token's budget reflects the charge.
    assert client.get("/api/account/credits", headers=token_a).json()["data"]["credits"] == 999


def test_exhausted_token_gets_402(client, tmp_path):
    import json as jsonlib

    ledger_path = tmp_path / "credits_ledger.json"
    # Pre-drain the token's ledger entry to zero.
    client.get("/api/account/credits", headers={"Authorization": "Bearer hf_valid_poor"})
    ledger = jsonlib.loads(ledger_path.read_text())
    drained_key = next(k for k in ledger if k.startswith("hftok-"))
    ledger[drained_key]["credits"] = 0
    ledger_path.write_text(jsonlib.dumps(ledger))

    response = client.post(
        "/api/personas/generate",
        json={"company_name": "Acme", "count": 4},
        headers={"Authorization": "Bearer hf_valid_poor"},
    )
    assert response.status_code == 402


def test_cookie_fallback_still_works(client):
    client.cookies.set("hf_user", '{"preferred_username": "browser-leon"}')
    response = client.get("/api/account/credits")
    data = response.json()["data"]
    assert data["user_id"] == "browser-leon"
    assert data["auth_via"] == "cookie"
