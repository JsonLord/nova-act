"""Phase-3 backend additions: streaming generation, connector verify, node provenance."""

import os
import tempfile
import time

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings

    get_settings.cache_clear()
    yield TestClient(create_app())
    get_settings.cache_clear()


def test_streaming_generation_grows_the_graph(client):
    started = client.post("/api/personas/generate", json={
        "company_name": "Acme", "count": 8, "seed": 4, "stream": True})
    assert started.status_code == 200
    assert started.json()["data"]["streaming"] is True
    hub_id = started.json()["artifact_id"]

    # The graph grows from 0 toward target as the job appends personas.
    final = None
    for _ in range(60):
        data = client.get(f"/api/personas/{hub_id}/graph").json()["data"]
        if len(data["nodes"]) == 8:
            final = data
            break
        time.sleep(0.03)
    assert final is not None
    # Each node carries its read-only discovered steering + provenance.
    node = final["nodes"][0]
    assert "discovered_steering" in node and "acting_allowed" in node["discovered_steering"]
    assert "provenance" in node


def test_node_provenance_on_synchronous_generation(client):
    body = client.post("/api/personas/generate", json={
        "company_name": "Acme", "count": 5, "datahub_snapshot_ids": ["snap-1"]}).json()
    node = body["data"]["graph"]["nodes"][0]
    assert node["provenance"]["datahub_snapshot_ids"] == ["snap-1"]


def test_connector_verify_uniform_shape(client):
    for connector in ("hubspot", "salesforce", "figma", "last30days", "monitoring", "neo4j"):
        data = client.get(f"/api/connectors/{connector}/verify").json()["data"]
        assert data["connector"] == connector
        assert "configured" in data and "connected" in data and "detail" in data

    # Configured CRM connector flips to configured=True.
    import backend.app.config as cfg

    cfg.get_settings.cache_clear()
    os.environ["HUBSPOT_TOKEN"] = "tok"
    cfg.get_settings.cache_clear()
    data = client.get("/api/connectors/hubspot/verify").json()["data"]
    assert data["configured"] is True
    del os.environ["HUBSPOT_TOKEN"]
    cfg.get_settings.cache_clear()
