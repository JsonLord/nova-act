"""BYOK: per-modality slots, masking, resolution order (headers > saved > env)."""

import os
import tempfile

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("BLABLADOR_API_KEY", raising=False)
    from backend.app.config import get_settings

    get_settings.cache_clear()
    test_client = TestClient(create_app())
    test_client.cookies.set("hf_user", '{"preferred_username": "leon"}')
    yield test_client
    get_settings.cache_clear()


def test_provider_catalog_differentiates_modalities(client):
    providers = {p["id"]: p for p in client.get("/api/account/llm-providers").json()["data"]}
    assert providers["huggingface"]["text_default"] == "meta-llama/Llama-3.3-70B-Instruct"
    assert providers["huggingface"]["vision_default"] == "Qwen/Qwen2.5-VL-72B-Instruct"
    assert "blablador" not in providers  # excluded provider
    assert providers["openai"]["supports_vision"] is True


def test_save_and_masked_read_per_slot(client):
    response = client.post(
        "/api/account/llm-config",
        json={
            "text": {"provider": "openai", "api_key": "sk-secret-token-1234"},
            "vision": {"provider": "huggingface", "model": "Qwen/Qwen2.5-VL-72B-Instruct", "api_key": "hf_secret_abcd"},
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["text"]["api_key"] == "sk-se…1234"
    assert data["text"]["api_key_set"] is True
    assert data["vision"]["provider"] == "huggingface"
    assert "hf_secret_abcd" not in str(data)
    assert "sk-secret-token-1234" not in str(data)

    # Re-saving without a key keeps the stored one.
    again = client.post(
        "/api/account/llm-config",
        json={"text": {"provider": "openai"}, "vision": None},
    )
    assert again.json()["data"]["text"]["api_key_set"] is True
    assert again.json()["data"]["vision"] is None


def test_resolution_order_headers_saved_env(client, monkeypatch):
    from backend.app.llm_config import resolve_llm

    class FakeRequest:
        def __init__(self, headers=None, cookies=None):
            self.headers = headers or {}
            self.cookies = cookies or {}

    # Nothing configured -> None for both modalities.
    assert resolve_llm(FakeRequest(), "anonymous", "text") is None
    assert resolve_llm(FakeRequest(), "anonymous", "vision") is None

    # Saved config wins next.
    client.post(
        "/api/account/llm-config",
        json={"text": {"provider": "openai", "api_key": "sk-saved"}},
    )
    saved = resolve_llm(FakeRequest(), "leon", "text")
    assert saved.source == "saved" and saved.model == "gpt-4.1-mini"

    # Headers override saved, with separate vision headers.
    headers = {
        "x-llm-provider": "huggingface",
        "x-llm-key": "hf_header",
        "x-llm-vision-provider": "gemini",
        "x-llm-vision-key": "AIza-header",
    }
    text = resolve_llm(FakeRequest(headers), "leon", "text")
    vision = resolve_llm(FakeRequest(headers), "leon", "vision")
    assert (text.provider, text.source) == ("huggingface", "headers")
    assert (vision.provider, vision.model) == ("gemini", "gemini-2.0-flash")

    # A provider slot without a model for the modality resolves to None.
    no_vision = resolve_llm(FakeRequest({"x-llm-vision-provider": "custom", "x-llm-vision-key": "x"}), "anonymous", "vision")
    assert no_vision is None


def test_no_server_fallback_byok_is_mandatory(client):
    from backend.app.llm_config import resolve_llm

    class FakeRequest:
        headers: dict = {}
        cookies: dict = {}

    assert resolve_llm(FakeRequest(), "someone-unconfigured", "text") is None
    assert resolve_llm(FakeRequest(), "someone-unconfigured", "vision") is None


def test_credentials_are_session_only_and_login_gated(client):
    import json as jsonlib
    from pathlib import Path

    # Anonymous callers cannot store or read stored keys.
    anonymous = client.__class__(client.app)
    assert anonymous.get("/api/account/llm-config").status_code == 401
    assert anonymous.post(
        "/api/account/llm-config", json={"text": {"provider": "openai", "api_key": "sk-x"}}
    ).status_code == 401

    # Logged-in save works — and the key never touches disk.
    client.post("/api/account/llm-config", json={"text": {"provider": "openai", "api_key": "sk-session-secret"}})
    data_dir = Path(__import__("os").environ["USERSYNC_DATA_DIR"])
    on_disk = "".join(p.read_text() for p in data_dir.rglob("*.json"))
    assert "sk-session-secret" not in on_disk

    # TTL expiry clears the session config.
    from backend.app import llm_config as mod

    with mod._session_lock:
        expires, config = mod._session_store["leon"]
        mod._session_store["leon"] = (0.0, config)
    assert client.get("/api/account/llm-config").json()["data"]["text"] is None
