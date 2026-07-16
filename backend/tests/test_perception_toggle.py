"""CPU/ZeroGPU perception toggle: gating, auto mode, runtime flip, escalation."""

import os
import tempfile

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings

    get_settings.cache_clear()
    test_client = TestClient(create_app())
    test_client.cookies.set("hf_user", '{"preferred_username": "leon"}')
    yield test_client
    get_settings.cache_clear()


def test_cpu_mode_disables_visual_even_with_url(monkeypatch):
    monkeypatch.setenv("USERSYNC_PERCEPTION", "cpu")
    monkeypatch.setenv("OMNIPARSER_BASE_URL", "https://parser.hf.space")
    from backend.app.config import get_settings

    get_settings.cache_clear()
    assert get_settings().visual_perception_enabled is False
    get_settings.cache_clear()


def test_zerogpu_mode_enables_visual(monkeypatch):
    monkeypatch.setenv("USERSYNC_PERCEPTION", "zerogpu")
    monkeypatch.delenv("OMNIPARSER_BASE_URL", raising=False)
    from backend.app.config import get_settings

    get_settings.cache_clear()
    assert get_settings().visual_perception_enabled is True
    get_settings.cache_clear()


def test_auto_mode_follows_url_presence(monkeypatch):
    from backend.app.config import get_settings

    monkeypatch.setenv("USERSYNC_PERCEPTION", "auto")
    monkeypatch.delenv("OMNIPARSER_BASE_URL", raising=False)
    get_settings.cache_clear()
    assert get_settings().visual_perception_enabled is False

    monkeypatch.setenv("OMNIPARSER_BASE_URL", "https://parser.hf.space")
    get_settings.cache_clear()
    assert get_settings().visual_perception_enabled is True
    get_settings.cache_clear()


def test_capabilities_endpoint_reports_tier(client, monkeypatch):
    body = client.get("/api/account/capabilities").json()["data"]
    assert body["perception_tier"] in ("cpu", "zerogpu")
    assert "visual_perception_enabled" in body


def test_runtime_flip_requires_login_and_changes_tier(client):
    anonymous = client.__class__(client.app)
    assert anonymous.post("/api/account/capabilities/perception", json={"mode": "zerogpu"}).status_code == 401

    flipped = client.post("/api/account/capabilities/perception", json={"mode": "zerogpu"})
    assert flipped.status_code == 200
    assert flipped.json()["data"]["perception_tier"] == "zerogpu"

    back = client.post("/api/account/capabilities/perception", json={"mode": "cpu"})
    assert back.json()["data"]["visual_perception_enabled"] is False


def test_escalation_skipped_in_cpu_mode(monkeypatch):
    """_try_omniparser returns None under cpu mode without any network call."""
    monkeypatch.setenv("USERSYNC_PERCEPTION", "cpu")
    monkeypatch.setenv("OMNIPARSER_BASE_URL", "https://parser.hf.space")
    from backend.app.config import get_settings
    from backend.app.engines.open_engine import _try_omniparser

    get_settings.cache_clear()

    class BoomPage:
        def screenshot(self):
            raise AssertionError("must not be called in cpu mode")

    assert _try_omniparser(BoomPage()) is None
    get_settings.cache_clear()
