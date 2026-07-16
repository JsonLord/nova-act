"""Screenshot-driven ux-chain: real ux-mentor response shape parses into pieces."""

import os
import tempfile

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.routers import uxchain

UX_MENTOR_RESPONSE = {
    "heatmap_data": {
        "analysis_data": {
            "screenshot": {
                "heatmap": [{"x": 50, "y": 20, "intensity": 0.9}] * 6,
                "report": "<h2>Overall Assessment</h2><p>Solid hero, weak CTA.</p>",
                "suggestions": [
                    {"x": 50, "y": 85, "suggestion": "Raise the CTA above the fold"}
                ],
                "drop_off_points": [{"x": 50, "y": 85, "reason": "CTA hidden below fold"}],
                "positive_points": [{"x": 50, "y": 15, "reason": "Clear hero headline"}],
                "ux_score": 68,
            }
        }
    }
}


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings

    get_settings.cache_clear()

    calls: list[tuple[str, dict]] = []

    async def fake_ux_mentor(endpoint, payload):
        calls.append((endpoint, payload))
        return UX_MENTOR_RESPONSE

    monkeypatch.setattr(uxchain, "_call_ux_mentor", fake_ux_mentor)
    test_client = TestClient(create_app())
    test_client.calls = calls  # type: ignore[attr-defined]
    yield test_client
    get_settings.cache_clear()


def test_screenshot_drives_real_analysis(client):
    response = client.post(
        "/api/ux-chain/runs",
        json={
            "mode": "ux_analysis",
            "screenshot_b64": "data:image/png;base64,AAAA",
            "prompt": "focus on conversion",
        },
    )
    assert response.status_code == 200
    body = response.json()

    # The screenshot endpoint was chosen and fed the SAME screenshot.
    endpoint, payload = client.calls[0]
    assert endpoint == "/generate_heatmap_screenshot/"
    assert payload["screenshot"] == "data:image/png;base64,AAAA"
    assert payload["user_prompt"] == "focus on conversion"

    pieces = body["data"]["pieces"]
    assert pieces[0]["ux_score"] == 68
    assert pieces[0]["body"].startswith("<h2>Overall Assessment</h2>")
    assert len(pieces[0]["heatmap_points"]) == 6
    assert pieces[1]["body"][0]["suggestion"] == "Raise the CTA above the fold"
    assert pieces[0]["simulated"] is False
    assert body["warnings"] == []


def test_figma_data_still_uses_figma_endpoint(client):
    response = client.post(
        "/api/ux-chain/runs",
        json={"mode": "ux_analysis", "figma_data": {"children": []}, "target_url": "https://x.io"},
    )
    assert response.status_code == 200
    endpoint, payload = client.calls[0]
    assert endpoint == "/generate_heatmap/"
    assert "figma_data" in payload
