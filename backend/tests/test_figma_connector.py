"""Figma connector (item 7): node-tree extraction + import endpoint."""

import os
import tempfile

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app.connectors.figma import extract_frames, normalize_design_snapshot
from backend.app.main import create_app

FILE_JSON = {
    "name": "Checkout Redesign",
    "lastModified": "2026-07-01T00:00:00Z",
    "document": {
        "type": "DOCUMENT",
        "children": [
            {
                "type": "CANVAS",
                "name": "Flows",
                "children": [
                    {
                        "type": "FRAME",
                        "id": "1:2",
                        "name": "Cart",
                        "absoluteBoundingBox": {"width": 390, "height": 844},
                        "children": [
                            {"type": "TEXT", "characters": "Your cart"},
                            {"type": "FRAME", "id": "1:3", "name": "nested", "children": [
                                {"type": "TEXT", "characters": "Checkout"},
                            ]},
                        ],
                    },
                    {"type": "FRAME", "id": "1:4", "name": "Payment",
                     "absoluteBoundingBox": {"width": 390, "height": 844}, "children": []},
                    {"type": "COMPONENT", "id": "1:5", "name": "not a frame"},
                ],
            }
        ],
    },
}


def test_extract_frames_flattens_tree():
    frames = extract_frames(FILE_JSON)
    assert [f["name"] for f in frames] == ["Cart", "Payment"]  # only top-level FRAMEs
    cart = frames[0]
    assert cart["page"] == "Flows" and cart["width"] == 390
    assert "Your cart" in cart["text"] and "Checkout" in cart["text"]  # nested text collected


def test_normalize_snapshot():
    snap = normalize_design_snapshot("abc123", FILE_JSON)
    assert snap["name"] == "Checkout Redesign" and snap["frame_count"] == 2


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings

    get_settings.cache_clear()
    yield TestClient(create_app())
    get_settings.cache_clear()


def test_figma_import_endpoint(client, monkeypatch):
    def fake_get(url, **kwargs):
        request = httpx.Request("GET", url)
        return httpx.Response(200, json=FILE_JSON, request=request)

    monkeypatch.setattr(httpx, "get", fake_get)
    response = client.post("/api/connectors/figma/import", json={"file_key": "abc123", "token": "figd_x"})
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["frames"] == 2 and body["data"]["file"] == "Checkout Redesign"
    # Token not persisted in provenance.
    assert "figd_x" not in str(body["provenance"])


def test_figma_import_surfaces_auth_error(client, monkeypatch):
    def fake_get(url, **kwargs):
        return httpx.Response(403, text="forbidden", request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx, "get", fake_get)
    response = client.post("/api/connectors/figma/import", json={"file_key": "abc", "token": "bad"})
    assert response.status_code == 502
    assert "403" in response.json()["detail"]
