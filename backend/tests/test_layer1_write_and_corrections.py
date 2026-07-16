"""Layer-1 write (derivation rulesets) + audited past-job corrections."""

import os
import tempfile

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.steering_derivation import FormulaError, safe_eval


def test_safe_eval_allows_math_rejects_code():
    v = {"age": 58.0, "patience": 2.0}
    assert safe_eval("clamp(age * 2, 0, 100)", v) == 100
    assert safe_eval("100 if patience < 3 else 10", v) == 100
    for bad in ("__import__('os')", "age.__class__", "open('x')", "[i for i in range(3)]"):
        with pytest.raises(FormulaError):
            safe_eval(bad, v)


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings

    get_settings.cache_clear()
    c = TestClient(create_app())
    hub = c.post("/api/personas/generate", json={"company_name": "Acme", "count": 5, "seed": 9}).json()
    c.hub_id = hub["artifact_id"]  # type: ignore[attr-defined]
    yield c
    get_settings.cache_clear()


def test_layer1_write_ruleset_changes_computation(client):
    # Author a ruleset that recomputes observation_delay from features.
    created = client.post("/api/steering/rulesets", json={
        "name": "slow-elderly",
        "rules": {
            "observing.observation_delay_ms": {"type": "formula", "expr": "reaction_time_ms + (5 - vision_acuity) * 300"},
            "thinking.max_steps": {"type": "const", "value": 8},
        }})
    assert created.status_code == 200
    rid = created.json()["artifact_id"]

    # Baseline vs ruleset-applied derive differ on those fields.
    base = client.post("/api/steering/derive", json={"persona_hub_id": client.hub_id, "persona_index": 0}).json()["data"]
    ruled = client.post("/api/steering/derive", json={
        "persona_hub_id": client.hub_id, "persona_index": 0, "ruleset_id": rid}).json()["data"]
    assert ruled["layer"] == "discovered + dev-derivation ruleset"
    assert ruled["steering"]["thinking"]["max_steps"]["value"] == 8
    assert ruled["steering"]["thinking"]["max_steps"]["source"] == "dev-derivation"
    assert "derived_from_default" in ruled["steering"]["observing"]["observation_delay_ms"]
    assert ruled["steering"]["observing"]["observation_delay_ms"]["value"] != \
        base["steering"]["observing"]["observation_delay_ms"]["value"]


def test_ruleset_validation_and_preview(client):
    assert client.post("/api/steering/rulesets", json={
        "rules": {"acting.bad_path": {"type": "const", "value": 1}}}).status_code == 422
    assert client.post("/api/steering/rulesets", json={
        "rules": {"thinking.max_steps": {"type": "formula", "expr": "import os"}}}).status_code == 200
    # (bad formula only errors at apply/preview time, not save)
    rid = client.post("/api/steering/rulesets", json={
        "rules": {"acting.timeout_s": {"type": "formula", "expr": "patience * 60"}}}).json()["artifact_id"]
    preview = client.post("/api/steering/rulesets/preview", json={
        "persona_hub_id": client.hub_id, "persona_index": 0, "ruleset_id": rid})
    assert preview.status_code == 200
    assert "acting.timeout_s" in preview.json()["data"]["diff"]


def test_past_job_correction_inject_audit_revert(client):
    # A completed journey run (queued fine — has a steering to correct).
    run = client.post("/api/journeys", json={
        "target_url": "https://example.com", "goal": "buy tent",
        "persona_hub_id": client.hub_id, "persona_index": 0}).json()
    run_id = run["artifact_id"]

    # Inject a corrected value into the stored run's steering.
    inject = client.post("/api/corrections", json={
        "folder": "journeys", "artifact_id": run_id,
        "path": "steering.thinking.max_steps.value", "value": 99,
        "reason": "reviewer override"})
    assert inject.status_code == 200
    assert inject.json()["data"]["to"] == 99

    got = client.get(f"/api/journeys/{run_id}").json()["data"]
    assert got["steering"]["thinking"]["max_steps"]["value"] == 99
    assert got["corrections"][0]["reason"] == "reviewer override"

    # Audit list + revert restores the original.
    corrections = client.get(f"/api/corrections/journeys/{run_id}").json()["data"]
    assert len(corrections["corrections"]) == 1
    reverted = client.post(f"/api/corrections/journeys/{run_id}/revert")
    assert reverted.status_code == 200
    restored = client.get(f"/api/journeys/{run_id}").json()["data"]
    assert restored["steering"]["thinking"]["max_steps"]["value"] != 99


def test_corrections_guardrails(client):
    # Non-correctable folder rejected.
    assert client.post("/api/corrections", json={
        "folder": "account", "artifact_id": "x", "path": "credits", "value": 999999}).status_code == 422
    # Reserved path rejected.
    run = client.post("/api/journeys", json={
        "target_url": "https://x.io", "goal": "g", "persona_hub_id": client.hub_id}).json()
    assert client.post("/api/corrections", json={
        "folder": "journeys", "artifact_id": run["artifact_id"],
        "path": "provenance.engine", "value": "hacked"}).status_code == 422
