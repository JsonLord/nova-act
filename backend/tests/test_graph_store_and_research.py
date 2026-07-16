"""Neo4j graph-store placeholder (item 10) + last30days connector (item 8)."""

import os
import tempfile

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("NEO4J_URI", raising=False)
    monkeypatch.delenv("NEO4J_PASSWORD", raising=False)
    from backend.app.config import get_settings

    get_settings.cache_clear()
    yield TestClient(create_app())
    get_settings.cache_clear()


def test_graph_store_status_unconfigured(client):
    body = client.get("/api/graph-store/status").json()["data"]
    assert body["configured"] is False and body["connected"] is False
    assert "NEO4J_URI" in body["detail"]


def test_graph_store_status_configured_but_no_driver(client, monkeypatch):
    monkeypatch.setenv("NEO4J_URI", "neo4j+s://demo.databases.neo4j.io")
    monkeypatch.setenv("NEO4J_PASSWORD", "secret")
    from backend.app.config import get_settings

    get_settings.cache_clear()
    body = client.get("/api/graph-store/status").json()["data"]
    assert body["configured"] is True
    # Either the driver is absent (placeholder) or the (fake) connection fails —
    # both must be reported as not-connected, never a 500.
    assert body["connected"] is False
    get_settings.cache_clear()


def test_graph_export_dry_run_when_unconnected(client):
    hub = client.post("/api/personas/generate", json={"company_name": "Acme", "count": 6}).json()
    export = client.post("/api/graph-store/export", json={"persona_hub_id": hub["artifact_id"]})
    assert export.status_code == 200
    data = export.json()["data"]
    assert data["exported"] is False  # no live DB
    assert data["would_write"]["nodes"] == 6


def test_last30days_import_returns_normalized_drop(client):
    response = client.post("/api/connectors/last30days/import", json={
        "topic": "Acme Storefront", "platforms": ["reddit", "x", "tiktok"],
    })
    assert response.status_code == 200
    body = response.json()
    summary = body["data"]["summary"]
    assert set(["sentiment", "top_topics", "activity_level", "sample_quotes"]) <= set(summary)
    assert "reddit" in body["data"]["supported_platforms"]
    # Unsupported platforms are filtered.
    assert all(p in body["data"]["supported_platforms"] for p in summary["platforms"])


def test_research_drop_flows_into_unify(client):
    drop = client.post("/api/connectors/last30days/import", json={"topic": "Acme", "platforms": ["reddit"]})
    drop_id = drop.json()["artifact_id"]

    unify = client.post("/api/datahub/unify", json={
        "mode": "company_social",
        "crm_records": [{"age": 30, "country": "US"}],
        "research_drop_id": drop_id,
    })
    assert unify.status_code == 200
    traits = unify.json()["data"]
    assert "brand_affinity" in traits  # research drop shaped affinity
    assert unify.json()["provenance"]["research_drop"] is True
