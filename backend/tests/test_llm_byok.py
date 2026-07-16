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
    yield TestClient(create_app())
    get_settings.cache_clear()


def test_provider_catalog_differentiates_modalities(client):
    providers = {p["id"]: p for p in client.get("/api/account/llm-providers").json()["data"]}
    assert providers["huggingface"]["text_default"] == "meta-llama/Llama-3.3-70B-Instruct"
    assert providers["huggingface"]["vision_default"] == "Qwen/Qwen2.5-VL-72B-Instruct"
    assert providers["blablador"]["supports_vision"] is False
    assert providers["openai"]["supports_vision"] is True


def test_save_and_masked_read_per_slot(client):
    response = client.post(
        "/api/account/llm-config",
        json={
            "text": {"provider": "blablador", "api_key": "glpat-secret-token-123"},
            "vision": {"provider": "huggingface", "model": "Qwen/Qwen2.5-VL-72B-Instruct", "api_key": "hf_secret_abcd"},
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["text"]["api_key"] == "glpat…-123"
    assert data["text"]["api_key_set"] is True
    assert data["vision"]["provider"] == "huggingface"
    assert "hf_secret_abcd" not in str(data)

    # Re-saving without a key keeps the stored one.
    again = client.post(
        "/api/account/llm-config",
        json={"text": {"provider": "blablador"}, "vision": None},
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
    saved = resolve_llm(FakeRequest(), "anonymous", "text")
    assert saved.source == "saved" and saved.model == "gpt-4.1-mini"

    # Headers override saved, with separate vision headers.
    headers = {
        "x-llm-provider": "blablador",
        "x-llm-key": "glpat-header",
        "x-llm-vision-provider": "gemini",
        "x-llm-vision-key": "AIza-header",
    }
    text = resolve_llm(FakeRequest(headers), "anonymous", "text")
    vision = resolve_llm(FakeRequest(headers), "anonymous", "vision")
    assert (text.provider, text.source) == ("blablador", "headers")
    assert (vision.provider, vision.model) == ("gemini", "gemini-2.0-flash")

    # Provider without a vision model resolves to None for vision.
    no_vision = resolve_llm(FakeRequest({"x-llm-vision-provider": "blablador", "x-llm-vision-key": "x"}), "anonymous", "vision")
    assert no_vision is None


def test_env_fallback_for_text_only(client, monkeypatch):
    from backend.app.config import get_settings
    from backend.app.llm_config import resolve_llm

    monkeypatch.setenv("BLABLADOR_API_KEY", "glpat-env")
    get_settings.cache_clear()

    class FakeRequest:
        headers: dict = {}
        cookies: dict = {}

    resolved = resolve_llm(FakeRequest(), "someone-unconfigured", "text")
    assert (resolved.provider, resolved.source) == ("blablador", "server_env")
    assert resolve_llm(FakeRequest(), "someone-unconfigured", "vision") is None
    get_settings.cache_clear()
