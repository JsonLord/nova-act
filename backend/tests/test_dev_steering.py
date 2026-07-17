"""Developer steering API: layer-1 derive (read-only) + layer-2 overrides."""

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
    c = TestClient(create_app())
    hub = c.post("/api/personas/generate", json={"company_name": "Acme", "count": 6, "seed": 3}).json()
    c.hub_id = hub["artifact_id"]  # type: ignore[attr-defined]
    yield c
    get_settings.cache_clear()


def test_layer1_derive_is_read_only_and_computable(client):
    # From a stored hub.
    r = client.post("/api/steering/derive", json={"persona_hub_id": client.hub_id, "persona_index": 0})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["layer"] == "discovered (read-only)"
    assert {"observing", "thinking", "acting"} <= set(data["steering"])

    # From an inline persona (dev code-runner over their own data).
    graph = client.get(f"/api/personas/{client.hub_id}/graph").json()["data"]
    inline = graph["nodes"][0]["profile"]
    r2 = client.post("/api/steering/derive", json={"persona": inline})
    assert r2.status_code == 200
    assert r2.json()["data"]["steering"]["observing"]["scan_pattern"]["value"] in ("F", "T", "full")


def test_layer2_override_validation_and_apply(client):
    # Forbidden path rejected.
    bad = client.post("/api/steering/apply", json={
        "persona_hub_id": client.hub_id, "overrides": {"acting.launch_missiles": True}})
    assert bad.status_code == 422

    # Valid override applies, keeps the discovered value, flips source.
    ok = client.post("/api/steering/apply", json={
        "persona_hub_id": client.hub_id,
        "overrides": {"thinking.max_steps": 3, "acting.allowed_actions": ["agentClick", "wait"]}})
    assert ok.status_code == 200
    eff = ok.json()["data"]["effective_steering"]
    assert eff["thinking"]["max_steps"]["value"] == 3
    assert eff["thinking"]["max_steps"]["source"] == "authored"
    assert "overridden_from" in eff["thinking"]["max_steps"]
    assert eff["acting"]["allowed_actions"]["value"] == ["agentClick", "wait"]


def test_steering_profile_crud_and_reference(client):
    created = client.post("/api/steering/profiles", json={
        "name": "impatient-mobile", "company_name": "Acme",
        "overrides": {"acting.frustration_abort_after_failed_steps": 1}})
    assert created.status_code == 200
    pid = created.json()["artifact_id"]

    assert any(e["artifact_id"] == pid for e in client.get("/api/steering/profiles").json()["data"])
    assert client.get(f"/api/steering/profiles/{pid}").json()["data"]["name"] == "impatient-mobile"

    # Apply via profile reference.
    applied = client.post("/api/steering/apply", json={
        "persona_hub_id": client.hub_id, "steering_profile_id": pid})
    assert applied.json()["data"]["effective_steering"]["acting"][
        "frustration_abort_after_failed_steps"]["value"] == 1

    # Invalid override on create is rejected.
    assert client.post("/api/steering/profiles", json={
        "name": "x", "overrides": {"nope.bad": 1}}).status_code == 422


def test_journey_accepts_authored_overrides(client):
    run = client.post("/api/journeys", json={
        "target_url": "https://example.com", "goal": "buy tent",
        "persona_hub_id": client.hub_id, "persona_index": 0,
        "steering_overrides": {"thinking.max_steps": 5}})
    assert run.status_code == 200
    # The stored run's steering reflects the authored override.
    steering = run.json()["data"]["steering"]
    assert steering["thinking"]["max_steps"]["value"] == 5
    assert steering["thinking"]["max_steps"]["source"] == "authored"
